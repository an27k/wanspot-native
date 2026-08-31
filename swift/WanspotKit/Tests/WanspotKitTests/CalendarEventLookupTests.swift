import Foundation
import XCTest

@testable import WanspotKit

final class CalendarEventLookupTests: XCTestCase {
    // 2026-09-15 12:00 JST。id しか無いときの走査は今月（2026-09）から先へ進む
    private let now = Date(timeIntervalSince1970: 1_789_534_800)

    func testResolvesSlugFromNavigationStateWithoutFetching() async throws {
        let transport = CalendarStubTransport()
        let state = makeNavigationState()
        let event = CalendarEvent(
            id: "event-1",
            title: "わんこ夏祭り",
            slug: "wanko-natsu-matsuri"
        )
        await state.stash(event, now: now)

        let lookup = makeLookup(transport: transport, state: state)
        let found = await lookup.event(slug: "wanko-natsu-matsuri", now: now)

        XCTAssertEqual(found, event)
        // stash 済みなら1回も通信しない（＝チャットカードの直行が
        // カレンダータブ経由と同じく無通信で開く）
        let paths = await transport.requestedPaths()
        XCTAssertEqual(paths, [])
    }

    func testFetchesSlugFromTheSingleEventAPIWithoutScanningMonths()
        async throws
    {
        let transport = CalendarStubTransport(
            eventsBySlug: [
                "halloween-wan": CalendarStubEvent(
                    id: "event-9",
                    slug: "halloween-wan"
                ),
            ]
        )
        let state = makeNavigationState()
        let lookup = makeLookup(transport: transport, state: state)

        let found = await lookup.event(slug: "halloween-wan", now: now)

        XCTAssertEqual(found?.id, "event-9")
        // 月別APIは1回も引かない。単一イベントAPIを1回だけ
        let paths = await transport.requestedPaths()
        XCTAssertEqual(paths, ["/api/calendar/events/by-slug/halloween-wan"])

        // 取得したイベントはナビゲーション状態に載るので、開き直しは無通信
        let again = await lookup.event(slug: "halloween-wan", now: now)
        XCTAssertEqual(again?.id, "event-9")
        let afterSecond = await transport.requestedPaths()
        XCTAssertEqual(afterSecond.count, 1)
    }

    func testResolvesEventsOutsideTheMonthlyHorizon() async throws {
        // 月別APIの horizon（当月〜1年）の外＝過去や5ヶ月以上先でも、
        // 単一イベントAPIは slug だけで引けるので詳細が開く。
        // 走査していない証拠として、月別APIは1件も応答を持たせていない
        let transport = CalendarStubTransport(
            eventsBySlug: [
                "wan楽市2026-ms76kokc": CalendarStubEvent(
                    id: "event-past",
                    slug: "wan楽市2026-ms76kokc",
                    startsAt: "2026-06-20T01:00:00+00:00"
                ),
            ]
        )
        let lookup = makeLookup(
            transport: transport,
            state: makeNavigationState()
        )

        let found = await lookup.event(slug: "wan楽市2026-ms76kokc", now: now)

        XCTAssertEqual(found?.id, "event-past")
        XCTAssertEqual(found?.occurrences.count, 1)
        let paths = await transport.requestedPaths()
        XCTAssertEqual(paths.count, 1)
        XCTAssertFalse(paths.contains("/api/calendar/events"))
    }

    func testPercentEncodesJapaneseSlugExactlyOnce() async throws {
        let slug = "風ぐるまドッグフェス-msd1onhu"
        let transport = CalendarStubTransport(
            eventsBySlug: [
                slug: CalendarStubEvent(id: "event-jp", slug: slug),
            ]
        )
        let lookup = makeLookup(
            transport: transport,
            state: makeNavigationState()
        )

        let found = await lookup.event(slug: slug, now: now)

        XCTAssertEqual(found?.id, "event-jp")
        // ワイヤ上は UTF-8 の percent-encoding 1回ぶん（`%25` が出たら二重エンコード）
        let urls = await transport.requestedURLStrings()
        let url = try XCTUnwrap(urls.first)
        XCTAssertEqual(
            url,
            "https://www.wanspot.app/api/calendar/events/by-slug/"
                + "%E9%A2%A8%E3%81%90%E3%82%8B%E3%81%BE"
                + "%E3%83%89%E3%83%83%E3%82%B0%E3%83%95%E3%82%A7%E3%82%B9"
                + "-msd1onhu"
        )
        XCTAssertFalse(url.contains("%25"))
    }

    func testSendsAuthorizationHeaderForTheSingleEventAPI() async throws {
        let transport = CalendarStubTransport(
            eventsBySlug: [
                "halloween-wan": CalendarStubEvent(
                    id: "event-9",
                    slug: "halloween-wan"
                ),
            ]
        )
        let lookup = makeLookup(
            transport: transport,
            state: makeNavigationState(),
            accessToken: "private-token"
        )

        _ = await lookup.event(slug: "halloween-wan", now: now)

        // サーバはホライズン（当月〜1年）の解除をログイン済みにだけ許す。
        // ここでトークンを落とすと過去・遠い未来のイベントが 404 になる
        let headers = await transport.requestedAuthorizationHeaders()
        XCTAssertEqual(headers, ["Bearer private-token"])
    }

    /// 未ログインでもヘッダが付かないだけで、経路そのものは同じ（公開範囲は狭まる）
    func testOmitsAuthorizationHeaderWhenSignedOut() async throws {
        let transport = CalendarStubTransport(
            eventsBySlug: [
                "halloween-wan": CalendarStubEvent(
                    id: "event-9",
                    slug: "halloween-wan"
                ),
            ]
        )
        let lookup = makeLookup(
            transport: transport,
            state: makeNavigationState(),
            accessToken: nil
        )

        let found = await lookup.event(slug: "halloween-wan", now: now)

        XCTAssertNotNil(found)
        let headers = await transport.requestedAuthorizationHeaders()
        XCTAssertEqual(headers, [nil])
    }

    func testReturnsNilWhenTheSingleEventAPIReturnsNotFound() async throws {
        let transport = CalendarStubTransport(eventsBySlug: [:])
        let lookup = makeLookup(
            transport: transport,
            state: makeNavigationState()
        )

        let found = await lookup.event(slug: "no-such-slug-xyz", now: now)

        XCTAssertNil(found)
        // 404 でも月別APIの走査に落ちない（＝1リクエストで打ち切る）
        let paths = await transport.requestedPaths()
        XCTAssertEqual(paths, ["/api/calendar/events/by-slug/no-such-slug-xyz"])
    }

    func testReturnsNilWhenTheSingleEventAPIFails() async throws {
        let transport = CalendarStubTransport(failsSingleEvent: true)
        let lookup = makeLookup(
            transport: transport,
            state: makeNavigationState()
        )

        let found = await lookup.event(slug: "halloween-wan", now: now)

        XCTAssertNil(found)
    }

    func testDoesNotRequestForASlugContainingAPathSeparator() async throws {
        // `/` を含む slug をそのままパスに埋めると別のルートを叩いてしまう
        let transport = CalendarStubTransport()
        let lookup = makeLookup(
            transport: transport,
            state: makeNavigationState()
        )

        let found = await lookup.event(slug: "foo/bar", now: now)

        XCTAssertNil(found)
        let paths = await transport.requestedPaths()
        XCTAssertEqual(paths, [])
    }

    func testScansMonthsOnlyForIDOnlyCards() async throws {
        let transport = CalendarStubTransport(months: [
            "2026-9": .events([]),
            "2026-10": .events([]),
            "2026-11": .events([
                CalendarStubEvent(id: "event-9", slug: "halloween-wan"),
            ]),
            "2026-12": .events([
                CalendarStubEvent(id: "event-12", slug: "christmas-wan"),
            ]),
        ])
        let lookup = makeLookup(
            transport: transport,
            state: makeNavigationState()
        )

        let found = await lookup.event(id: "event-9", now: now)

        XCTAssertEqual(found?.slug, "halloween-wan")
        // 当たった月で打ち切る（12月は引かない）
        let months = await transport.requestedMonths()
        XCTAssertEqual(months, ["2026-9", "2026-10", "2026-11"])
    }

    func testKeepsScanningWhenAMonthFails() async throws {
        let transport = CalendarStubTransport(months: [
            "2026-9": .failure,
            "2026-10": .events([
                CalendarStubEvent(id: "event-10", slug: "autumn-wan"),
            ]),
        ])
        let lookup = makeLookup(
            transport: transport,
            state: makeNavigationState()
        )

        let found = await lookup.event(id: "event-10", now: now)

        // 1ヶ月ぶんの失敗で打ち切らない
        XCTAssertEqual(found?.slug, "autumn-wan")
    }

    func testReturnsNilAfterExhaustingTheMonthSpan() async throws {
        let transport = CalendarStubTransport(months: [:])
        let lookup = makeLookup(
            transport: transport,
            state: makeNavigationState()
        )

        let found = await lookup.event(id: "not-listed", now: now)

        XCTAssertNil(found)
        // 走査範囲は4ヶ月で頭打ち（無制限に月別APIを引かない）
        let months = await transport.requestedMonths()
        XCTAssertEqual(
            months,
            ["2026-9", "2026-10", "2026-11", "2026-12"]
        )
    }

    func testResolvesByIDForCardsWithoutSlug() async throws {
        let transport = CalendarStubTransport(months: [
            "2026-9": .events([
                CalendarStubEvent(id: "event-1", slug: "wanko-natsu-matsuri"),
            ]),
        ])
        let lookup = makeLookup(
            transport: transport,
            state: makeNavigationState()
        )

        let found = await lookup.event(id: "event-1", now: now)

        XCTAssertEqual(found?.slug, "wanko-natsu-matsuri")
    }

    func testIgnoresEventsWithoutASlug() async throws {
        // slug が空のイベントは AppRoute.calendar(slug:) を組み立てられないため
        // 当たり扱いにしない（詳細を開けない画面に飛ばさない）
        let transport = CalendarStubTransport(months: [
            "2026-9": .events([CalendarStubEvent(id: "event-1", slug: "")]),
        ])
        let lookup = makeLookup(
            transport: transport,
            state: makeNavigationState()
        )

        let found = await lookup.event(id: "event-1", now: now)

        XCTAssertNil(found)
    }

    func testRejectsBlankIdentifiersWithoutFetching() async throws {
        let transport = CalendarStubTransport()
        let lookup = makeLookup(
            transport: transport,
            state: makeNavigationState()
        )

        let blankSlug = await lookup.event(slug: "   ", now: now)
        let blankID = await lookup.event(id: "", now: now)

        XCTAssertNil(blankSlug)
        XCTAssertNil(blankID)
        let paths = await transport.requestedPaths()
        XCTAssertEqual(paths, [])
    }

    func testTrimsWhitespaceAroundTheSlug() async throws {
        let transport = CalendarStubTransport(
            eventsBySlug: [
                "wanko-natsu-matsuri": CalendarStubEvent(
                    id: "event-1",
                    slug: "wanko-natsu-matsuri"
                ),
            ]
        )
        let lookup = makeLookup(
            transport: transport,
            state: makeNavigationState()
        )

        let found = await lookup.event(
            slug: "  wanko-natsu-matsuri \n",
            now: now
        )

        XCTAssertEqual(found?.id, "event-1")
        let paths = await transport.requestedPaths()
        XCTAssertEqual(
            paths,
            ["/api/calendar/events/by-slug/wanko-natsu-matsuri"]
        )
    }

    private func makeNavigationState() -> CalendarEventNavigationState {
        let suite = "CalendarEventLookupTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite) ?? .standard
        defaults.removePersistentDomain(forName: suite)
        return CalendarEventNavigationState(
            userDefaults: defaults,
            stashKey: "calendar_event_stash_test"
        )
    }

    private func makeLookup(
        transport: CalendarStubTransport,
        state: CalendarEventNavigationState,
        accessToken: String? = nil
    ) -> CalendarEventLookup {
        let client = WanspotAPIClient(
            baseURL: URL(string: "https://www.wanspot.app")!,
            transport: transport,
            accessTokenProvider: { accessToken }
        )
        return CalendarEventLookup(
            repository: CalendarRepository(client: client),
            navigationState: state
        )
    }
}

private struct CalendarStubEvent: Sendable {
    let id: String
    let slug: String
    var startsAt = "2026-11-01T01:00:00+00:00"

    var json: String {
        """
        {"id":"\(id)","title":"イベント\(id)","slug":"\(slug)",\
        "occurrences":[{"id":"occ-\(id)","event_id":"\(id)",\
        "starts_at":"\(startsAt)","ends_at":null,"is_all_day":false}],\
        "tags":[]}
        """
    }
}

private enum CalendarStubMonth: Sendable {
    case events([CalendarStubEvent])
    case failure
}

private actor CalendarStubTransport: HTTPTransport {
    private static let bySlugPrefix = "/api/calendar/events/by-slug/"

    private let months: [String: CalendarStubMonth]
    private let eventsBySlug: [String: CalendarStubEvent]
    private let failsSingleEvent: Bool
    private var requests: [URLRequest] = []

    init(
        months: [String: CalendarStubMonth] = [:],
        eventsBySlug: [String: CalendarStubEvent] = [:],
        failsSingleEvent: Bool = false
    ) {
        self.months = months
        self.eventsBySlug = eventsBySlug
        self.failsSingleEvent = failsSingleEvent
    }

    func send(_ request: URLRequest) async throws -> HTTPTransportResponse {
        requests.append(request)
        let path = request.url?.path ?? ""
        if path.hasPrefix(Self.bySlugPrefix) {
            return singleEvent(slug: String(path.dropFirst(
                Self.bySlugPrefix.count
            )))
        }
        return month(for: request)
    }

    func requestedPaths() -> [String] {
        requests.map { $0.url?.path ?? "" }
    }

    func requestedURLStrings() -> [String] {
        requests.map { $0.url?.absoluteString ?? "" }
    }

    func requestedAuthorizationHeaders() -> [String?] {
        requests.map { $0.value(forHTTPHeaderField: "Authorization") }
    }

    func requestedMonths() -> [String] {
        requests
            .filter { $0.url?.path == "/api/calendar/events" }
            .map { request in
                let query = Self.query(request)
                return "\(query["year"] ?? "")-\(query["month"] ?? "")"
            }
    }

    private func singleEvent(slug: String) -> HTTPTransportResponse {
        if failsSingleEvent {
            return .json(#"{"error":"failed"}"#, statusCode: 500)
        }
        guard let event = eventsBySlug[slug] else {
            return .json(#"{"error":"not_found"}"#, statusCode: 404)
        }
        return .json("{\"event\":\(event.json)}")
    }

    private func month(for request: URLRequest) -> HTTPTransportResponse {
        let query = Self.query(request)
        let key = "\(query["year"] ?? "")-\(query["month"] ?? "")"
        switch months[key] ?? .events([]) {
        case .failure:
            return .json(#"{"error":"boom"}"#, statusCode: 500)
        case let .events(events):
            return .json(
                """
                {"events":[\(events.map(\.json).joined(separator: ","))],\
                "meta":{"holidays":{},"inHorizon":true}}
                """
            )
        }
    }

    private static func query(_ request: URLRequest) -> [String: String] {
        let items = request.url.flatMap {
            URLComponents(url: $0, resolvingAgainstBaseURL: false)?.queryItems
        } ?? []
        return Dictionary(
            uniqueKeysWithValues: items.compactMap { item in
                item.value.map { (item.name, $0) }
            }
        )
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
