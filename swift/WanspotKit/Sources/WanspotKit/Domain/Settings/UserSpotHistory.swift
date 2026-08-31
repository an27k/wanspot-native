import Foundation

public enum UserSpotHistoryKind: String, Equatable, Sendable {
    case liked
    case visited
}

public struct UserSpotHistoryRecord: Equatable, Sendable, Identifiable {
    public let id: String
    public let spotID: String
    public let occurredAt: String?
    public let kind: UserSpotHistoryKind

    public init(
        id: String,
        spotID: String,
        occurredAt: String?,
        kind: UserSpotHistoryKind
    ) {
        self.id = id
        self.spotID = spotID
        self.occurredAt = occurredAt
        self.kind = kind
    }
}

public struct ResolvedUserSpotHistoryItem:
    Equatable,
    Sendable,
    Identifiable
{
    public let id: String
    public let spotID: String
    public let placeID: String?
    public let name: String
    public let category: String
    public let address: String?
    public let photoReference: String?
    public let rating: Double?
    public let userRatingsTotal: Int?
    public let priceLevel: Int?
    public let priceLabel: String?
    public let occurredAt: String?
    public let kind: UserSpotHistoryKind
    public let isAvailable: Bool

    public init(
        id: String,
        spotID: String,
        placeID: String?,
        name: String,
        category: String,
        address: String?,
        photoReference: String?,
        rating: Double?,
        userRatingsTotal: Int?,
        priceLevel: Int?,
        priceLabel: String?,
        occurredAt: String?,
        kind: UserSpotHistoryKind,
        isAvailable: Bool
    ) {
        self.id = id
        self.spotID = spotID
        self.placeID = placeID
        self.name = name
        self.category = category
        self.address = address
        self.photoReference = photoReference
        self.rating = rating
        self.userRatingsTotal = userRatingsTotal
        self.priceLevel = priceLevel
        self.priceLabel = priceLabel
        self.occurredAt = occurredAt
        self.kind = kind
        self.isAvailable = isAvailable
    }
}

public enum UserSpotHistoryMapping {
    public static func likedRecords(
        _ likes: [SpotLike]
    ) -> [UserSpotHistoryRecord] {
        deduplicated(
            likes.compactMap { like in
                let spotID = like.spotID.trimmingCharacters(
                    in: .whitespacesAndNewlines
                )
                guard !spotID.isEmpty else { return nil }
                return UserSpotHistoryRecord(
                    id: "liked:\(spotID)",
                    spotID: spotID,
                    occurredAt: like.createdAt,
                    kind: .liked
                )
            }
        )
    }

    public static func visitedRecords(
        visits: [Visit],
        checkIns: [CheckIn]
    ) -> [UserSpotHistoryRecord] {
        var rows = visits.compactMap { visit -> UserSpotHistoryRecord? in
            guard
                let rawSpotID = visit.spotID,
                !rawSpotID.trimmingCharacters(
                    in: .whitespacesAndNewlines
                ).isEmpty
            else {
                return nil
            }
            let spotID = rawSpotID.trimmingCharacters(
                in: .whitespacesAndNewlines
            )
            return UserSpotHistoryRecord(
                id: "visit:\(visit.id)",
                spotID: spotID,
                occurredAt: visit.visitedAt,
                kind: .visited
            )
        }
        rows.append(
            contentsOf: checkIns.compactMap { checkIn in
                let spotID = checkIn.spotID.trimmingCharacters(
                    in: .whitespacesAndNewlines
                )
                guard !spotID.isEmpty else { return nil }
                return UserSpotHistoryRecord(
                    id: "check-in:\(checkIn.id ?? spotID)",
                    spotID: spotID,
                    occurredAt: checkIn.createdAt,
                    kind: .visited
                )
            }
        )
        rows.sort { isLater($0.occurredAt, than: $1.occurredAt) }
        return deduplicated(rows)
    }

    public static func resolve(
        records: [UserSpotHistoryRecord],
        spots: [PublicSpot],
        detailsByPlaceID: [String: BatchPlaceDetail]
    ) -> [ResolvedUserSpotHistoryItem] {
        let byID = spots.reduce(into: [String: PublicSpot]()) {
            result,
            spot in
            if let id = spot.id, result[id] == nil {
                result[id] = spot
            }
        }
        let byPlaceID = spots.reduce(into: [String: PublicSpot]()) {
            result,
            spot in
            if let placeID = nonEmpty(spot.placeID), result[placeID] == nil {
                result[placeID] = spot
            }
        }

        return deduplicated(records).map { record in
            guard
                let spot = byID[record.spotID] ?? byPlaceID[record.spotID]
            else {
                return unresolved(record)
            }
            let placeID = nonEmpty(spot.placeID)
            let detail = placeID.flatMap { detailsByPlaceID[$0] }
            return ResolvedUserSpotHistoryItem(
                id: record.id,
                spotID: record.spotID,
                placeID: placeID,
                name: nonEmpty(spot.name) ?? "名称未設定のスポット",
                category: nonEmpty(spot.category) ?? "スポット",
                address: firstNonEmpty([
                    detail?.formattedAddress,
                    detail?.vicinity,
                    spot.bestAddress,
                ]),
                photoReference: firstNonEmpty([
                    detail?.photoReference,
                    spot.photoReference,
                ]),
                rating: detail?.rating ?? spot.rating,
                userRatingsTotal:
                    detail?.userRatingsTotal ?? spot.userRatingsTotal,
                priceLevel: detail?.priceLevel ?? spot.priceLevel,
                priceLabel: detail?.priceLabel ?? spot.priceLabel,
                occurredAt: record.occurredAt,
                kind: record.kind,
                isAvailable: true
            )
        }
    }

    private static func unresolved(
        _ record: UserSpotHistoryRecord
    ) -> ResolvedUserSpotHistoryItem {
        ResolvedUserSpotHistoryItem(
            id: record.id,
            spotID: record.spotID,
            placeID: nil,
            name: "現在利用できないスポット",
            category: "スポット情報なし",
            address: nil,
            photoReference: nil,
            rating: nil,
            userRatingsTotal: nil,
            priceLevel: nil,
            priceLabel: nil,
            occurredAt: record.occurredAt,
            kind: record.kind,
            isAvailable: false
        )
    }

    private static func deduplicated(
        _ records: [UserSpotHistoryRecord]
    ) -> [UserSpotHistoryRecord] {
        var seen = Set<String>()
        return records.filter { seen.insert($0.spotID).inserted }
    }
}

private func isLater(_ lhs: String?, than rhs: String?) -> Bool {
    switch (historyDate(lhs), historyDate(rhs)) {
    case let (left?, right?):
        left > right
    case (_?, nil):
        true
    case (nil, _?):
        false
    case (nil, nil):
        (lhs ?? "") > (rhs ?? "")
    }
}

private func historyDate(_ value: String?) -> Date? {
    guard let value else { return nil }
    let withFractionalSeconds = ISO8601DateFormatter()
    withFractionalSeconds.formatOptions = [
        .withInternetDateTime,
        .withFractionalSeconds,
    ]
    return withFractionalSeconds.date(from: value)
        ?? ISO8601DateFormatter().date(from: value)
}

private func firstNonEmpty(_ values: [String?]) -> String? {
    values.lazy.compactMap(nonEmpty).first
}

private func nonEmpty(_ value: String?) -> String? {
    let value = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return value.isEmpty ? nil : value
}
