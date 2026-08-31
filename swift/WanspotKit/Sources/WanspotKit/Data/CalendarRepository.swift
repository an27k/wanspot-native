import Foundation

public enum ContentRepositoryError: Error, Equatable, LocalizedError, Sendable {
    case unavailable
    case server(String)

    public var errorDescription: String? {
        switch self {
        case .unavailable:
            "うまく読み込めませんでした。通信環境を確認して、もう一度お試しください。"
        case let .server(message):
            message
        }
    }
}

public struct CalendarRepository: Sendable {
    private let client: WanspotAPIClient
    private let cache: MemoryCache

    public init(
        client: WanspotAPIClient,
        cache: MemoryCache = MemoryCache()
    ) {
        self.client = client
        self.cache = cache
    }

    public func fetchMonth(
        _ month: CalendarMonth,
        force: Bool = false
    ) async throws -> CalendarMonthResponse {
        let key = "calendar:month:v1:\(month.cacheKey)"
        do {
            let result: CacheFetchResult<CalendarMonthResponse> =
                try await cache.fetch(
                    key,
                    ttl: CacheTTL.calendarMonth,
                    force: force
                ) {
                    try await client.fetchCalendarMonth(month)
                }
            if let error = result.value.error {
                throw ContentRepositoryError.server(error)
            }
            return result.value
        } catch let error as ContentRepositoryError {
            throw error
        } catch {
            throw ContentRepositoryError.unavailable
        }
    }

    /// slug から単一イベントを取る（`/api/calendar/events/by-slug/[slug]`）。
    /// ログイン済みなら月別APIの horizon（当月〜1年）に縛られないため、
    /// 何ヶ月先でも過去でも取れる（サーバがホライズンの解除を認証で出し分ける）。
    /// 未ログインは Web の `/events/[slug]` と同じ範囲までになる。
    ///
    /// 404 は「そのslugのイベントは公開されていない」であって通信失敗ではないので
    /// `nil` を返す（呼び出し側が空状態を出せるように、通信エラーとは区別する）。
    /// 404 はキャッシュに載せない（公開直後の slug を「無い」で固定しないため。
    /// サーバも 404 には `Cache-Control: no-store` を返す）
    public func fetchEvent(
        slug: String,
        force: Bool = false
    ) async throws -> CalendarEvent? {
        let slug = slug.trimmingCharacters(in: .whitespacesAndNewlines)
        // 空 slug や区切り文字を含む slug は URL を組むと別のルートを指してしまう
        guard !slug.isEmpty, !slug.contains("/") else {
            throw WanspotAPIError.invalidRequest("有効なイベントslugが必要です。")
        }
        let key = "calendar:event:v1:\(slug)"
        do {
            let result: CacheFetchResult<CalendarEventResponse> =
                try await cache.fetch(
                    key,
                    ttl: CacheTTL.calendarEvent,
                    force: force
                ) {
                    try await client.fetchCalendarEvent(slug: slug)
                }
            return result.value.event
        } catch let WanspotAPIError.httpStatus(code, _) where code == 404 {
            return nil
        } catch let error as ContentRepositoryError {
            throw error
        } catch {
            throw ContentRepositoryError.unavailable
        }
    }

    public func fetchNearbySpots(
        eventID: String,
        force: Bool = false
    ) async throws -> [CalendarNearbySpot] {
        let eventID = eventID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard SpotIdentifier.isUUID(eventID) else {
            throw WanspotAPIError.invalidRequest("有効なイベントIDが必要です。")
        }
        let key = "calendar:nearby:v1:\(eventID.lowercased())"
        do {
            let result: CacheFetchResult<CalendarNearbyResponse> =
                try await cache.fetch(
                    key,
                    ttl: CacheTTL.calendarNearby,
                    force: force
                ) {
                    try await client.fetchCalendarNearbySpots(eventID: eventID)
                }
            return result.value.spots.filter { !$0.placeID.isEmpty }
        } catch {
            throw ContentRepositoryError.unavailable
        }
    }
}

public extension WanspotAPIClient {
    func fetchCalendarMonth(
        _ month: CalendarMonth
    ) async throws -> CalendarMonthResponse {
        try await get(
            "/api/calendar/events",
            queryItems: [
                URLQueryItem(name: "year", value: String(month.year)),
                URLQueryItem(name: "month", value: String(month.month)),
            ],
            authenticated: false
        )
    }

    /// slug は日本語を含む（例 `風ぐるまドッグフェス-msd1onhu`）。
    /// `makeURL` の `URLComponents.path` がパス用の percent-encoding を行うので
    /// **生の slug をそのまま渡す**。ここで addingPercentEncoding すると
    /// `%` がさらに `%25` にされて二重エンコードになる
    ///
    /// 月別APIと違って**トークンを載せる**。サーバはホライズン（当月〜1年）の解除を
    /// ログイン済みにだけ許すため、未ログイン扱いで投げると過去・遠い未来のイベントが
    /// 404 になり、「カレンダー未訪問でも・何ヶ月先でも・過去でも詳細が開く」という
    /// この経路の目的が満たせない。AIレビュー本文も全文で返る。
    /// 未ログインのときは `accessTokenProvider` が nil を返し、ヘッダは付かない
    /// （＝従来どおり公開範囲・共有キャッシュのまま）。
    func fetchCalendarEvent(
        slug: String
    ) async throws -> CalendarEventResponse {
        try await get(
            "/api/calendar/events/by-slug/\(slug)",
            authenticated: true
        )
    }

    func fetchCalendarNearbySpots(
        eventID: String
    ) async throws -> CalendarNearbyResponse {
        try await get(
            "/api/calendar/events/\(eventID)/nearby",
            authenticated: false
        )
    }
}
