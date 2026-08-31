import Foundation
import XCTest

@testable import WanspotKit

final class WanspotAPIClientTests: XCTestCase {
    func testAISummarySendsAuthAndDecodesResponse() async throws {
        let transport = StubHTTPTransport(
            responses: [
                .json(
                    """
                    {
                      "keywords": ["店内OK", "水あり"],
                      "summary": "犬連れで過ごしやすい場所です。",
                      "personalNote": "モカちゃんにも合いそうです。",
                      "wanspotRating": {"avg": 4.5, "count": 8},
                      "searchState": "done"
                    }
                    """
                ),
            ]
        )
        let client = WanspotAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://www.wanspot.app")),
            transport: transport,
            accessTokenProvider: { "test-token" }
        )

        let outcome = await client.fetchAISummary(
            AISummaryRequest(
                placeID: "place-1",
                spotID: "spot-1",
                name: "ワンカフェ",
                category: "カフェ"
            )
        )

        guard case let .summary(summary) = outcome else {
            return XCTFail("Expected a decoded summary")
        }
        XCTAssertEqual(summary.keywords, ["店内OK", "水あり"])
        XCTAssertEqual(summary.wanspotRating?.average, 4.5)

        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/api/ai-summary")
        XCTAssertEqual(
            request.value(forHTTPHeaderField: "Authorization"),
            "Bearer test-token"
        )
        XCTAssertEqual(
            request.timeoutInterval,
            WanspotAPIClient.slowPathTimeout
        )

        let body = try XCTUnwrap(request.httpBody)
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: body) as? [String: Any]
        )
        XCTAssertEqual(json["place_id"] as? String, "place-1")
        XCTAssertEqual(json["spot_id"] as? String, "spot-1")
        XCTAssertNil(json["rating"])
    }

    func testAISummaryMapsMissingContentToSafeEmptyReason() async throws {
        let transport = StubHTTPTransport(
            responses: [.json(#"{"emptyReason":"rate_limited"}"#)]
        )
        let client = WanspotAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://example.com")),
            transport: transport
        )

        let outcome = await client.fetchAISummary(
            AISummaryRequest(
                placeID: "place-1",
                name: "公園",
                category: "公園"
            )
        )

        XCTAssertEqual(outcome, .empty(.busy))
    }

    func testCloudQualityDropsRejectedRows() async throws {
        let transport = StubHTTPTransport(
            responses: [
                .json(
                    """
                    {
                      "results": [
                        {
                          "mediaId": "keep",
                          "qualityScore": 0.91,
                          "source": "cloud"
                        },
                        {
                          "mediaId": "drop",
                          "qualityScore": 0.1,
                          "source": "rejected"
                        }
                      ]
                    }
                    """
                ),
            ]
        )
        let client = WanspotAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://example.com")),
            transport: transport
        )

        let result = await client.fetchCloudQualityScores([
            CloudQualityItem(
                mediaID: "keep",
                storagePath: "user/image.jpg",
                mediaType: .image
            ),
        ])

        XCTAssertEqual(Set(result.keys), ["keep"])
        XCTAssertEqual(result["keep"]?.qualityScore, 0.91)
    }

    func testWalkLineBuildsQueryAndIgnoresUnknownLevel() async throws {
        let transport = StubHTTPTransport(
            responses: [
                .json(
                    """
                    {
                      "line": "  日陰の道を選びましょう  ",
                      "conditionId": "shade",
                      "hideWhenLevelAtOrAbove": "future-level"
                    }
                    """
                ),
            ]
        )
        let client = WanspotAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://example.com")),
            transport: transport
        )

        let line = await client.fetchWalkLine(
            latitude: 35.68,
            longitude: 139.76
        )

        XCTAssertEqual(line?.text, "日陰の道を選びましょう")
        XCTAssertNil(line?.hideWhenLevelAtOrAbove)
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        let components = try XCTUnwrap(
            URLComponents(url: try XCTUnwrap(request.url), resolvingAgainstBaseURL: false)
        )
        XCTAssertEqual(components.path, "/api/walk-line")
        XCTAssertEqual(
            Dictionary(
                uniqueKeysWithValues: (components.queryItems ?? []).compactMap {
                    item in item.value.map { (item.name, $0) }
                }
            ),
            ["lat": "35.68", "lng": "139.76"]
        )
    }

    func testRender404MapsToNotReady() async throws {
        struct Payload: Encodable, Sendable {
            let version: String
        }

        let transport = StubHTTPTransport(
            responses: [
                HTTPTransportResponse(
                    data: Data(#"{"error":"not deployed"}"#.utf8),
                    statusCode: 404
                ),
            ]
        )
        let client = WanspotAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://example.com")),
            transport: transport
        )

        let outcome = await client.requestVlogRender(
            Payload(version: "v9.5")
        )

        XCTAssertEqual(
            outcome,
            .failure(
                VlogRenderFailure(
                    code: .notReady,
                    message: "VLOG生成は準備中です"
                )
            )
        )
    }

    func testRenderMissingVideoURLMapsToServerFailure() async throws {
        struct Payload: Encodable, Sendable {
            let version: String
        }

        let transport = StubHTTPTransport(
            responses: [.json(#"{"edlVersion":"v9.5"}"#)]
        )
        let client = WanspotAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://example.com")),
            transport: transport
        )

        let outcome = await client.requestVlogRender(
            Payload(version: "v9.5")
        )

        XCTAssertEqual(
            outcome,
            .failure(
                VlogRenderFailure(
                    code: .server,
                    message: "動画URLの取得に失敗しました"
                )
            )
        )
    }

    func testCachedServiceDeduplicatesAISummaryWithinTTL() async throws {
        let response = HTTPTransportResponse.json(
            #"{"keywords":["店内OK"],"summary":"快適です"}"#
        )
        let transport = StubHTTPTransport(responses: [response])
        let client = WanspotAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://example.com")),
            transport: transport
        )
        let service = CachedWanspotService(client: client)
        let request = AISummaryRequest(
            placeID: "place-1",
            name: "カフェ",
            category: "カフェ"
        )

        _ = await service.fetchAISummary(request)
        _ = await service.fetchAISummary(request)

        let requestCount = await transport.requestCount()
        XCTAssertEqual(requestCount, 1)
    }

    func testCachedServiceDoesNotCacheAISummaryEmptyResponse() async throws {
        let response = HTTPTransportResponse.json(
            #"{"emptyReason":"rate_limited"}"#
        )
        let transport = StubHTTPTransport(responses: [response, response])
        let client = WanspotAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://example.com")),
            transport: transport
        )
        let service = CachedWanspotService(client: client)
        let request = AISummaryRequest(
            placeID: "place-1",
            name: "公園",
            category: "公園"
        )

        _ = await service.fetchAISummary(request)
        _ = await service.fetchAISummary(request)

        let requestCount = await transport.requestCount()
        XCTAssertEqual(requestCount, 2)
    }

    func testAccountDeleteUsesAuthenticatedBodylessPost() async throws {
        let transport = StubHTTPTransport(
            responses: [
                .json(#"{"success":true,"alreadyDeleted":true}"#),
            ]
        )
        let client = WanspotAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://www.wanspot.app")),
            transport: transport,
            accessTokenProvider: { "account-token" }
        )

        let response = try await client.deleteAccount()

        XCTAssertEqual(
            response,
            AccountDeleteResponse(success: true, alreadyDeleted: true)
        )
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/api/account/delete")
        XCTAssertNil(request.httpBody)
        XCTAssertEqual(
            request.value(forHTTPHeaderField: "Authorization"),
            "Bearer account-token"
        )
    }

    func testHTTPFailureDecodesNestedServerMessage() async throws {
        let transport = StubHTTPTransport(
            responses: [
                .json(
                    #"{"error":{"message":"入力内容を確認してください。"}}"#,
                    statusCode: 422
                ),
            ]
        )
        let client = WanspotAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://example.com")),
            transport: transport
        )

        do {
            let _: AccountDeleteResponse = try await client.get("/api/failure")
            XCTFail("A non-success response must throw")
        } catch {
            XCTAssertEqual(
                error as? WanspotAPIError,
                .httpStatus(
                    code: 422,
                    message: "入力内容を確認してください。"
                )
            )
        }
    }

    func testHTTPFailureUsesSafeLocalizedFallbackForNonJSONBody() async throws {
        let transport = StubHTTPTransport(
            responses: [
                HTTPTransportResponse(
                    data: Data("<html>upstream failure</html>".utf8),
                    statusCode: 503
                ),
            ]
        )
        let client = WanspotAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://example.com")),
            transport: transport
        )

        do {
            let _: AccountDeleteResponse = try await client.get("/api/failure")
            XCTFail("A non-success response must throw")
        } catch {
            let error = try XCTUnwrap(error as? WanspotAPIError)
            XCTAssertEqual(error, .httpStatus(code: 503, message: nil))
            XCTAssertEqual(
                error.localizedDescription,
                "サーバーで問題が発生しました。しばらく待ってから、もう一度お試しください。"
            )
        }
    }

    func testMalformedAndEmptySuccessResponsesAreDistinct() async throws {
        let transport = StubHTTPTransport(
            responses: [
                .json(#"{"success":"not-a-boolean"}"#),
                HTTPTransportResponse(data: Data(), statusCode: 204),
            ]
        )
        let client = WanspotAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://example.com")),
            transport: transport
        )

        do {
            let _: AccountDeleteResponse = try await client.get("/api/malformed")
            XCTFail("Malformed JSON must throw")
        } catch {
            XCTAssertEqual(error as? WanspotAPIError, .invalidResponse)
        }

        do {
            let _: AccountDeleteResponse = try await client.get("/api/empty")
            XCTFail("An empty response must throw")
        } catch {
            XCTAssertEqual(error as? WanspotAPIError, .emptyResponse)
        }
    }

    func testTransportFailuresMapToStableOfflineAndTimeoutErrors() async throws {
        for (code, expected) in [
            (URLError.notConnectedToInternet, WanspotAPIError.offline),
            (URLError.timedOut, WanspotAPIError.timedOut),
        ] {
            let client = WanspotAPIClient(
                baseURL: try XCTUnwrap(URL(string: "https://example.com")),
                transport: FailingHTTPTransport(code: code)
            )

            do {
                let _: AccountDeleteResponse = try await client.get("/api/test")
                XCTFail("A transport failure must throw")
            } catch {
                XCTAssertEqual(error as? WanspotAPIError, expected)
            }
        }
    }

    func testPublicRequestDoesNotConsultOrLeakAccessToken() async throws {
        let probe = AccessTokenProbe()
        let transport = StubHTTPTransport(
            responses: [.json(#"{"success":true}"#)]
        )
        let client = WanspotAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://example.com")),
            transport: transport,
            accessTokenProvider: {
                await probe.recordCall()
                return "must-not-leak"
            }
        )

        let _: AccountDeleteResponse = try await client.get(
            "/api/public",
            authenticated: false
        )

        let callCount = await probe.callCount
        XCTAssertEqual(callCount, 0)
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }
}

private actor StubHTTPTransport: HTTPTransport {
    private var responses: [HTTPTransportResponse]
    private var requests: [URLRequest] = []

    init(responses: [HTTPTransportResponse]) {
        self.responses = responses
    }

    func send(_ request: URLRequest) async throws -> HTTPTransportResponse {
        requests.append(request)
        guard !responses.isEmpty else {
            throw StubHTTPError.missingResponse
        }
        return responses.removeFirst()
    }

    func lastRequest() -> URLRequest? {
        requests.last
    }

    func requestCount() -> Int {
        requests.count
    }
}

private enum StubHTTPError: Error {
    case missingResponse
}

private struct FailingHTTPTransport: HTTPTransport {
    let code: URLError.Code

    func send(_ request: URLRequest) async throws -> HTTPTransportResponse {
        throw URLError(code)
    }
}

private actor AccessTokenProbe {
    private(set) var callCount = 0

    func recordCall() {
        callCount += 1
    }
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
