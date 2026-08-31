import Foundation

public enum SpotIdentifier {
    public static func isUUID(_ value: String) -> Bool {
        UUID(
            uuidString: value.trimmingCharacters(
                in: .whitespacesAndNewlines
            )
        ) != nil
    }
}

public struct SpotsRepository: Sendable {
    private let client: WanspotAPIClient

    public init(client: WanspotAPIClient) {
        self.client = client
    }

    public func fetchSpot(spotID: String) async throws -> PublicSpot? {
        let spotID = spotID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard SpotIdentifier.isUUID(spotID) else {
            throw WanspotAPIError.invalidRequest("有効なスポットIDが必要です。")
        }
        return try await fetchSpotRow(
            queryItems: [URLQueryItem(name: "spot_id", value: spotID)]
        )
    }

    public func fetchSpot(placeID: String) async throws -> PublicSpot? {
        let placeID = placeID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !placeID.isEmpty else {
            throw WanspotAPIError.invalidRequest("place_idが必要です。")
        }
        return try await fetchSpotRow(
            queryItems: [URLQueryItem(name: "place_id", value: placeID)]
        )
    }

    public func fetchPlaceDetail(
        placeID: String
    ) async throws -> SpotPlaceDetail? {
        let placeID = placeID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !placeID.isEmpty else {
            throw WanspotAPIError.invalidRequest("place_idが必要です。")
        }
        do {
            let response: SpotPlaceDetailEnvelope = try await client.get(
                "/api/spots/detail",
                queryItems: [
                    URLQueryItem(name: "place_id", value: placeID),
                ],
                authenticated: false
            )
            return response.detail
        } catch let WanspotAPIError.httpStatus(code, _) where code == 404 {
            return nil
        }
    }

    public func ensureSpotID(placeID: String) async throws -> String {
        let response = try await client.ensureSpot(placeID: placeID)
        guard
            let spotID = response.resolvedID?
                .trimmingCharacters(in: .whitespacesAndNewlines),
            SpotIdentifier.isUUID(spotID)
        else {
            throw WanspotAPIError.emptyResponse
        }
        return spotID.lowercased()
    }

    public func photoURLs(
        references: [String],
        placeID: String,
        width: SpotPhotoWidth = .detail,
        maximumCount: Int = SpotPhotoLimit.galleryMaximum
    ) -> [URL] {
        var seen = Set<String>()
        let references = references.compactMap { reference -> String? in
            let reference = reference.trimmingCharacters(
                in: .whitespacesAndNewlines
            )
            guard
                !reference.isEmpty,
                seen.insert(reference).inserted,
                seen.count <= maximumCount
            else {
                return nil
            }
            return reference
        }

        if references.isEmpty {
            return [
                try? client.spotPhotoURL(
                    placeID: placeID,
                    width: width
                ),
            ].compactMap(\.self)
        }
        return references.compactMap { reference in
            try? client.spotPhotoURL(
                reference: reference,
                placeID: placeID,
                width: width
            )
        }
    }

    private func fetchSpotRow(
        queryItems: [URLQueryItem]
    ) async throws -> PublicSpot? {
        do {
            let response: SpotRowEnvelope = try await client.get(
                "/api/spots/row",
                queryItems: queryItems,
                authenticated: false
            )
            guard
                let spot = response.spot,
                spot.id?.isEmpty == false
                    || spot.placeID?.isEmpty == false
            else {
                return nil
            }
            return spot
        } catch let WanspotAPIError.httpStatus(code, _) where code == 404 {
            return nil
        }
    }
}

private struct SpotRowEnvelope: Decodable, Sendable {
    let spot: PublicSpot?

    private enum CodingKeys: String, CodingKey {
        case spot
    }

    init(from decoder: Decoder) throws {
        if
            let container = try? decoder.container(keyedBy: CodingKeys.self),
            container.contains(.spot)
        {
            spot = try container.decodeIfPresent(PublicSpot.self, forKey: .spot)
        } else {
            spot = try PublicSpot(from: decoder)
        }
    }
}

private struct SpotPlaceDetailEnvelope: Decodable, Sendable {
    let detail: SpotPlaceDetail

    private enum CodingKeys: String, CodingKey {
        case result
    }

    init(from decoder: Decoder) throws {
        if
            let container = try? decoder.container(keyedBy: CodingKeys.self),
            container.contains(.result)
        {
            detail = try container.decode(SpotPlaceDetail.self, forKey: .result)
        } else {
            detail = try SpotPlaceDetail(from: decoder)
        }
    }
}
