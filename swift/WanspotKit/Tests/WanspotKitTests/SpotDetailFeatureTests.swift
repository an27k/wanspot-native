import Foundation
import XCTest

@testable import WanspotKit

final class SpotDetailFeatureTests: XCTestCase {
    private let spotID = "7c137ce4-cf1a-4d35-a145-6bd65a1294f1"

    func testResolverUsesGenericUUIDRouteAndMergesDetailContracts() async throws {
        let transport = SpotDetailStubTransport(
            responses: [
                .json(
                    """
                    {
                      "spot": {
                        "id": "\(spotID)",
                        "place_id": "place-1",
                        "name": "ワンカフェ",
                        "category": "カフェ",
                        "address": "古い住所",
                        "lat": 35.6812,
                        "lng": 139.7671,
                        "rating": 4.1,
                        "photo_ref": "row-photo",
                        "pet_indoor_allowed": true,
                        "pet_policy_evidence": "official",
                        "pet_size_limit": "小型犬",
                        "pet_reservation_required": true,
                        "instagram_id": "wanspot_cafe",
                        "dog_fact_highlights": ["店内OK", "水飲み場", "犬用メニュー"]
                      }
                    }
                    """
                ),
                .json(
                    """
                    {
                      "result": {
                        "name": "Google側の名前",
                        "rating": "4.7",
                        "userRatingsTotal": "88",
                        "priceLevel": 2,
                        "priceLabel": "¥¥",
                        "formattedAddress": "東京都千代田区1-1",
                        "formattedPhoneNumber": "03-0000-0000",
                        "openingHours": {
                          "openNow": "true",
                          "weekdayText": ["水曜日: 10:00〜18:00"],
                          "periods": []
                        },
                        "photos": [
                          {"photoReference": "detail-photo"},
                          "row-photo"
                        ],
                        "website": "https://example.com/cafe",
                        "url": "https://maps.google.com/?cid=1",
                        "reviews": [
                          {"text": "犬連れで快適でした"},
                          "テラスが広いです"
                        ],
                        "types": ["cafe", "food"]
                      }
                    }
                    """
                ),
            ]
        )
        let resolver = makeResolver(transport: transport)

        let detail = try await resolver.resolve(routeID: spotID)

        XCTAssertEqual(detail.spotID, spotID)
        XCTAssertEqual(detail.placeID, "place-1")
        XCTAssertEqual(detail.name, "ワンカフェ")
        XCTAssertEqual(detail.address, "東京都千代田区1-1")
        XCTAssertEqual(detail.rating, 4.7)
        XCTAssertEqual(detail.userRatingsTotal, 88)
        XCTAssertEqual(detail.photoReferences, ["row-photo", "detail-photo"])
        XCTAssertEqual(detail.openingHours?.openNow, true)
        XCTAssertEqual(detail.reviews, ["犬連れで快適でした", "テラスが広いです"])
        XCTAssertEqual(detail.instagramID, "wanspot_cafe")

        let policy = PetPolicy.presentation(for: detail)
        XCTAssertEqual(policy.badge?.label, "店内OK・確認済み")
        XCTAssertEqual(policy.conditions.map(\.kind), [.size, .reservation])

        let requests = await transport.allRequests()
        XCTAssertEqual(requests.count, 2)
        XCTAssertEqual(requests[0].url?.path, "/api/spots/row")
        XCTAssertEqual(query(requests[0]), ["spot_id": spotID])
        XCTAssertEqual(requests[1].url?.path, "/api/spots/detail")
        XCTAssertEqual(query(requests[1]), ["place_id": "place-1"])
        XCTAssertNil(
            requests[0].value(forHTTPHeaderField: "Authorization")
        )
    }

    func testResolverPrefersRowPhotoRefsAndCapsGallery() async throws {
        let transport = SpotDetailStubTransport(
            responses: [
                .json(
                    """
                    {
                      "spot": {
                        "id": "\(spotID)",
                        "place_id": "place-1",
                        "name": "ワンカフェ",
                        "category": "カフェ",
                        "address": "東京都",
                        "lat": 35.6812,
                        "lng": 139.7671,
                        "photo_ref": "row-photo",
                        "photo_refs": [
                          "row-photo",
                          "cache-2",
                          "cache-3",
                          "cache-4",
                          "cache-5",
                          "cache-6"
                        ]
                      }
                    }
                    """
                ),
                .json(
                    """
                    {
                      "result": {
                        "name": "ワンカフェ",
                        "photos": [
                          {"photoReference": "detail-photo"},
                          "row-photo"
                        ]
                      }
                    }
                    """
                ),
            ]
        )
        let resolver = makeResolver(transport: transport)

        let detail = try await resolver.resolve(routeID: spotID)

        XCTAssertEqual(
            detail.photoReferences,
            ["row-photo", "cache-2", "cache-3", "cache-4", "cache-5"]
        )
    }

    func testResolverAcceptsCanonicalPlaceRoute() async throws {
        let transport = SpotDetailStubTransport(
            responses: [
                .json(
                    """
                    {
                      "spot": {
                        "id": "\(spotID)",
                        "place_id": "place-2",
                        "name": "ドッグラン",
                        "category": "ドッグラン",
                        "lat": 35.6,
                        "lng": 139.7
                      }
                    }
                    """
                ),
                .json(
                    """
                    {
                      "name": "ドッグラン",
                      "photos": ["photo-1"]
                    }
                    """
                ),
            ]
        )
        let resolver = makeResolver(transport: transport)

        let detail = try await resolver.resolve(routeID: "place_place-2")

        XCTAssertEqual(detail.placeID, "place-2")
        XCTAssertEqual(detail.spotID, spotID)
        let requests = await transport.allRequests()
        XCTAssertEqual(query(requests[0]), ["place_id": "place-2"])
        XCTAssertEqual(query(requests[1]), ["place_id": "place-2"])
    }

    func testSpotsRepositoryMapsMissingRowToNilAndBuildsPhotoURLs() async throws {
        let transport = SpotDetailStubTransport(
            responses: [
                .json(#"{"spot":null}"#),
            ]
        )
        let client = makeClient(transport: transport)
        let repository = SpotsRepository(client: client)

        let row = try await repository.fetchSpot(placeID: "missing-place")
        let urls = repository.photoURLs(
            references: [" one ", "one", "", "two", "three"],
            placeID: "place/with space",
            width: .detail,
            maximumCount: 2
        )

        XCTAssertNil(row)
        XCTAssertEqual(urls.count, 2)
        XCTAssertEqual(query(urls[0])["ref"], "one")
        XCTAssertEqual(query(urls[1])["ref"], "two")
        XCTAssertEqual(query(urls[0])["place_id"], "place/with space")
        XCTAssertEqual(query(urls[0])["w"], "800")
    }

    func testSpotPhotoReferencesKeepsPrimaryFirstAndDedupes() {
        XCTAssertEqual(
            SpotPhotoReferences.merge(
                primary: " thumb ",
                additional: ["thumb", "two", "", "two", "three"]
            ),
            ["thumb", "two", "three"]
        )
        XCTAssertEqual(
            SpotPhotoReferences.merge(
                primary: nil,
                additional: ["one", "two", "three", "four", "five", "six"]
            ),
            ["one", "two", "three", "four", "five"]
        )
        XCTAssertEqual(
            SpotPhotoReferences.merge(primary: "  ", additional: []),
            []
        )
    }

    func testShareTextURLAndDeepLinkRulesMatchWebContract() throws {
        XCTAssertEqual(
            SpotSharing.text(
                name: " ワンカフェ ",
                highlights: ["店内OK", " 水あり ", "店内OK", "犬用メニュー", "4件目"]
            ),
            "ワンカフェ｜店内OK・水あり・犬用メニュー #wanspot"
        )
        XCTAssertEqual(
            SpotSharing.text(name: "  ", highlights: []),
            "スポット｜ワンちゃんと行けるスポット見つけた🐾 #wanspot"
        )

        let siteURL = try XCTUnwrap(
            URL(string: "https://www.wanspot.app/base/?source=app")
        )
        let publicURL = SpotSharing.publicURL(
            siteURL: siteURL,
            spotID: spotID.uppercased()
        )
        XCTAssertEqual(
            publicURL?.absoluteString,
            "https://www.wanspot.app/base/spots/\(spotID)"
        )
        XCTAssertNil(
            SpotSharing.publicURL(siteURL: siteURL, spotID: "place-1")
        )
        XCTAssertEqual(
            SpotSharing.instagramURL(
                instagramID: "@wanspot_cafe",
                spotName: "ワンカフェ"
            )?.absoluteString,
            "https://www.instagram.com/wanspot_cafe/"
        )
        XCTAssertEqual(
            SpotSharing.instagramURL(
                instagramID: nil,
                spotName: "ワンカフェ"
            )?.absoluteString,
            "https://www.google.com/search?q=%E3%83%AF%E3%83%B3%E3%82%AB%E3%83%95%E3%82%A7%20Instagram"
        )

        XCTAssertEqual(
            SpotSharing.routeID(
                from: try XCTUnwrap(
                    URL(string: "wanspot://spots/place_abc%20123")
                )
            ),
            "place_abc 123"
        )
        XCTAssertEqual(
            SpotSharing.routeID(
                from: try XCTUnwrap(
                    URL(string: "https://wanspot.app/spots/\(spotID)")
                )
            ),
            spotID
        )
        XCTAssertNil(
            SpotSharing.routeID(
                from: try XCTUnwrap(
                    URL(string: "https://example.com/spots/\(spotID)")
                )
            )
        )
    }

    func testPetPolicyPresentationKeepsUnknownAndConfirmedDistinct() {
        let confirmed = PlaceResult(
            placeID: "place-1",
            name: "カフェ",
            category: "カフェ",
            latitude: 35.6,
            longitude: 139.7,
            address: "",
            petIndoorAllowed: true,
            petPolicyEvidence: "reviews",
            petFriendlyStatus: "allowed",
            dogInteraction: "meet_dogs",
            petSizeLimit: "10kgまで",
            petReservationRequired: true
        )
        let unknown = PlaceResult(
            placeID: "place-2",
            name: "公園",
            category: "公園",
            latitude: 35.6,
            longitude: 139.7,
            address: ""
        )

        let confirmedPresentation = PetPolicy.presentation(for: confirmed)
        XCTAssertEqual(
            confirmedPresentation.badge,
            PetPolicyBadge(label: "店内OK（口コミによる）", tone: .ok)
        )
        XCTAssertEqual(
            confirmedPresentation.conditions.map(\.kind),
            [.size, .reservation, .interaction]
        )
        XCTAssertTrue(
            confirmedPresentation.conditions.allSatisfy(\.isCaution)
        )

        let unknownPresentation = PetPolicy.presentation(for: unknown)
        XCTAssertNil(unknownPresentation.badge)
        XCTAssertNotNil(unknownPresentation.advisory)
        XCTAssertFalse(PetPolicy.isIndoorAllowed(unknown))
        XCTAssertFalse(PetPolicy.isTerraceAllowed(unknown))
    }

    private func makeResolver(
        transport: SpotDetailStubTransport
    ) -> SpotDetailResolver {
        SpotDetailResolver(
            repository: SpotsRepository(
                client: makeClient(transport: transport)
            ),
            navigationState: SpotDetailNavigationState(
                userDefaults: .standard,
                stashKey: "SpotDetailFeatureTests-\(UUID().uuidString)"
            )
        )
    }

    private func makeClient(
        transport: SpotDetailStubTransport
    ) -> WanspotAPIClient {
        WanspotAPIClient(
            baseURL: URL(string: "https://www.wanspot.app")!,
            transport: transport,
            accessTokenProvider: { "private-token" }
        )
    }

    private func query(_ request: URLRequest) -> [String: String] {
        guard let url = request.url else { return [:] }
        return query(url)
    }

    private func query(_ url: URL) -> [String: String] {
        let items = URLComponents(
            url: url,
            resolvingAgainstBaseURL: false
        )?.queryItems ?? []
        return Dictionary(
            uniqueKeysWithValues: items.compactMap { item in
                item.value.map { (item.name, $0) }
            }
        )
    }
}

private actor SpotDetailStubTransport: HTTPTransport {
    private var responses: [HTTPTransportResponse]
    private var requests: [URLRequest] = []

    init(responses: [HTTPTransportResponse]) {
        self.responses = responses
    }

    func send(_ request: URLRequest) async throws -> HTTPTransportResponse {
        requests.append(request)
        guard !responses.isEmpty else {
            throw SpotDetailStubError.missingResponse
        }
        return responses.removeFirst()
    }

    func allRequests() -> [URLRequest] {
        requests
    }
}

private enum SpotDetailStubError: Error {
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
