import Foundation
import Supabase

public struct VisitRecordResult: Equatable, Sendable {
    public let visitID: String
    public let wasCreated: Bool

    public init(visitID: String, wasCreated: Bool) {
        self.visitID = visitID
        self.wasCreated = wasCreated
    }
}

public struct MemoryUploadResult: Equatable, Sendable {
    public let path: String
    public let mediaType: MemoryMediaType

    public init(path: String, mediaType: MemoryMediaType) {
        self.path = path
        self.mediaType = mediaType
    }
}

public struct SupabaseVisitsRepository: Sendable {
    public static let memoriesBucket = "memories"
    public static let signedURLLifetime = 3_600

    private static let visitColumns =
        """
        id, user_id, spot_id, visited_at, comment, rating, context, mood, \
        source, soft_deleted, created_at
        """
    private static let memoryColumns =
        """
        id, user_id, visit_id, spot_id, media_url, media_type, thumbnail_url, \
        soft_deleted, created_at
        """

    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func fetchVisits(userID: String) async throws -> [Visit] {
        try await client
            .from("visits")
            .select(Self.visitColumns)
            .eq("user_id", value: userID)
            .eq("soft_deleted", value: false)
            .order("visited_at", ascending: false)
            .execute()
            .value
    }

    public func fetchMemories(visitIDs: [String]) async throws -> [Memory] {
        let visitIDs = Array(Set(visitIDs.filter { !$0.isEmpty }))
        guard !visitIDs.isEmpty else { return [] }

        return try await client
            .from("memories")
            .select(Self.memoryColumns)
            .in("visit_id", values: visitIDs)
            .eq("soft_deleted", value: false)
            .order("created_at", ascending: true)
            .execute()
            .value
    }

    public func fetchTodaySpotVisit(
        userID: String,
        spotID: String,
        now: Date = Date(),
        calendar: Calendar = .autoupdatingCurrent
    ) async throws -> Visit? {
        let bounds = localDayBounds(now: now, calendar: calendar)
        let rows: [Visit] = try await client
            .from("visits")
            .select(Self.visitColumns)
            .eq("user_id", value: userID)
            .eq("spot_id", value: spotID)
            .eq("soft_deleted", value: false)
            .gte("visited_at", value: databaseTimestamp(bounds.start))
            .lte("visited_at", value: databaseTimestamp(bounds.end))
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    public func recordSpotVisit(
        userID: String,
        spotID: String,
        source: VisitSource = .detailButton,
        now: Date = Date(),
        calendar: Calendar = .autoupdatingCurrent
    ) async throws -> VisitRecordResult {
        if let visit = try await fetchTodaySpotVisit(
            userID: userID,
            spotID: spotID,
            now: now,
            calendar: calendar
        ) {
            try? await SupabaseSpotActivityRepository(client: client)
                .ensureCheckIn(userID: userID, spotID: spotID)
            return VisitRecordResult(visitID: visit.id, wasCreated: false)
        }

        struct VisitID: Decodable {
            let id: String
        }

        let inserted: VisitID = try await client
            .from("visits")
            .insert([
                "user_id": JSONValue.string(userID),
                "spot_id": JSONValue.string(spotID),
                "visited_at": JSONValue.string(databaseTimestamp(now)),
                "source": JSONValue.string(source.rawValue),
            ])
            .select("id")
            .single()
            .execute()
            .value
        try? await SupabaseSpotActivityRepository(client: client)
            .ensureCheckIn(userID: userID, spotID: spotID)
        return VisitRecordResult(visitID: inserted.id, wasCreated: true)
    }

    public func recordDailyLog(
        userID: String,
        context: DailyLogContext,
        mood: DailyLogMood?,
        now: Date = Date(),
        calendar: Calendar = .autoupdatingCurrent
    ) async throws -> VisitRecordResult {
        struct VisitID: Decodable {
            let id: String
        }

        let bounds = localDayBounds(now: now, calendar: calendar)
        let existing: [VisitID] = try await client
            .from("visits")
            .select("id")
            .eq("user_id", value: userID)
            .is("spot_id", value: nil)
            .eq("context", value: context.rawValue)
            .eq("soft_deleted", value: false)
            .gte("visited_at", value: databaseTimestamp(bounds.start))
            .lte("visited_at", value: databaseTimestamp(bounds.end))
            .limit(1)
            .execute()
            .value

        if let existing = existing.first {
            if let mood {
                try await client
                    .from("visits")
                    .update(["mood": JSONValue.string(mood.rawValue)])
                    .eq("id", value: existing.id)
                    .execute()
            }
            return VisitRecordResult(
                visitID: existing.id,
                wasCreated: false
            )
        }

        let inserted: VisitID = try await client
            .from("visits")
            .insert([
                "user_id": JSONValue.string(userID),
                "spot_id": JSONValue.null,
                "context": JSONValue.string(context.rawValue),
                "mood": mood.map { .string($0.rawValue) } ?? .null,
                "visited_at": JSONValue.string(databaseTimestamp(now)),
                "source": JSONValue.string(VisitSource.other.rawValue),
            ])
            .select("id")
            .single()
            .execute()
            .value
        return VisitRecordResult(visitID: inserted.id, wasCreated: true)
    }

    public func updateVisit(
        visitID: String,
        patch: VisitPatch
    ) async throws {
        var payload: [String: JSONValue] = [:]
        apply(patch.comment, key: "comment", to: &payload) { .string($0) }
        apply(patch.rating, key: "rating", to: &payload) { .integer($0) }
        apply(patch.visitedAt, key: "visited_at", to: &payload) { .string($0) }
        apply(patch.spotID, key: "spot_id", to: &payload) { .string($0) }
        guard !payload.isEmpty else { return }

        try await client
            .from("visits")
            .update(payload)
            .eq("id", value: visitID)
            .execute()
    }

    public func softDeleteVisit(_ visitID: String) async throws {
        try await client
            .from("visits")
            .update(["soft_deleted": JSONValue.bool(true)])
            .eq("id", value: visitID)
            .execute()
        // RN版と同じく、正データである visit の削除を優先する。
        // memories の追随失敗は次回同期で回収できるため best-effort。
        _ = try? await client
            .from("memories")
            .update(["soft_deleted": JSONValue.bool(true)])
            .eq("visit_id", value: visitID)
            .execute()
    }

    public func cancelTodaySpotVisit(
        userID: String,
        spotID: String,
        now: Date = Date(),
        calendar: Calendar = .autoupdatingCurrent
    ) async throws -> String? {
        guard let visit = try await fetchTodaySpotVisit(
            userID: userID,
            spotID: spotID,
            now: now,
            calendar: calendar
        ) else {
            return nil
        }
        try await softDeleteVisit(visit.id)
        return visit.id
    }

    public func softDeleteMemory(_ memoryID: String) async throws {
        try await client
            .from("memories")
            .update(["soft_deleted": JSONValue.bool(true)])
            .eq("id", value: memoryID)
            .execute()
    }

    public func uploadMemory(
        userID: String,
        data: Data,
        mimeType: String,
        fileID: UUID = UUID()
    ) async throws -> MemoryUploadResult {
        let isVideo = mimeType.hasPrefix("video/")
        let mediaType: MemoryMediaType = isVideo ? .video : .image
        let fileExtension = isVideo
            ? (mimeType.contains("quicktime") ? "mov" : "mp4")
            : "jpg"
        let path =
            "\(userID)/\(fileID.uuidString.lowercased()).\(fileExtension)"

        _ = try await client.storage
            .from(Self.memoriesBucket)
            .upload(
                path,
                data: data,
                options: FileOptions(
                    contentType: mimeType,
                    upsert: false
                )
            )
        return MemoryUploadResult(path: path, mediaType: mediaType)
    }

    public func insertMemory(
        userID: String,
        visitID: String,
        spotID: String?,
        storagePath: String,
        mediaType: MemoryMediaType
    ) async throws -> Memory {
        try await client
            .from("memories")
            .insert([
                "user_id": JSONValue.string(userID),
                "visit_id": JSONValue.string(visitID),
                "spot_id": spotID.map(JSONValue.string) ?? .null,
                "media_url": JSONValue.string(storagePath),
                "media_type": JSONValue.string(mediaType.rawValue),
            ])
            .select(Self.memoryColumns)
            .single()
            .execute()
            .value
    }

    public func signedMemoryURL(path: String) async throws -> URL {
        try await client.storage
            .from(Self.memoriesBucket)
            .createSignedURL(
                path: path,
                expiresIn: Self.signedURLLifetime
            )
    }
}

private func apply<Value: Sendable>(
    _ patch: FieldPatch<Value>,
    key: String,
    to payload: inout [String: JSONValue],
    transform: (Value) -> JSONValue
) {
    switch patch {
    case .unchanged:
        break
    case let .set(value):
        payload[key] = transform(value)
    case .clear:
        payload[key] = .null
    }
}

private func localDayBounds(
    now: Date,
    calendar: Calendar
) -> (start: Date, end: Date) {
    let start = calendar.startOfDay(for: now)
    let nextDay = calendar.date(byAdding: .day, value: 1, to: start)
        ?? start.addingTimeInterval(24 * 60 * 60)
    return (start, nextDay.addingTimeInterval(-0.001))
}

private func databaseTimestamp(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date)
}
