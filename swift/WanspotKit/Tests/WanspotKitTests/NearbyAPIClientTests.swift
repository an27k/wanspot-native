import Foundation
import XCTest

@testable import WanspotKit

final class NearbyAPIClientTests: XCTestCase {
    func testNearbyUsesExactQueryAndDecodesProductionShape() async throws {
        let transport = NearbyStubTransport(responses: [
            .json(
                """
                {
                  "spots": [{
                    "id": "7c137ce4-cf1a-4d35-a145-6bd65a1294f1",
                    "place_id": "place-1",
                    "name": "ワンカフェ",
                    "category": "カフェ",
                    "lat": 35.68,
                    "lng": 139.76,
                    "address": "東京都",
                    "photo_ref": null,
                    "rating": 4.5,
                    "user_ratings_total": 42,
                    "price_level": 2,
                    "price_label": "¥¥",
                    "pet_indoor_allowed": true,
                    "pet_policy_evidence": "official"
                  }]
                }
                """
            ),
        ])
        let client = makeClient(transport: transport)

        let response = try await client.fetchNearbySpots(
            latitude: 35.68,
            longitude: 139.76,
            radiusMeters: 3_000,
            type: .cafe
        )

        XCTAssertEqual(response.spots.first?.spotID, "7c137ce4-cf1a-4d35-a145-6bd65a1294f1")
        XCTAssertNil(response.spots.first?.petFriendlyVerified)
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(request.url?.path, "/api/spots/nearby")
        XCTAssertEqual(
            query(request),
            [
                "lat": "35.68",
                "lng": "139.76",
                "radius": "3000",
                "type": "cafe",
            ]
        )
        XCTAssertEqual(
            request.value(forHTTPHeaderField: "Authorization"),
            "Bearer token"
        )
        XCTAssertEqual(
            request.timeoutInterval,
            WanspotAPIClient.defaultTimeout
        )
    }

    func testSearchDecodesSearchCenter() async throws {
        let transport = NearbyStubTransport(responses: [
            .json(
                """
                {
                  "spots": [],
                  "search_center": {
                    "lat": 34.6937,
                    "lng": 135.5023,
                    "source": "station"
                  }
                }
                """
            ),
        ])
        let client = makeClient(transport: transport)

        let response = try await client.searchSpots(
            query: "大阪 カフェ",
            latitude: 35.68,
            longitude: 139.76
        )

        XCTAssertEqual(response.searchCenter?.source, "station")
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(request.url?.path, "/api/spots/search")
        XCTAssertEqual(query(request)["q"], "大阪 カフェ")
        XCTAssertEqual(query(request)["lat"], "35.68")
        XCTAssertEqual(query(request)["lng"], "139.76")
    }

    func testAutocompleteAndResolveArePublic() async throws {
        let transport = NearbyStubTransport(responses: [
            .json(
                """
                {
                  "predictions": [{
                    "place_id": "prediction-1",
                    "description": "東京駅, 日本",
                    "main_text": "東京駅",
                    "secondary_text": "日本"
                  }]
                }
                """
            ),
            .json(#"{"lat":35.6812,"lng":139.7671,"name":"東京駅"}"#),
        ])
        let client = makeClient(transport: transport)

        let predictions = try await client.autocompletePlaces(
            query: "東京",
            latitude: 35.68,
            longitude: 139.76
        )
        let resolved = try await client.resolvePlace(
            placeID: predictions[0].placeID
        )

        XCTAssertEqual(resolved.name, "東京駅")
        let requests = await transport.allRequests()
        XCTAssertEqual(requests.count, 2)
        XCTAssertNil(
            requests[0].value(forHTTPHeaderField: "Authorization")
        )
        XCTAssertNil(
            requests[1].value(forHTTPHeaderField: "Authorization")
        )
        XCTAssertEqual(query(requests[1])["place_id"], "prediction-1")
    }

    func testEnsureUsesAuthenticatedSnakeCaseBody() async throws {
        let transport = NearbyStubTransport(responses: [
            .json(
                """
                {
                  "id": "7c137ce4-cf1a-4d35-a145-6bd65a1294f1",
                  "spot": {
                    "id": "7c137ce4-cf1a-4d35-a145-6bd65a1294f1",
                    "place_id": "place-1"
                  }
                }
                """
            ),
        ])
        let client = makeClient(transport: transport)

        let result = try await client.ensureSpot(placeID: "place-1")

        XCTAssertEqual(
            result.resolvedID,
            "7c137ce4-cf1a-4d35-a145-6bd65a1294f1"
        )
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/api/spots/ensure")
        XCTAssertEqual(
            try jsonBody(request)["place_id"] as? String,
            "place-1"
        )
        XCTAssertEqual(
            request.value(forHTTPHeaderField: "Authorization"),
            "Bearer token"
        )
    }

    func testByIDsUsesCamelCaseWireContract() async throws {
        let transport = NearbyStubTransport(responses: [
            .json(
                """
                {
                  "spots": [{
                    "id": "7c137ce4-cf1a-4d35-a145-6bd65a1294f1",
                    "place_id": "place-1",
                    "name": "公園"
                  }]
                }
                """
            ),
        ])
        let client = makeClient(transport: transport)

        let spots = try await client.fetchSpotsByIDs(
            placeIDs: ["place-1"],
            columns: .list
        )

        XCTAssertEqual(spots.first?.placeID, "place-1")
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        let body = try jsonBody(request)
        XCTAssertEqual(body["placeIds"] as? [String], ["place-1"])
        XCTAssertEqual(body["ids"] as? [String], [])
        XCTAssertEqual(body["columns"] as? String, "list")
    }

    func testBatchDetailsUsesSnakeCaseAndDecodesDictionary() async throws {
        let transport = NearbyStubTransport(responses: [
            .json(
                """
                {
                  "details": {
                    "place-1": {
                      "photo_ref": "photo",
                      "photo_refs": ["photo", "photo-2"],
                      "rating": 4.2,
                      "user_ratings_total": 11,
                      "price_level": 1,
                      "price_label": "¥",
                      "formatted_address": "東京都",
                      "vicinity": "千代田区"
                    }
                  }
                }
                """
            ),
        ])
        let client = makeClient(transport: transport)

        let result = try await client.fetchBatchDetails(
            placeIDs: ["place-1"]
        )

        XCTAssertEqual(result["place-1"]?.photoReference, "photo")
        XCTAssertEqual(
            result["place-1"]?.photoReferences,
            ["photo", "photo-2"]
        )
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(
            try jsonBody(request)["place_ids"] as? [String],
            ["place-1"]
        )
    }

    func testPhotoUsesOnlySupportedWidthAndNoAuth() async throws {
        let transport = NearbyStubTransport(responses: [
            HTTPTransportResponse(
                data: Data([0xFF, 0xD8, 0xFF]),
                statusCode: 200,
                headers: ["content-type": "image/jpeg"]
            ),
        ])
        let client = makeClient(transport: transport)

        let photo = try await client.fetchSpotPhoto(
            reference: "photo/ref",
            placeID: "place-1",
            width: .detail
        )

        XCTAssertEqual(photo.contentType, "image/jpeg")
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(request.url?.path, "/api/spots/photo")
        XCTAssertEqual(query(request)["ref"], "photo/ref")
        XCTAssertEqual(query(request)["place_id"], "place-1")
        XCTAssertEqual(query(request)["w"], "800")
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }

    func testNearbyRepositoryReusesMemoryCacheWithinTTL() async throws {
        let transport = NearbyStubTransport(responses: [
            .json(
                """
                {
                  "spots": [{
                    "place_id": "place-1",
                    "name": "ワンカフェ",
                    "category": "カフェ",
                    "lat": 35.6812,
                    "lng": 139.7671,
                    "address": "東京都",
                    "photo_ref": null,
                    "rating": 4,
                    "price_level": null,
                    "types": ["cafe"]
                  }]
                }
                """
            ),
        ])
        let repository = NearbyRepository(
            client: makeClient(transport: transport)
        )
        let center = NearbyCoordinate(
            latitude: 35.6812,
            longitude: 139.7671
        )

        _ = try await repository.fetchNearbyWithExpansion(
            center: center,
            genre: .cafe,
            minimumSpotCount: 1
        )
        _ = try await repository.fetchNearbyWithExpansion(
            center: center,
            genre: .cafe,
            minimumSpotCount: 1
        )

        let requestCount = await transport.requestCount()
        XCTAssertEqual(requestCount, 1)
    }

    private func makeClient(
        transport: NearbyStubTransport
    ) -> WanspotAPIClient {
        WanspotAPIClient(
            baseURL: URL(string: "https://www.wanspot.app")!,
            transport: transport,
            accessTokenProvider: { "token" }
        )
    }

    private func query(_ request: URLRequest) -> [String: String] {
        let items = request.url.flatMap {
            URLComponents(
                url: $0,
                resolvingAgainstBaseURL: false
            )?.queryItems
        } ?? []
        return Dictionary(
            uniqueKeysWithValues: items.compactMap { item in
                item.value.map { (item.name, $0) }
            }
        )
    }

    private func jsonBody(_ request: URLRequest) throws -> [String: Any] {
        try XCTUnwrap(
            JSONSerialization.jsonObject(
                with: try XCTUnwrap(request.httpBody)
            ) as? [String: Any]
        )
    }
}

private actor NearbyStubTransport: HTTPTransport {
    private var responses: [HTTPTransportResponse]
    private var requests: [URLRequest] = []

    init(responses: [HTTPTransportResponse]) {
        self.responses = responses
    }

    func send(_ request: URLRequest) async throws -> HTTPTransportResponse {
        requests.append(request)
        guard !responses.isEmpty else {
            throw NearbyStubError.missingResponse
        }
        return responses.removeFirst()
    }

    func lastRequest() -> URLRequest? {
        requests.last
    }

    func allRequests() -> [URLRequest] {
        requests
    }

    func requestCount() -> Int {
        requests.count
    }
}

private enum NearbyStubError: Error {
    case missingResponse
}

private extension HTTPTransportResponse {
    static func json(
        _ value: String,
        statusCode: Int = 200
    ) -> HTTPTransportResponse {
        HTTPTransportResponse(
            data: Data(value.utf8),
            statusCode: statusCode,
            headers: ["Content-Type": "application/json"]
        )
    }
}
