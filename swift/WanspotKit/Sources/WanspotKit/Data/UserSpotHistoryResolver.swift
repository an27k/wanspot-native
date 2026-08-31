import Foundation

public struct UserSpotHistoryResolver: Sendable {
    private let client: WanspotAPIClient

    public init(client: WanspotAPIClient) {
        self.client = client
    }

    public func resolve(
        _ records: [UserSpotHistoryRecord]
    ) async throws -> [ResolvedUserSpotHistoryItem] {
        guard !records.isEmpty else { return [] }
        let references = records.map(\.spotID)
        let spotIDs = references.filter(SpotIdentifier.isUUID)
        let legacyPlaceIDs = references.filter { !SpotIdentifier.isUUID($0) }
        let spots = try await client.fetchSpotsByIDs(
            ids: spotIDs,
            placeIDs: legacyPlaceIDs,
            columns: .list
        )
        let resolvedPlaceIDs = spots.compactMap(\.placeID)
        let details = (try? await client.fetchBatchDetails(
            placeIDs: resolvedPlaceIDs
        )) ?? [:]
        return UserSpotHistoryMapping.resolve(
            records: records,
            spots: spots,
            detailsByPlaceID: details
        )
    }
}
