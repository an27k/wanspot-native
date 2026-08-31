import Foundation
import Supabase

public enum SpotInfoTipValidationError: Error, Equatable, LocalizedError, Sendable {
    case empty
    case tooLong

    public var errorDescription: String? {
        switch self {
        case .empty:
            "内容を入力してください"
        case .tooLong:
            "1000文字以内で入力してください"
        }
    }
}

public struct SupabaseSpotActivityRepository: Sendable {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func fetchLikes(userID: String) async throws -> [SpotLike] {
        let rows: [SpotLikeRow] = try await client
            .from("spot_likes")
            .select("spot_id, created_at")
            .eq("user_id", value: userID)
            .order("created_at", ascending: false)
            .execute()
            .value
        return rows.compactMap { row in
            row.spotID.map {
                SpotLike(spotID: $0, createdAt: row.createdAt)
            }
        }
    }

    public func fetchCheckIns(userID: String) async throws -> [CheckIn] {
        let rows: [CheckInRow] = try await client
            .from("check_ins")
            .select("id, spot_id, created_at")
            .eq("user_id", value: userID)
            .order("created_at", ascending: false)
            .execute()
            .value
        return rows.compactMap { row in
            row.spotID.map {
                CheckIn(
                    id: row.id,
                    spotID: $0,
                    createdAt: row.createdAt
                )
            }
        }
    }

    public func setLike(
        userID: String,
        spotID: String,
        isLiked: Bool
    ) async throws {
        if isLiked {
            try await client
                .from("spot_likes")
                .insert([
                    "user_id": JSONValue.string(userID),
                    "spot_id": JSONValue.string(spotID),
                ])
                .execute()
        } else {
            try await client
                .from("spot_likes")
                .delete()
                .eq("user_id", value: userID)
                .eq("spot_id", value: spotID)
                .execute()
        }
    }

    public func likeCounts(spotIDs: [String]) async throws -> [String: Int] {
        let spotIDs = Array(Set(spotIDs.filter { !$0.isEmpty }))
        guard !spotIDs.isEmpty else { return [:] }

        struct LikeSpotID: Decodable {
            let spotID: String

            private enum CodingKeys: String, CodingKey {
                case spotID = "spot_id"
            }
        }

        let rows: [LikeSpotID] = try await client
            .from("spot_likes")
            .select("spot_id")
            .in("spot_id", values: spotIDs)
            .execute()
            .value
        return rows.reduce(into: [:]) { counts, row in
            counts[row.spotID, default: 0] += 1
        }
    }

    public func ensureCheckIn(
        userID: String,
        spotID: String
    ) async throws {
        struct CheckInID: Decodable {
            let id: String
        }

        let existing: [CheckInID] = try await client
            .from("check_ins")
            .select("id")
            .eq("user_id", value: userID)
            .eq("spot_id", value: spotID)
            .limit(1)
            .execute()
            .value
        guard existing.isEmpty else { return }

        try await client
            .from("check_ins")
            .insert([
                "user_id": JSONValue.string(userID),
                "spot_id": JSONValue.string(spotID),
            ])
            .execute()
    }

    public func submitInfoTip(
        spotID: String,
        userID: String,
        body: String
    ) async throws {
        let body = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else {
            throw SpotInfoTipValidationError.empty
        }
        // JavaScript の String.length（UTF-16 code units）と同じ上限判定。
        guard body.utf16.count <= 1_000 else {
            throw SpotInfoTipValidationError.tooLong
        }

        try await client
            .from("spot_info_tips")
            .insert([
                "spot_id": JSONValue.string(spotID),
                "user_id": JSONValue.string(userID),
                "body": JSONValue.string(body),
                "source": JSONValue.string("ai_review_empty"),
            ])
            .execute()
    }
}

private struct SpotLikeRow: Decodable {
    let spotID: String?
    let createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case spotID = "spot_id"
        case createdAt = "created_at"
    }
}

private struct CheckInRow: Decodable {
    let id: String?
    let spotID: String?
    let createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case spotID = "spot_id"
        case createdAt = "created_at"
    }
}
