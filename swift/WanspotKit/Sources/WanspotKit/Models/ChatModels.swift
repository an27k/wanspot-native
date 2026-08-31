import Foundation

// SSE契約: クライアントは未知typeを必ず読み飛ばす。将来イベントが増えても
// 壊れないよう、type/code は String・ペイロードは全フィールド Optional で受ける。
public struct ChatSSEEvent: Decodable, Equatable, Sendable {
    // サーバが送る type の既知値。type は String のままにして未知値の
    // 読み飛ばし契約を保ちつつ、消費側が綴りを間違えないようここに集める
    public enum EventType {
        public static let meta = "meta"
        public static let delta = "delta"
        /// ツール実行前の独り言を捨てさせる合図（v6）。ペイロードは持たない。
        /// これを受けたクライアントは、それまでに受け取った本文と
        /// カードを破棄して最終ラウンドの内容だけを残す
        public static let reset = "reset"
        public static let spots = "spots"
        public static let articles = "articles"
        public static let events = "events"
        public static let limit = "limit"
        public static let error = "error"
        public static let done = "done"
    }

    public struct Quota: Decodable, Equatable, Sendable {
        public let remainingToday: Int?

        public init(remainingToday: Int? = nil) {
            self.remainingToday = remainingToday
        }
    }

    public struct Grounding: Decodable, Equatable, Sendable {
        public let evidence: String?
        public let checkedAt: String?
        public let canState: Bool?

        public init(
            evidence: String? = nil,
            checkedAt: String? = nil,
            canState: Bool? = nil
        ) {
            self.evidence = evidence
            self.checkedAt = checkedAt
            self.canState = canState
        }
    }

    // spots イベントのカード1件。placeId/name はサーバ契約上必須だが、
    // 壊れた item でイベント全体を落とさないよう全フィールド Optional で受け、
    // 表示可否（placeId/name の有無）は消費側が判定する。tone も将来値が
    // 増えても壊れないよう String のまま持つ
    public struct SpotCard: Decodable, Equatable, Sendable {
        public let placeID: String?
        public let name: String?
        public let category: String?
        public let distanceM: Double?
        public let rating: Double?
        public let label: String?
        public let tone: String?
        public let photoURL: String?
        public let comment: String?

        public init(
            placeID: String? = nil,
            name: String? = nil,
            category: String? = nil,
            distanceM: Double? = nil,
            rating: Double? = nil,
            label: String? = nil,
            tone: String? = nil,
            photoURL: String? = nil,
            comment: String? = nil
        ) {
            self.placeID = placeID
            self.name = name
            self.category = category
            self.distanceM = distanceM
            self.rating = rating
            self.label = label
            self.tone = tone
            self.photoURL = photoURL
            self.comment = comment
        }

        private enum CodingKeys: String, CodingKey {
            case placeID = "placeId"
            case name
            case category
            case distanceM
            case rating
            case label
            case tone
            case photoURL = "photoUrl"
            case comment
        }
    }

    // articles イベントのカード1件。articleId/title はサーバ契約上必須だが、
    // SpotCard と同じ理由で全フィールド Optional で受け、表示可否は消費側が判定する
    public struct ArticleCard: Decodable, Equatable, Sendable {
        public let articleID: String?
        public let title: String?
        public let category: String?
        public let summary: String?
        public let comment: String?

        public init(
            articleID: String? = nil,
            title: String? = nil,
            category: String? = nil,
            summary: String? = nil,
            comment: String? = nil
        ) {
            self.articleID = articleID
            self.title = title
            self.category = category
            self.summary = summary
            self.comment = comment
        }

        private enum CodingKeys: String, CodingKey {
            case articleID = "articleId"
            case title
            case category
            case summary
            case comment
        }
    }

    // events イベントのカード1件。eventId/title 必須（表示可否は消費側判定）
    public struct EventCard: Decodable, Equatable, Sendable {
        public let eventID: String?
        // calendar_events.slug（v7）。値が無い行はサーバがキーごと落とすため
        // 「キーがある＝カレンダー詳細の slug 経路に直接乗せられる」と読んでよい。
        // 旧サーバ（v6以下）は送ってこないので Optional のまま扱う
        public let slug: String?
        public let title: String?
        public let schedule: String?
        public let venueName: String?
        public let priceText: String?
        public let comment: String?

        public init(
            eventID: String? = nil,
            slug: String? = nil,
            title: String? = nil,
            schedule: String? = nil,
            venueName: String? = nil,
            priceText: String? = nil,
            comment: String? = nil
        ) {
            self.eventID = eventID
            self.slug = slug
            self.title = title
            self.schedule = schedule
            self.venueName = venueName
            self.priceText = priceText
            self.comment = comment
        }

        private enum CodingKeys: String, CodingKey {
            case eventID = "eventId"
            case slug
            case title
            case schedule
            case venueName
            case priceText
            case comment
        }
    }

    public let type: String?
    public let quota: Quota?
    public let grounding: Grounding?
    public let text: String?
    public let code: String?
    public let resetAt: String?
    public let turnID: String?
    public let items: [SpotCard]?
    public let articleItems: [ArticleCard]?
    public let eventItems: [EventCard]?

    public init(
        type: String? = nil,
        quota: Quota? = nil,
        grounding: Grounding? = nil,
        text: String? = nil,
        code: String? = nil,
        resetAt: String? = nil,
        turnID: String? = nil,
        items: [SpotCard]? = nil,
        articleItems: [ArticleCard]? = nil,
        eventItems: [EventCard]? = nil
    ) {
        self.type = type
        self.quota = quota
        self.grounding = grounding
        self.text = text
        self.code = code
        self.resetAt = resetAt
        self.turnID = turnID
        self.items = items
        self.articleItems = articleItems
        self.eventItems = eventItems
    }

    private enum CodingKeys: String, CodingKey {
        case type
        case quota
        case grounding
        case text
        case code
        case resetAt
        case turnID = "turnId"
        case items
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decodeIfPresent(String.self, forKey: .type)
        self.type = type
        quota = try container.decodeIfPresent(Quota.self, forKey: .quota)
        grounding = try container.decodeIfPresent(
            Grounding.self,
            forKey: .grounding
        )
        text = try container.decodeIfPresent(String.self, forKey: .text)
        code = try container.decodeIfPresent(String.self, forKey: .code)
        resetAt = try container.decodeIfPresent(String.self, forKey: .resetAt)
        turnID = try container.decodeIfPresent(String.self, forKey: .turnID)

        // items は type ごとに形が違う（spots/articles/events）。宣言 type に
        // 合う形だけを decode し、壊れた items でイベント全体を落とさない
        switch type {
        case EventType.spots:
            items = (try? container.decodeIfPresent(
                [SpotCard].self,
                forKey: .items
            )) ?? nil
            articleItems = nil
            eventItems = nil
        case EventType.articles:
            articleItems = (try? container.decodeIfPresent(
                [ArticleCard].self,
                forKey: .items
            )) ?? nil
            eventItems = nil
            items = nil
        case EventType.events:
            eventItems = (try? container.decodeIfPresent(
                [EventCard].self,
                forKey: .items
            )) ?? nil
            articleItems = nil
            items = nil
        default:
            // items を持たないイベント（meta/delta/reset/limit/error/done）と
            // 未知の将来イベント。カード列として解釈しない
            items = nil
            articleItems = nil
            eventItems = nil
        }
    }
}

public struct ChatContext: Encodable, Equatable, Sendable {
    public let screen: String
    public let placeID: String?
    public let latitude: Double?
    public let longitude: Double?
    public let radiusMeters: Int?
    public let eventID: String?
    public let articleID: String?

    public init(
        screen: String,
        placeID: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        radiusMeters: Int? = nil,
        eventID: String? = nil,
        articleID: String? = nil
    ) {
        self.screen = screen
        self.placeID = placeID
        self.latitude = latitude
        self.longitude = longitude
        self.radiusMeters = radiusMeters
        self.eventID = eventID
        self.articleID = articleID
    }

    private enum CodingKeys: String, CodingKey {
        case screen
        case placeID = "placeId"
        case latitude = "lat"
        case longitude = "lng"
        case radiusMeters = "radiusM"
        case eventID = "eventId"
        case articleID = "articleId"
    }
}

public struct ChatRequest: Encodable, Equatable, Sendable {
    public struct Message: Encodable, Equatable, Sendable {
        public enum Role: String, Encodable, Equatable, Sendable {
            case user
            case assistant
        }

        public let role: Role
        public let content: String

        public init(role: Role, content: String) {
            self.role = role
            self.content = content
        }
    }

    public let messages: [Message]
    public let context: ChatContext
    public let dogID: String?

    public init(
        messages: [Message],
        context: ChatContext,
        dogID: String? = nil
    ) {
        self.messages = messages
        self.context = context
        self.dogID = dogID
    }

    private enum CodingKeys: String, CodingKey {
        case messages
        case context
        case dogID = "dogId"
    }
}

// GET /api/chat/history の1件。カードは復元しない契約（spots/articles/events は
// 保存していない）ため、戻るのは本文だけ。既存の会話モデルにそのまま流し込める
public struct ChatHistoryMessage: Equatable, Sendable {
    // 現状サーバが返すのは user / assistant のみ。SSE の type と同じく
    // 未知値は読み飛ばす契約なので、ここに無い role の行は fetchHistory が落とす
    public enum Role: String, Equatable, Sendable {
        case user
        case assistant
    }

    // chat_messages.id。復元表示には使わないが、サーバ側の行を指す識別子として持つ
    public let id: String?
    public let role: Role
    public let content: String
    // ISO8601（サーバ側でミリ秒3桁 + Z に正規化済み）。並びは created_at 昇順で
    // サーバが保証するため、クライアントでは並べ替えに使わずそのまま持つだけ
    public let createdAt: String?

    public init(
        id: String? = nil,
        role: Role,
        content: String,
        createdAt: String? = nil
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.createdAt = createdAt
    }
}

// GET /api/chat/history の生応答。壊れた1行で応答全体を落とさないよう
// SpotCard 等と同じく全フィールドを Optional で受け、選別は fetchHistory が行う
struct ChatHistoryWireResponse: Decodable, Sendable {
    struct Message: Decodable, Sendable {
        let id: String?
        let role: String?
        let content: String?
        let createdAt: String?
    }

    let messages: [Message]?
}

extension ChatHistoryMessage {
    // 未知 role・本文が空の行は落とす（SSE の未知type読み飛ばしと同じ流儀）
    init?(wire: ChatHistoryWireResponse.Message) {
        guard
            let role = wire.role.flatMap(Role.init(rawValue:)),
            let content = wire.content,
            !content.isEmpty
        else {
            return nil
        }
        self.init(
            id: wire.id,
            role: role,
            content: content,
            createdAt: wire.createdAt
        )
    }
}
