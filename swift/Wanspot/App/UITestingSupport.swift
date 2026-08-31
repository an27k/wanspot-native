import Foundation
import WanspotKit

struct UITestLaunchOverrides {
    let environment: [String: String]
    let preferences: AppPreferences
    let transport: any HTTPTransport
    let initialGate: AppGate
    let locationSimulation: LocationSessionSimulation
    let deepLink: URL?
    let calendarEvent: CalendarEvent
}

@MainActor
enum UITestBootstrap {
    static func resolve(
        arguments: [String] = ProcessInfo.processInfo.arguments,
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> UITestLaunchOverrides? {
#if DEBUG
        guard
            arguments.contains("--ui-testing"),
            environment["WANSPOT_UI_TESTING"] == "1"
        else {
            return nil
        }

        let scenario = environment["WANSPOT_UI_TEST_SCENARIO"] ?? "authentication"
        let initialGate: AppGate = switch scenario {
        case "authentication":
            .authentication
        case "onboarding":
            .onboarding
        default:
            .main
        }
        let locationSimulation: LocationSessionSimulation =
            scenario == "guest-location-denied" ? .denied : .unavailable

        let runID = environment["WANSPOT_UI_TEST_RUN_ID"]?
            .filter { $0.isLetter || $0.isNumber || $0 == "-" }
            .prefix(80)
        let suiteName = "app.wanspot.native.uitests.\(runID ?? "default")"
        let defaults = UserDefaults(suiteName: suiteName) ?? .standard
        defaults.removePersistentDomain(forName: suiteName)

        var appEnvironment = environment
        appEnvironment["SUPABASE_URL"] = "https://wanspot-ui-tests.invalid"
        appEnvironment["SUPABASE_PUBLISHABLE_KEY"] = "ui-test-public-key"
        appEnvironment["WANSPOT_API_URL"] = "https://wanspot-ui-tests.invalid"
        appEnvironment["WANSPOT_SITE_URL"] = "https://www.wanspot.app"
        appEnvironment["WANSPOT_ADS_ENABLED"] = "false"

        return UITestLaunchOverrides(
            environment: appEnvironment,
            preferences: AppPreferences(defaults: defaults),
            transport: UITestHTTPTransport(),
            initialGate: initialGate,
            locationSimulation: locationSimulation,
            deepLink: environment["WANSPOT_UI_TEST_DEEP_LINK"].flatMap(URL.init),
            calendarEvent: CalendarEvent(
                id: "11111111-1111-4111-8111-111111111111",
                title: "UIテストイベント",
                slug: "ui-test-event",
                description: "愛犬と楽しめる決定的なテストイベントです。",
                venueName: "テスト公園",
                address: "東京都テスト区2-2",
                latitude: 35.6812,
                longitude: 139.7671,
                priceLevel: 0,
                occurrences: [
                    CalendarEventOccurrence(
                        id: "22222222-2222-4222-8222-222222222222",
                        eventID: "11111111-1111-4111-8111-111111111111",
                        startsAt: Date(),
                        isAllDay: false
                    ),
                ],
                tags: [
                    CalendarTag(
                        id: "33333333-3333-4333-8333-333333333333",
                        name: "屋外",
                        slug: "outdoor",
                        color: "#FB6B53",
                        sortOrder: 1
                    ),
                ]
            )
        )
#else
        return nil
#endif
    }
}

#if DEBUG
private actor UITestHTTPTransport: HTTPTransport {
    func send(_ request: URLRequest) async throws -> HTTPTransportResponse {
        guard let url = request.url else {
            return .uiTestJSON(
                #"{"error":"invalid fixture URL"}"#,
                statusCode: 400
            )
        }

        switch url.path {
        case "/api/articles":
            return .uiTestJSON(
                """
                {
                  "articles": [{
                    "id": "ui-test-article-id",
                    "title": "UIテスト記事",
                    "summary": "4つのタブを安全に確認するための記事です。",
                    "slug": "ui-test-article",
                    "category": "general",
                    "theme": "【東京都】おでかけ",
                    "keywords": ["犬連れ"],
                    "linked_spot_refs": ["ui-test-place"],
                    "linked_event_refs": ["11111111-1111-4111-8111-111111111111"]
                  }]
                }
                """
            )
        case "/api/articles/ui-test-article":
            return .uiTestJSON(
                """
                {
                  "article": {
                    "id": "ui-test-article-id",
                    "title": "UIテスト記事",
                    "slug": "ui-test-article",
                    "body": "UIテスト用の決定的な本文です。",
                    "summary": "4つのタブを安全に確認するための記事です。",
                    "keywords": ["犬連れ"],
                    "category": "general",
                    "blocks": [
                      {"type": "heading", "text": "安心しておでかけ"},
                      {"type": "paragraph", "content": "本番の通信やデータは使用していません。"}
                    ],
                    "spot_links": []
                  }
                }
                """
            )
        case "/api/calendar/events":
            return calendarResponse(for: url)
        case let path where path.hasPrefix(Self.calendarBySlugPrefix):
            // 単一イベント取得API。詳細画面は通常 stash 済みの本体で開くが、
            // 外れたときに実ネットワークへ出ないようここでも塞ぐ
            return calendarEventResponse(
                slug: String(path.dropFirst(Self.calendarBySlugPrefix.count))
            )
        case let path where path.hasPrefix("/api/calendar/events/")
            && path.hasSuffix("/nearby"):
            return .uiTestJSON(#"{"spots":[]}"#)
        case "/api/spots/row":
            return .uiTestJSON(
                """
                {
                  "spot": {
                    "place_id": "ui-test-place",
                    "name": "UIテストカフェ",
                    "category": "カフェ",
                    "address": "東京都テスト区1-1",
                    "lat": 35.6812,
                    "lng": 139.7671,
                    "rating": 4.6,
                    "pet_indoor_allowed": true,
                    "pet_policy_evidence": "official",
                    "dog_fact_highlights": ["店内OK"]
                  }
                }
                """
            )
        case "/api/spots/detail":
            return .uiTestJSON(
                """
                {
                  "result": {
                    "name": "UIテストカフェ",
                    "formattedAddress": "東京都テスト区1-1",
                    "lat": 35.6812,
                    "lng": 139.7671,
                    "rating": 4.6,
                    "userRatingsTotal": 24,
                    "types": ["cafe"],
                    "reviews": ["犬連れで安心して過ごせました。"]
                  }
                }
                """
            )
        case "/api/ai-summary":
            return .uiTestJSON(
                #"{"keywords":["店内OK"],"summary":"愛犬と落ち着いて過ごせるカフェです。"}"#
            )
        case "/api/spots/nearby":
            return .uiTestJSON(
                """
                {
                  "spots": [{
                    "place_id": "ui-test-place",
                    "name": "UIテストカフェ",
                    "category": "カフェ",
                    "address": "東京都テスト区1-1",
                    "lat": 35.6812,
                    "lng": 139.7671,
                    "rating": 4.6,
                    "types": ["cafe"],
                    "pet_indoor_allowed": true
                  }]
                }
                """
            )
        case "/v1/forecast":
            return .uiTestJSON(
                #"{"current":{"temperature_2m":22.0,"weather_code":1}}"#
            )
        default:
            return .uiTestJSON(
                #"{"error":{"message":"UIテスト用の応答がありません。"}}"#,
                statusCode: 404
            )
        }
    }

    private static let calendarBySlugPrefix = "/api/calendar/events/by-slug/"

    private func calendarResponse(for url: URL) -> HTTPTransportResponse {
        let items = URLComponents(
            url: url,
            resolvingAgainstBaseURL: false
        )?.queryItems ?? []
        let values = Dictionary(
            uniqueKeysWithValues: items.compactMap { item in
                item.value.map { (item.name, $0) }
            }
        )
        let event = Self.calendarEventJSON(
            year: Int(values["year"] ?? ""),
            month: Int(values["month"] ?? "")
        )
        return .uiTestJSON(
            """
            {
              "events": [\(event)],
              "meta": {"holidays": {}, "inHorizon": true}
            }
            """
        )
    }

    private func calendarEventResponse(
        slug: String
    ) -> HTTPTransportResponse {
        guard slug == "ui-test-event" else {
            return .uiTestJSON(
                #"{"error":"not_found"}"#,
                statusCode: 404
            )
        }
        // 月別APIの events[] の1要素と同じ形（本番の by-slug と同じ契約）
        return .uiTestJSON(
            """
            {"event": \(Self.calendarEventJSON(year: nil, month: nil))}
            """
        )
    }

    private static func calendarEventJSON(year: Int?, month: Int?) -> String {
        let calendar = Calendar(identifier: .gregorian)
        let now = Date()
        let current = calendar.dateComponents([.year, .month, .day], from: now)
        let year = year ?? current.year ?? 2026
        let month = month ?? current.month ?? 1
        let day =
            year == current.year && month == current.month
                ? current.day ?? 1
                : 1
        var dateComponents = DateComponents()
        dateComponents.calendar = calendar
        dateComponents.timeZone = TimeZone(identifier: "Asia/Tokyo")
        dateComponents.year = year
        dateComponents.month = month
        dateComponents.day = day
        dateComponents.hour = 10
        let startsAt = dateComponents.date ?? now
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]

        return """
        {
          "id": "11111111-1111-4111-8111-111111111111",
          "title": "UIテストイベント",
          "slug": "ui-test-event",
          "description": "愛犬と楽しめる決定的なテストイベントです。",
          "venue_name": "テスト公園",
          "address": "東京都テスト区2-2",
          "lat": 35.6812,
          "lng": 139.7671,
          "price_level": 0,
          "occurrences": [{
            "id": "22222222-2222-4222-8222-222222222222",
            "event_id": "11111111-1111-4111-8111-111111111111",
            "starts_at": "\(formatter.string(from: startsAt))",
            "is_all_day": false
          }],
          "tags": [{
            "id": "33333333-3333-4333-8333-333333333333",
            "name": "屋外",
            "slug": "outdoor",
            "color": "#FB6B53",
            "sort_order": 1
          }]
        }
        """
    }
}

private extension HTTPTransportResponse {
    static func uiTestJSON(
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
#endif
