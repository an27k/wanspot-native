import Foundation
import Supabase

public enum DogPhotoSaveOutcome: Equatable, Sendable {
    case success(DogPhoto)
    case alreadyToday
    case uploadFailed
    case databaseFailed
}

public struct SupabaseDogPhotosRepository: Sendable {
    public static let retentionDays = 30
    public static let dailyPhotoLimit = 1
    public static let bucket = "dog-photos"

    private static let columns =
        "id, user_id, image_url, storage_path, taken_on, created_at"

    private let client: SupabaseClient
    private let cache: MemoryCache?

    public init(
        client: SupabaseClient,
        cache: MemoryCache? = nil
    ) {
        self.client = client
        self.cache = cache
    }

    public func fetchAlbumPhotos(
        userID: String,
        now: Date = Date(),
        calendar: Calendar = .autoupdatingCurrent
    ) async throws -> [DogPhoto] {
        let since = calendar.date(
            byAdding: .day,
            value: -Self.retentionDays,
            to: now
        ) ?? now.addingTimeInterval(-Double(Self.retentionDays) * 86_400)

        return try await client
            .from("dog_photos")
            .select(Self.columns)
            .eq("user_id", value: userID)
            .gte("created_at", value: dogPhotoTimestamp(since))
            .order("created_at", ascending: false)
            .execute()
            .value
    }

    public func fetchTodayPhoto(
        userID: String,
        now: Date = Date(),
        calendar: Calendar = .autoupdatingCurrent
    ) async throws -> DogPhoto? {
        let rows: [DogPhoto] = try await client
            .from("dog_photos")
            .select(Self.columns)
            .eq("user_id", value: userID)
            .eq("taken_on", value: dogPhotoDateKey(now, calendar: calendar))
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    public func saveDailyPhoto(
        userID: String,
        jpegData: Data,
        now: Date = Date(),
        calendar: Calendar = .autoupdatingCurrent,
        fileID: UUID = UUID()
    ) async -> DogPhotoSaveOutcome {
        if (
            try? await fetchTodayPhoto(
                userID: userID,
                now: now,
                calendar: calendar
            )
        ) != nil
        {
            return .alreadyToday
        }

        let takenOn = dogPhotoDateKey(now, calendar: calendar)
        let path =
            "\(userID)/\(takenOn)-\(fileID.uuidString.lowercased()).jpg"

        do {
            _ = try await client.storage
                .from(Self.bucket)
                .upload(
                    path,
                    data: jpegData,
                    options: FileOptions(
                        contentType: "image/jpeg",
                        upsert: false
                    )
                )
        } catch {
            return .uploadFailed
        }

        let imageURL: URL
        do {
            imageURL = try client.storage
                .from(Self.bucket)
                .getPublicURL(path: path)
        } catch {
            _ = try? await client.storage.from(Self.bucket).remove(paths: [path])
            return .uploadFailed
        }

        do {
            let photo: DogPhoto = try await client
                .from("dog_photos")
                .insert([
                    "user_id": JSONValue.string(userID),
                    "image_url": JSONValue.string(imageURL.absoluteString),
                    "storage_path": JSONValue.string(path),
                    "taken_on": JSONValue.string(takenOn),
                ])
                .select(Self.columns)
                .single()
                .execute()
                .value
            await invalidateCache(userID: userID, takenOn: takenOn)
            return .success(photo)
        } catch {
            _ = try? await client.storage.from(Self.bucket).remove(paths: [path])
            if (error as? PostgrestError)?.code == "23505" {
                return .alreadyToday
            }
            return .databaseFailed
        }
    }

    public func replaceTodayPhoto(
        userID: String,
        jpegData: Data,
        now: Date = Date(),
        calendar: Calendar = .autoupdatingCurrent,
        fileID: UUID = UUID()
    ) async -> DogPhotoSaveOutcome {
        if
            let existing = try? await fetchTodayPhoto(
                userID: userID,
                now: now,
                calendar: calendar
            )
        {
            _ = try? await client.storage
                .from(Self.bucket)
                .remove(paths: [existing.storagePath])
            _ = try? await client
                .from("dog_photos")
                .delete()
                .eq("id", value: existing.id)
                .execute()
            await invalidateCache(
                userID: userID,
                takenOn: existing.takenOn
            )
        }
        return await saveDailyPhoto(
            userID: userID,
            jpegData: jpegData,
            now: now,
            calendar: calendar,
            fileID: fileID
        )
    }

    private func invalidateCache(userID: String, takenOn: String) async {
        guard let cache else { return }
        await cache.invalidate("dog:today:\(userID):\(takenOn)")
        await cache.invalidate("dog:album:\(userID)")
    }
}

public func dogPhotoDateKey(
    _ date: Date,
    calendar: Calendar = .autoupdatingCurrent
) -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    return String(
        format: "%04d-%02d-%02d",
        parts.year ?? 0,
        parts.month ?? 0,
        parts.day ?? 0
    )
}

private func dogPhotoTimestamp(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date)
}
