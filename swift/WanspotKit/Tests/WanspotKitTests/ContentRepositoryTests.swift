import Foundation
import XCTest

@testable import WanspotKit

final class ContentRepositoryTests: XCTestCase {
    func testCalendarMonthUsesPublicRouteAndLossyWireDecoding() async throws {
        let transport = ContentStubTransport(responses: [
            .json(
                """
                {
                  "events": [
                    {
                      "id": "event-1",
                      "title": "わんこ祭り",
                      "slug": "dog-festival",
                      "lat": "35.68",
                      "lng": 139.76,
                      "price_level": "2",
                      "occurrences": [
                        {
                          "id": "occurrence-1",
                          "event_id": "event-1",
                          "starts_at": "2026-08-23T10:00:00+09:00",
                          "ends_at": null,
                          "is_all_day": "false"
                        },
                        {
                          "id": "broken",
                          "starts_at": "not-a-date"
                        }
                      ],
                      "tags": [
                        {
                          "id": "tag-1",
                          "name": "マルシェ",
                          "sort_order": "1"
                        }
                      ],
                      "prefecture": {
                        "id": "pref-1",
                        "name": "東京都",
                        "slug": "tokyo",
                        "sort_order": 13
                      }
                    },
                    {
                      "id": "broken-event",
                      "slug": "missing-title"
                    }
                  ],
                  "meta": {
                    "holidays": {"2026-08-11": "山の日"},
                    "inHorizon": true
                  }
                }
                """
            ),
        ])
        let repository = CalendarRepository(client: makeClient(transport))

        let response = try await repository.fetchMonth(
            CalendarMonth(year: 2026, month: 8)
        )

        XCTAssertEqual(response.events.count, 1)
        XCTAssertEqual(response.events[0].latitude, 35.68)
        XCTAssertEqual(response.events[0].priceLevel, 2)
        XCTAssertEqual(response.events[0].occurrences.count, 1)
        XCTAssertEqual(response.events[0].tags.first?.sortOrder, 1)
        XCTAssertEqual(response.metadata.holidays["2026-08-11"], "山の日")

        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(request.url?.path, "/api/calendar/events")
        XCTAssertEqual(
            query(request),
            ["year": "2026", "month": "8"]
        )
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }

    func testCalendarEventBySlugUsesPublicRouteAndCache() async throws {
        let slug = "風ぐるまドッグフェス-msd1onhu"
        let transport = ContentStubTransport(responses: [
            .json(
                """
                {
                  "event": {
                    "id": "6ed9daf4-9881-46eb-a167-1f021865109f",
                    "title": "風ぐるまドッグフェス",
                    "slug": "\(slug)",
                    "ai_summary": "屋外のドッグフェスです…",
                    "lat": 36.1014335,
                    "lng": 139.6328889,
                    "occurrences": [
                      {
                        "id": "occurrence-1",
                        "event_id": "6ed9daf4-9881-46eb-a167-1f021865109f",
                        "starts_at": "2026-10-03T01:00:00+00:00",
                        "ends_at": "2026-10-03T07:00:00+00:00",
                        "is_all_day": false
                      },
                      {
                        "id": "occurrence-2",
                        "event_id": "6ed9daf4-9881-46eb-a167-1f021865109f",
                        "starts_at": "2026-10-04T01:00:00+00:00",
                        "ends_at": "2026-10-04T07:00:00+00:00",
                        "is_all_day": false
                      }
                    ],
                    "tags": [
                      {
                        "id": "tag-1",
                        "name": "ドッグイベント",
                        "slug": "dog-event",
                        "color": "#FB6B53",
                        "sort_order": 1
                      }
                    ],
                    "prefecture": {
                      "id": "pref-11",
                      "name": "埼玉県",
                      "slug": "saitama",
                      "sort_order": 11
                    },
                    "calendar_event_occurrences": [],
                    "calendar_prefectures": null,
                    "calendar_regions": null,
                    "calendar_stations": null,
                    "calendar_event_tags": []
                  }
                }
                """
            ),
        ])
        let repository = CalendarRepository(client: makeClient(transport))

        let first = try await repository.fetchEvent(slug: slug)
        // 前後の空白は落として同じキャッシュに当てる
        let second = try await repository.fetchEvent(slug: "  \(slug) ")

        XCTAssertEqual(first, second)
        let event = try XCTUnwrap(first)
        XCTAssertEqual(event.slug, slug)
        // 月別APIと同じ形なので同じデコーダで整形済みの関連まで読める
        XCTAssertEqual(event.occurrences.count, 2)
        XCTAssertEqual(event.tags.first?.name, "ドッグイベント")
        XCTAssertEqual(event.prefecture?.name, "埼玉県")

        let requestCount = await transport.requestCount()
        XCTAssertEqual(requestCount, 1)
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(
            request.url?.path,
            "/api/calendar/events/by-slug/\(slug)"
        )
        // 日本語 slug は percent-encoding 1回ぶん（`%25` が出たら二重エンコード）
        XCTAssertEqual(
            request.url?.absoluteString.contains("%25"),
            false
        )
        // ホライズン外（過去・遠い未来）の詳細はログイン済みにだけ返るので
        // 単一イベント取得APIにはトークンを載せる
        XCTAssertEqual(
            request.value(forHTTPHeaderField: "Authorization"),
            "Bearer private-token"
        )
    }

    func testCalendarEventBySlugReturnsNilForNotFoundAndDoesNotCacheIt()
        async throws
    {
        let transport = ContentStubTransport(responses: [
            .json(#"{"error":"not_found"}"#, statusCode: 404),
            .json(#"{"error":"not_found"}"#, statusCode: 404),
        ])
        let repository = CalendarRepository(client: makeClient(transport))

        let first = try await repository.fetchEvent(slug: "no-such-slug-xyz")
        let second = try await repository.fetchEvent(slug: "no-such-slug-xyz")

        XCTAssertNil(first)
        XCTAssertNil(second)
        // 404 は「無い」であって通信失敗ではないので throw しない。
        // ただしキャッシュには載せない（公開直後の slug を固定しない）
        let requestCount = await transport.requestCount()
        XCTAssertEqual(requestCount, 2)
    }

    func testCalendarEventBySlugSurfacesServerFailures() async throws {
        let transport = ContentStubTransport(responses: [
            .json(#"{"error":"failed"}"#, statusCode: 500),
        ])
        let repository = CalendarRepository(client: makeClient(transport))

        do {
            _ = try await repository.fetchEvent(slug: "halloween-wan")
            XCTFail("500 は通信失敗として投げるべき")
        } catch {
            XCTAssertEqual(
                error as? ContentRepositoryError,
                .unavailable
            )
        }
    }

    func testCalendarEventBySlugRejectsUnusableSlugsWithoutFetching()
        async throws
    {
        let transport = ContentStubTransport(responses: [])
        let repository = CalendarRepository(client: makeClient(transport))

        for slug in ["   ", "foo/bar"] {
            do {
                _ = try await repository.fetchEvent(slug: slug)
                XCTFail("組み立てられない slug は弾くべき: \(slug)")
            } catch {
                XCTAssertNotNil(error as? WanspotAPIError)
            }
        }
        let requestCount = await transport.requestCount()
        XCTAssertEqual(requestCount, 0)
    }

    func testCalendarNearbyUsesExactPublicRouteAndCache() async throws {
        let eventID = "7c137ce4-cf1a-4d35-a145-6bd65a1294f1"
        let transport = ContentStubTransport(responses: [
            .json(
                """
                {
                  "spots": [
                    {
                      "spot_id": "1775bb62-617d-4672-ac44-ea3ce59917cc",
                      "name": "ワンカフェ",
                      "category": "カフェ",
                      "place_id": "place-1",
                      "lat": "35.68",
                      "lng": 139.76,
                      "kind": "food",
                      "distance_m": "850",
                      "rating": 4.5,
                      "reviews": "20",
                      "rank": 1
                    },
                    {
                      "spot_id": "missing-place",
                      "name": "遷移不能",
                      "place_id": null,
                      "kind": "food",
                      "distance_m": 10,
                      "rank": 2
                    }
                  ]
                }
                """
            ),
        ])
        let repository = CalendarRepository(client: makeClient(transport))

        let first = try await repository.fetchNearbySpots(eventID: eventID)
        let second = try await repository.fetchNearbySpots(eventID: eventID)

        XCTAssertEqual(first, second)
        XCTAssertEqual(first.count, 1)
        XCTAssertEqual(first[0].distanceMeters, 850)
        let requestCount = await transport.requestCount()
        XCTAssertEqual(requestCount, 1)
        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(
            request.url?.path,
            "/api/calendar/events/\(eventID)/nearby"
        )
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }

    func testArticleListAndDetailUsePublicContractsAndNormalizeBlocks() async throws {
        let transport = ContentStubTransport(responses: [
            .json(
                """
                {
                  "articles": [
                    {
                      "id": "article-1",
                      "title": "東京のカフェ",
                      "summary": "まとめ",
                      "slug": "tokyo-cafe",
                      "category": "general",
                      "theme": "【東京都】カフェおすすめ",
                      "keywords": ["犬連れ", "犬連れ", " カフェ "],
                      "image_url": null,
                      "created_at": "2026-08-01T00:00:00Z",
                      "published_at": "2026-08-02T00:00:00Z",
                      "segment_level": "prefecture",
                      "linked_spot_refs": ["place-1"],
                      "linked_event_refs": ["event-1"]
                    },
                    {
                      "id": "broken",
                      "slug": "missing-title"
                    }
                  ]
                }
                """
            ),
            .json(
                """
                {
                  "article": {
                    "id": "article-1",
                    "title": "東京のカフェ",
                    "slug": "tokyo-cafe",
                    "body": "fallback",
                    "summary": "まとめ",
                    "keywords": ["犬連れ"],
                    "category": "general",
                    "image_url": null,
                    "blocks": [
                      {"type": "heading", "text": "見出し"},
                      {"type": "paragraph", "content": "本文"},
                      {
                        "type": "spot",
                        "spotId": "place-1",
                        "spotName": "ワンカフェ",
                        "description": "店内OK"
                      },
                      {"type": "unsupported", "content": "skip"}
                    ],
                    "spot_links": [
                      {
                        "spot_name": "公園",
                        "spot_id": "place-2",
                        "description": "近くの公園"
                      }
                    ]
                  }
                }
                """
            ),
        ])
        let repository = ArticlesRepository(client: makeClient(transport))

        let list = try await repository.fetchArticles()
        let fetchedDetail = try await repository.fetchArticle(
            idOrSlug: "tokyo-cafe"
        )
        let detail = try XCTUnwrap(fetchedDetail)

        XCTAssertEqual(list.count, 1)
        XCTAssertEqual(list[0].keywords, ["犬連れ", "カフェ"])
        XCTAssertEqual(list[0].segmentLevel, .prefecture)
        XCTAssertEqual(list[0].linkedEventReferences, ["event-1"])
        XCTAssertEqual(detail.renderedBlocks.count, 3)
        XCTAssertEqual(detail.linkedSpotReferences, ["place-1", "place-2"])

        let requests = await transport.allRequests()
        XCTAssertEqual(requests.count, 2)
        XCTAssertEqual(requests[0].url?.path, "/api/articles")
        XCTAssertEqual(query(requests[0]), ["limit": "200"])
        XCTAssertEqual(requests[1].url?.path, "/api/articles/tokyo-cafe")
        XCTAssertTrue(
            requests.allSatisfy {
                $0.value(forHTTPHeaderField: "Authorization") == nil
            }
        )
    }

    func testCalendarNavigationStashMatchesSlugAndExpires() async throws {
        let suite = "ContentRepositoryTests-\(UUID().uuidString)"
        defer {
            UserDefaults(suiteName: suite)?
                .removePersistentDomain(forName: suite)
        }
        let state = CalendarEventNavigationState(
            userDefaults: try XCTUnwrap(UserDefaults(suiteName: suite)),
            stashKey: "calendar"
        )
        let event = CalendarEvent(
            id: "event-1",
            title: "イベント",
            slug: "event"
        )
        let storedAt = Date(timeIntervalSince1970: 1_000)

        await state.stash(event, now: storedAt)
        let wrongSlug = await state.resolve(
            slug: "other",
            now: storedAt.addingTimeInterval(1)
        )
        let fresh = await state.resolve(
            slug: "event",
            now: storedAt.addingTimeInterval(14 * 60)
        )
        XCTAssertNil(wrongSlug)
        XCTAssertEqual(fresh, event)

        let restored = CalendarEventNavigationState(
            userDefaults: try XCTUnwrap(UserDefaults(suiteName: suite)),
            stashKey: "calendar"
        )
        let expired = await restored.resolve(
            slug: "event",
            now: storedAt.addingTimeInterval(16 * 60)
        )
        XCTAssertNil(expired)
    }

    private func makeClient(_ transport: ContentStubTransport) -> WanspotAPIClient {
        WanspotAPIClient(
            baseURL: URL(string: "https://www.wanspot.app")!,
            transport: transport,
            accessTokenProvider: { "private-token" }
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
}

private actor ContentStubTransport: HTTPTransport {
    private var responses: [HTTPTransportResponse]
    private var requests: [URLRequest] = []

    init(responses: [HTTPTransportResponse]) {
        self.responses = responses
    }

    func send(_ request: URLRequest) async throws -> HTTPTransportResponse {
        requests.append(request)
        guard !responses.isEmpty else {
            throw ContentStubError.missingResponse
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

private enum ContentStubError: Error {
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
