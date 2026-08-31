import Foundation
import XCTest

@testable import WanspotKit

final class ChatModelsTests: XCTestCase {
    func testDecodesMetaEventLine() throws {
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: """
                data: {"type":"meta","quota":{"remainingToday":18},\
                "grounding":{"evidence":"official",\
                "checkedAt":"2026-08-30T00:00:00+09:00","canState":true}}
                """
            )
        )
        XCTAssertEqual(event.type, "meta")
        XCTAssertEqual(event.quota?.remainingToday, 18)
        XCTAssertEqual(event.grounding?.evidence, "official")
        XCTAssertEqual(
            event.grounding?.checkedAt,
            "2026-08-30T00:00:00+09:00"
        )
        XCTAssertEqual(event.grounding?.canState, true)
    }

    func testDecodesMetaEventLineWithoutGrounding() throws {
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: #"data: {"type":"meta","quota":{"remainingToday":3}}"#
            )
        )
        XCTAssertEqual(event.type, "meta")
        XCTAssertEqual(event.quota?.remainingToday, 3)
        XCTAssertNil(event.grounding)
    }

    func testDecodesDeltaEventLine() throws {
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: #"data: {"type":"delta","text":"はい、テラス席は"}"#
            )
        )
        XCTAssertEqual(event.type, "delta")
        XCTAssertEqual(event.text, "はい、テラス席は")
    }

    func testDecodesLimitEventLine() throws {
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: """
                data: {"type":"limit","code":"daily_quota",\
                "resetAt":"2026-08-31T00:00:00+09:00"}
                """
            )
        )
        XCTAssertEqual(event.type, "limit")
        XCTAssertEqual(event.code, "daily_quota")
        XCTAssertEqual(event.resetAt, "2026-08-31T00:00:00+09:00")
    }

    func testDecodesErrorEventLine() throws {
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: #"data: {"type":"error","code":"internal_error"}"#
            )
        )
        XCTAssertEqual(event.type, "error")
        XCTAssertEqual(event.code, "internal_error")
        XCTAssertNil(event.resetAt)
    }

    func testDecodesDoneEventLine() throws {
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: #"data: {"type":"done","turnId":"turn-1"}"#
            )
        )
        XCTAssertEqual(event.type, "done")
        XCTAssertEqual(event.turnID, "turn-1")
    }

    func testDecodesResetEventLine() throws {
        // v6: ツール実行前の独り言を捨てさせる合図。ペイロードなしで届く
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(fromLine: #"data: {"type":"reset"}"#)
        )
        XCTAssertEqual(event.type, ChatSSEEvent.EventType.reset)
        XCTAssertEqual(event.type, "reset")
        XCTAssertNil(event.text)
        XCTAssertNil(event.code)
        XCTAssertNil(event.quota)
        XCTAssertNil(event.grounding)
        XCTAssertNil(event.turnID)
        XCTAssertNil(event.items)
        XCTAssertNil(event.articleItems)
        XCTAssertNil(event.eventItems)
    }

    func testDecodesResetEventLineWithUnexpectedPayload() throws {
        // 将来 reset にフィールドが足されても decode が落ちず、
        // カード列としては解釈しないこと（破棄の合図以上の意味を持たせない）
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: """
                data: {"type":"reset","round":2,\
                "items":[{"placeId":"place-1","name":"カフェ"}]}
                """
            )
        )
        XCTAssertEqual(event.type, "reset")
        XCTAssertNil(event.items)
        XCTAssertNil(event.articleItems)
        XCTAssertNil(event.eventItems)
    }

    func testDecodesSpotsEventLine() throws {
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: """
                data: {"type":"spots","items":[{"placeId":"place-1",\
                "name":"テラスカフェ","category":"カフェ","distanceM":450,\
                "rating":4.3,"label":"店内 同伴可","tone":"confirmed",\
                "photoUrl":"https://www.wanspot.app/api/spots/photo?ref=a&w=240",\
                "comment":"店内OKと公式サイトに記載があります"}]}
                """
            )
        )
        XCTAssertEqual(event.type, "spots")
        let items = try XCTUnwrap(event.items)
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].placeID, "place-1")
        XCTAssertEqual(items[0].name, "テラスカフェ")
        XCTAssertEqual(items[0].category, "カフェ")
        XCTAssertEqual(items[0].distanceM, 450)
        XCTAssertEqual(items[0].rating, 4.3)
        XCTAssertEqual(items[0].label, "店内 同伴可")
        XCTAssertEqual(items[0].tone, "confirmed")
        XCTAssertEqual(
            items[0].photoURL,
            "https://www.wanspot.app/api/spots/photo?ref=a&w=240"
        )
        XCTAssertEqual(items[0].comment, "店内OKと公式サイトに記載があります")
    }

    func testDecodesSpotCardInstagramID() throws {
        // instagramId は「キーがある行だけ」導線を出す契約。
        // キー欠損の行と混在しても両方 decode でき、欠損側は nil のままであること
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: """
                data: {"type":"spots","items":[\
                {"placeId":"place-1","name":"テラスカフェ",\
                "label":"店内 同伴可","tone":"confirmed",\
                "instagramId":"terrace_cafe"},\
                {"placeId":"place-2","name":"公園","tone":"weak"}]}
                """
            )
        )
        let items = try XCTUnwrap(event.items)
        XCTAssertEqual(items.count, 2)
        XCTAssertEqual(items[0].instagramID, "terrace_cafe")
        // 旧サーバ／値の無い行はキーごと来ない＝アイコンを出さない
        XCTAssertNil(items[1].instagramID)
    }

    func testDecodesSpotsEventLineWithoutItems() throws {
        // items 欠損でもイベント自体は decode でき、消費側が空扱いにできること
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(fromLine: #"data: {"type":"spots"}"#)
        )
        XCTAssertEqual(event.type, "spots")
        XCTAssertNil(event.items)
    }

    func testDecodesSpotCardWithUnknownToneAndMissingFields() throws {
        // tone は String のまま受けるため未知値でも decode が落ちないこと。
        // photoUrl の明示 null・任意フィールド欠損も同様
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: """
                data: {"type":"spots","items":[\
                {"placeId":"place-1","name":"ドッグラン",\
                "label":"推定・要確認","tone":"verified_v2"},\
                {"placeId":"place-2","name":"公園","tone":"weak",\
                "photoUrl":null}]}
                """
            )
        )
        let items = try XCTUnwrap(event.items)
        XCTAssertEqual(items.count, 2)
        XCTAssertEqual(items[0].tone, "verified_v2")
        XCTAssertNil(items[0].category)
        XCTAssertNil(items[0].distanceM)
        XCTAssertNil(items[0].rating)
        XCTAssertNil(items[0].photoURL)
        XCTAssertNil(items[0].comment)
        XCTAssertEqual(items[1].tone, "weak")
        XCTAssertNil(items[1].photoURL)
    }

    func testDecodesArticlesEventLine() throws {
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: """
                data: {"type":"articles","items":[{"articleId":"article-1",\
                "title":"雨の日でも楽しめるドッグカフェ特集",\
                "category":"おでかけ","summary":"屋内で過ごせるカフェを集めました",\
                "comment":"雨の日の行き先ならこの特集が参考になります"}]}
                """
            )
        )
        XCTAssertEqual(event.type, "articles")
        let items = try XCTUnwrap(event.articleItems)
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].articleID, "article-1")
        XCTAssertEqual(items[0].title, "雨の日でも楽しめるドッグカフェ特集")
        XCTAssertEqual(items[0].category, "おでかけ")
        XCTAssertEqual(items[0].summary, "屋内で過ごせるカフェを集めました")
        XCTAssertEqual(items[0].comment, "雨の日の行き先ならこの特集が参考になります")
        // articles の items がスポットカードとして混ざらないこと
        XCTAssertNil(event.items)
        XCTAssertNil(event.eventItems)
    }

    func testDecodesArticleCardWithMissingAndUnknownKeys() throws {
        // 任意フィールド欠損・未知キーがあっても decode が落ちないこと
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: """
                data: {"type":"articles","items":[\
                {"articleId":"article-1","title":"特集",\
                "heroImage":"https://example.com/x.png","rank":1},\
                {"comment":"タイトル欠損でも decode 自体は通る"}]}
                """
            )
        )
        let items = try XCTUnwrap(event.articleItems)
        XCTAssertEqual(items.count, 2)
        XCTAssertEqual(items[0].articleID, "article-1")
        XCTAssertNil(items[0].category)
        XCTAssertNil(items[0].summary)
        XCTAssertNil(items[0].comment)
        XCTAssertNil(items[1].articleID)
        XCTAssertNil(items[1].title)
        XCTAssertEqual(items[1].comment, "タイトル欠損でも decode 自体は通る")
    }

    func testDecodesArticlesEventLineWithoutItems() throws {
        // items 欠損でもイベント自体は decode でき、消費側が空扱いにできること
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(fromLine: #"data: {"type":"articles"}"#)
        )
        XCTAssertEqual(event.type, "articles")
        XCTAssertNil(event.articleItems)
    }

    func testDecodesEventsEventLine() throws {
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: """
                data: {"type":"events","items":[{"eventId":"event-1",\
                "slug":"wanko-ennichi",\
                "title":"わんこ縁日","schedule":"9/6(土) 10:00〜16:00",\
                "venueName":"駒沢公園","priceText":"入場無料",\
                "comment":"犬連れで参加できる週末イベントです"}]}
                """
            )
        )
        XCTAssertEqual(event.type, "events")
        let items = try XCTUnwrap(event.eventItems)
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].eventID, "event-1")
        XCTAssertEqual(items[0].slug, "wanko-ennichi")
        XCTAssertEqual(items[0].title, "わんこ縁日")
        XCTAssertEqual(items[0].schedule, "9/6(土) 10:00〜16:00")
        XCTAssertEqual(items[0].venueName, "駒沢公園")
        XCTAssertEqual(items[0].priceText, "入場無料")
        XCTAssertEqual(items[0].comment, "犬連れで参加できる週末イベントです")
        // events の items がスポット/記事カードとして混ざらないこと
        XCTAssertNil(event.items)
        XCTAssertNil(event.articleItems)
    }

    func testDecodesEventCardWithoutSlugKey() throws {
        // v7 のサーバは slug が無い行では「キーごと」落とす（null は送らない）。
        // v6 以下のサーバも slug を送らないため、どちらも同じ nil に落ちること
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: """
                data: {"type":"events","items":[\
                {"eventId":"event-1","title":"わんこ縁日","comment":"一言"},\
                {"eventId":"event-2","slug":null,"title":"マルシェ",\
                "comment":"一言"}]}
                """
            )
        )
        let items = try XCTUnwrap(event.eventItems)
        XCTAssertEqual(items.count, 2)
        // キー欠落
        XCTAssertNil(items[0].slug)
        // 契約外だが null が来ても落ちない（耐性デコード）
        XCTAssertNil(items[1].slug)
        XCTAssertEqual(items[1].title, "マルシェ")
    }

    func testDecodesEventCardWithMissingAndUnknownKeys() throws {
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: """
                data: {"type":"events","items":[\
                {"eventId":"event-1","title":"マルシェ",\
                "ticketUrl":"https://example.com","capacity":100},\
                {"schedule":"9/7(日)","venueName":null}]}
                """
            )
        )
        let items = try XCTUnwrap(event.eventItems)
        XCTAssertEqual(items.count, 2)
        XCTAssertEqual(items[0].eventID, "event-1")
        XCTAssertNil(items[0].schedule)
        XCTAssertNil(items[0].venueName)
        XCTAssertNil(items[0].priceText)
        XCTAssertNil(items[0].comment)
        XCTAssertNil(items[1].eventID)
        XCTAssertNil(items[1].title)
        XCTAssertEqual(items[1].schedule, "9/7(日)")
        XCTAssertNil(items[1].venueName)
    }

    func testDecodesEventsEventLineWithoutItems() throws {
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(fromLine: #"data: {"type":"events"}"#)
        )
        XCTAssertEqual(event.type, "events")
        XCTAssertNil(event.eventItems)
    }

    func testKeepsEventDecodableWhenItemsHasUnexpectedShape() throws {
        // items がカード配列でない形で来ても、イベント全体を落とさず
        // items だけを空扱いにできること（未知typeのカード系イベントも同様）
        let broken = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: #"data: {"type":"articles","items":"none"}"#
            )
        )
        XCTAssertEqual(broken.type, "articles")
        XCTAssertNil(broken.articleItems)

        let future = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: #"data: {"type":"stamps","items":[1,2,3]}"#
            )
        )
        XCTAssertEqual(future.type, "stamps")
        XCTAssertNil(future.items)
        XCTAssertNil(future.articleItems)
        XCTAssertNil(future.eventItems)
    }

    func testKeepsUnknownEventTypeDecodableForSkipping() throws {
        // 将来イベント（例: action_proposal）が来ても
        // デコード自体は成功し、消費側が type で読み飛ばせること
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: """
                data: {"type":"action_proposal",\
                "proposal":{"kind":"booking","spot":"spot-1"}}
                """
            )
        )
        XCTAssertEqual(event.type, "action_proposal")
        XCTAssertNil(event.text)
        XCTAssertNil(event.code)
        XCTAssertNil(event.quota)
        XCTAssertNil(event.turnID)
    }

    func testSkipsBrokenJSONLine() {
        XCTAssertNil(
            ChatAPIClient.decodeEvent(
                fromLine: #"data: {"type":"delta","text":"途中で切れ"#
            )
        )
        XCTAssertNil(
            ChatAPIClient.decodeEvent(fromLine: "data: [1, 2, 3]")
        )
    }

    func testSkipsNonDataLines() {
        XCTAssertNil(ChatAPIClient.decodeEvent(fromLine: ""))
        XCTAssertNil(ChatAPIClient.decodeEvent(fromLine: ": keep-alive"))
        XCTAssertNil(
            ChatAPIClient.decodeEvent(fromLine: "event: message")
        )
        XCTAssertNil(ChatAPIClient.decodeEvent(fromLine: "data:"))
    }

    func testDecodesDataLineWithoutSpaceAfterColon() throws {
        let event = try XCTUnwrap(
            ChatAPIClient.decodeEvent(
                fromLine: #"data:{"type":"delta","text":"OK"}"#
            )
        )
        XCTAssertEqual(event.type, "delta")
        XCTAssertEqual(event.text, "OK")
    }

    func testEncodesChatRequestWithContractKeys() throws {
        let request = ChatRequest(
            messages: [
                ChatRequest.Message(role: .user, content: "店内に入れる？"),
                ChatRequest.Message(role: .assistant, content: "はい、入れます。"),
            ],
            context: ChatContext(
                screen: "spot_detail",
                placeID: "place-1",
                latitude: 35.6,
                longitude: 139.7,
                radiusMeters: 1200,
                eventID: "event-1",
                articleID: "article-1"
            ),
            dogID: "dog-1"
        )

        let data = try JSONEncoder().encode(request)
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )

        let messages = try XCTUnwrap(json["messages"] as? [[String: Any]])
        XCTAssertEqual(messages.count, 2)
        XCTAssertEqual(messages[0]["role"] as? String, "user")
        XCTAssertEqual(messages[0]["content"] as? String, "店内に入れる？")
        XCTAssertEqual(messages[1]["role"] as? String, "assistant")

        let context = try XCTUnwrap(json["context"] as? [String: Any])
        XCTAssertEqual(context["screen"] as? String, "spot_detail")
        XCTAssertEqual(context["placeId"] as? String, "place-1")
        XCTAssertEqual(context["lat"] as? Double, 35.6)
        XCTAssertEqual(context["lng"] as? Double, 139.7)
        XCTAssertEqual(context["radiusM"] as? Int, 1200)
        XCTAssertEqual(context["eventId"] as? String, "event-1")
        XCTAssertEqual(context["articleId"] as? String, "article-1")

        XCTAssertEqual(json["dogId"] as? String, "dog-1")
    }

    func testOmitsAbsentOptionalFieldsFromChatRequest() throws {
        let request = ChatRequest(
            messages: [ChatRequest.Message(role: .user, content: "こんにちは")],
            context: ChatContext(screen: "mypage")
        )

        let data = try JSONEncoder().encode(request)
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )

        XCTAssertNil(json["dogId"])
        let context = try XCTUnwrap(json["context"] as? [String: Any])
        XCTAssertEqual(context["screen"] as? String, "mypage")
        XCTAssertNil(context["placeId"])
        XCTAssertNil(context["lat"])
        XCTAssertNil(context["lng"])
        XCTAssertNil(context["radiusM"])
        XCTAssertNil(context["eventId"])
        XCTAssertNil(context["articleId"])
    }

    // MARK: - GET /api/chat/history

    func testFetchHistoryDecodesRecentSessionMessages() async throws {
        // BEが実際にルートを叩いて取得した応答そのまま
        let transport = StubChatTransport(
            responses: [
                .json(
                    """
                    {
                      "messages": [
                        {
                          "id": "9f1c2a54-6a3b-4a2e-9f0e-1b7c4d2e8a31",
                          "role": "user",
                          "content": "このへんでテラス席がある犬OKのカフェある？",
                          "createdAt": "2026-08-31T02:14:07.312Z"
                        },
                        {
                          "id": "c0a8e1d2-77b4-4f61-8d3a-52e9b6f0c144",
                          "role": "assistant",
                          "content": "テラス席で一緒に過ごせるお店が2軒ありました。\\n\\n※Web検索の情報を含みます（未確認）",
                          "createdAt": "2026-08-31T02:14:07.312Z"
                        }
                      ]
                    }
                    """
                ),
            ]
        )
        let client = try makeClient(transport: transport)

        let messages = await client.fetchHistory()

        XCTAssertEqual(messages.count, 2)
        XCTAssertEqual(messages[0].role, .user)
        XCTAssertEqual(
            messages[0].id,
            "9f1c2a54-6a3b-4a2e-9f0e-1b7c4d2e8a31"
        )
        XCTAssertEqual(
            messages[0].content,
            "このへんでテラス席がある犬OKのカフェある？"
        )
        XCTAssertEqual(messages[0].createdAt, "2026-08-31T02:14:07.312Z")
        // 同一ターンは必ず user → assistant。サーバの順をそのまま保つ
        XCTAssertEqual(messages[1].role, .assistant)
        // 保存時点の注意書きフッター込みの本文が改行ごと戻る
        XCTAssertTrue(
            messages[1].content.contains("\n\n※Web検索の情報を含みます（未確認）")
        )

        let recordedRequest = await transport.lastRequest()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(request.url?.path, "/api/chat/history")
        XCTAssertNil(request.url?.query)
        XCTAssertNil(request.httpBody)
        XCTAssertEqual(
            request.value(forHTTPHeaderField: "Authorization"),
            "Bearer test-token"
        )
        XCTAssertEqual(
            request.timeoutInterval,
            WanspotAPIClient.defaultTimeout
        )
    }

    func testFetchHistoryReturnsEmptyWhenNoConversation() async throws {
        // セッション無し / 24時間より古いセッションはこの形で返る
        let transport = StubChatTransport(
            responses: [.json(#"{"messages":[]}"#)]
        )
        let client = try makeClient(transport: transport)

        let messages = await client.fetchHistory()

        XCTAssertTrue(messages.isEmpty)
        let requestCount = await transport.requestCount()
        XCTAssertEqual(requestCount, 1)
    }

    func testFetchHistorySkipsUnknownRolesAndBrokenRows() async throws {
        let transport = StubChatTransport(
            responses: [
                .json(
                    """
                    {
                      "messages": [
                        {"id": "1", "role": "user", "content": "こんにちは",
                         "createdAt": "2026-08-31T02:14:07.312Z"},
                        {"id": "2", "role": "system", "content": "内部指示",
                         "createdAt": "2026-08-31T02:14:07.313Z"},
                        {"id": "3", "role": "tool", "content": "ツール出力",
                         "createdAt": "2026-08-31T02:14:07.314Z"},
                        {"id": "4", "content": "roleが無い行",
                         "createdAt": "2026-08-31T02:14:07.315Z"},
                        {"id": "5", "role": "assistant",
                         "createdAt": "2026-08-31T02:14:07.316Z"},
                        {"id": "6", "role": "assistant", "content": "",
                         "createdAt": "2026-08-31T02:14:07.317Z"},
                        {"role": "assistant", "content": "こんにちは！"}
                      ]
                    }
                    """
                ),
            ]
        )
        let client = try makeClient(transport: transport)

        let messages = await client.fetchHistory()

        // 未知role・role欠損・本文欠損/空だけが落ち、残りは順序を保つ
        XCTAssertEqual(messages.map(\.content), ["こんにちは", "こんにちは！"])
        XCTAssertEqual(messages.map(\.role), [.user, .assistant])
        // id / createdAt を持たない行も本文があれば復元できる
        XCTAssertNil(messages[1].id)
        XCTAssertNil(messages[1].createdAt)
    }

    func testFetchHistoryReturnsEmptyForUnauthorized() async throws {
        let transport = StubChatTransport(
            responses: [
                .json(#"{"error":"Unauthorized"}"#, statusCode: 401),
            ]
        )
        let client = try makeClient(transport: transport)

        let messages = await client.fetchHistory()

        XCTAssertTrue(messages.isEmpty)
    }

    func testFetchHistoryReturnsEmptyForRateLimitedAndServerError() async throws {
        // 200以外はすべて「復元しない」で握りつぶす契約
        for response in [
            HTTPTransportResponse.json(#"{"error":"rate_limited"}"#, statusCode: 429),
            HTTPTransportResponse.json(#"{"error":"internal_error"}"#, statusCode: 500),
            HTTPTransportResponse.json(
                #"{"ok":false,"error":"auth_unavailable"}"#,
                statusCode: 503
            ),
        ] {
            let transport = StubChatTransport(responses: [response])
            let client = try makeClient(transport: transport)

            let messages = await client.fetchHistory()

            XCTAssertTrue(messages.isEmpty)
        }
    }

    func testFetchHistoryReturnsEmptyWhenTransportFails() async throws {
        let client = try makeClient(
            transport: FailingChatTransport(code: .notConnectedToInternet)
        )

        let messages = await client.fetchHistory()

        XCTAssertTrue(messages.isEmpty)
    }

    func testFetchHistoryReturnsEmptyForMalformedBody() async throws {
        let transport = StubChatTransport(
            responses: [.json("not json at all")]
        )
        let client = try makeClient(transport: transport)

        let messages = await client.fetchHistory()

        XCTAssertTrue(messages.isEmpty)
    }

    func testFetchHistorySkipsRequestWithoutAccessToken() async throws {
        let transport = StubChatTransport(
            responses: [.json(#"{"messages":[]}"#)]
        )
        let client = ChatAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://www.wanspot.app")),
            transport: transport,
            accessTokenProvider: { nil }
        )

        let messages = await client.fetchHistory()

        XCTAssertTrue(messages.isEmpty)
        // 確実に401になるので通信自体を行わない
        let requestCount = await transport.requestCount()
        XCTAssertEqual(requestCount, 0)
    }

    private func makeClient(
        transport: any HTTPTransport
    ) throws -> ChatAPIClient {
        ChatAPIClient(
            baseURL: try XCTUnwrap(URL(string: "https://www.wanspot.app")),
            transport: transport,
            accessTokenProvider: { "test-token" }
        )
    }
}

private actor StubChatTransport: HTTPTransport {
    private var responses: [HTTPTransportResponse]
    private var requests: [URLRequest] = []

    init(responses: [HTTPTransportResponse]) {
        self.responses = responses
    }

    func send(_ request: URLRequest) async throws -> HTTPTransportResponse {
        requests.append(request)
        guard !responses.isEmpty else {
            throw StubChatTransportError.missingResponse
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

private enum StubChatTransportError: Error {
    case missingResponse
}

private struct FailingChatTransport: HTTPTransport {
    let code: URLError.Code

    func send(_ request: URLRequest) async throws -> HTTPTransportResponse {
        throw URLError(code)
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
