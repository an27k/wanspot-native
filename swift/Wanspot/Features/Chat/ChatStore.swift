import Foundation
import Observation
import WanspotKit

// チャットは全画面共通の「ワンスポAI」1本で、画面差はサブタイトルの文脈名と
// サジェスト質問チップにのみ現れる（ヘッダー固定・会話は切り替えない設計判断）。
// 送信時に添える context はこの型が画面ごとに組み立てる。
struct ChatScreenContext: Equatable {
    let context: ChatContext
    // ヘッダーの「いま見ている: <文脈名>」用。文脈と呼べる画面がない
    // マイページ等は nil にしてサブタイトル自体を出さない
    let displayName: String?
    let suggestions: [String]

    // SpotDetail の読み込み完了前は placeId 抜きで立てておき、読み込み後に上書きする
    static func spotDetail(_ detail: SpotDetail?) -> ChatScreenContext {
        ChatScreenContext(
            context: ChatContext(
                screen: "spot_detail",
                placeID: detail?.placeID
            ),
            displayName: detail?.name ?? "このスポット",
            suggestions: ["店内に入れる？", "駐車場はある？", "大型犬でもOK？"]
        )
    }

    static func tab(
        _ tab: AppTab,
        latitude: Double? = nil,
        longitude: Double? = nil
    ) -> ChatScreenContext {
        switch tab {
        case .search:
            ChatScreenContext(
                context: ChatContext(
                    screen: "search",
                    latitude: latitude,
                    longitude: longitude,
                    // 現在地があるときだけ既存 nearby の初段と同じ半径を添える
                    radiusMeters: latitude == nil ? nil : 3_000
                ),
                displayName: "検索タブ",
                suggestions: ["テラスOKのカフェ", "ドッグラン", "雨でもOK"]
            )
        case .articles:
            ChatScreenContext(
                context: ChatContext(screen: "articles"),
                displayName: "まとめタブ",
                suggestions: [
                    "おすすめの特集は？",
                    "雨の日のおでかけ先",
                    "はじめてのドッグカフェ",
                ]
            )
        case .calendar:
            ChatScreenContext(
                context: ChatContext(screen: "calendar"),
                displayName: "カレンダータブ",
                suggestions: [
                    "犬連れで参加できるイベントは？",
                    "今週末のイベント",
                    "近くのイベント",
                ]
            )
        case .mypage:
            ChatScreenContext(
                context: ChatContext(screen: "mypage"),
                displayName: nil,
                suggestions: [
                    "次のおでかけ先を相談",
                    "テラスOKのカフェ",
                    "雨の日の過ごし方",
                ]
            )
        }
    }
}

@MainActor
@Observable
final class ChatStore {
    struct Message: Identifiable, Equatable {
        enum Role: Equatable {
            case user
            case assistant
        }

        let id = UUID()
        let role: Role
        var text: String
        var grounding: ChatSSEEvent.Grounding?
        // spots/articles/events イベントで届いたカード列。
        // 応答本文と同じターンに付随させて表示する
        var spots: [ChatSSEEvent.SpotCard] = []
        var articles: [ChatSSEEvent.ArticleCard] = []
        var events: [ChatSSEEvent.EventCard] = []
    }

    enum LimitState: Equatable {
        case dailyQuota
        case busy
        case rateLimited
    }

    // 契約: 1メッセージ500字・履歴10往復（20メッセージ）。超過分はクライアント側でも切り詰める
    static let maxMessageLength = 500
    private static let maxHistoryMessages = 20

    private static let genericErrorMessage =
        "回答を取得できませんでした。時間をおいてお試しください。"

    private(set) var messages: [Message] = []
    private(set) var streamingText: String?
    private(set) var quotaRemaining: Int?
    private(set) var limitState: LimitState?
    private(set) var sendError: String?
    var draft = ""

    @ObservationIgnored private var streamTask: Task<Void, Never>?
    // 会話クリア・再送で進む世代番号。打ち切った古いストリームの後片付けが
    // 新しい会話に混ざらないよう、状態を触る前に必ず突き合わせる
    @ObservationIgnored private var streamGeneration = 0
    // サーバからの復元をアプリ起動につき1回に絞るフラグ。失敗しても寝かせたまま
    // （再試行は次回起動でよい契約）。会話クリアでは戻さない ―― 戻すと
    // 「クリアしたのに開き直すと戻ってくる」ことになる
    @ObservationIgnored private var hasAttemptedRestore = false

    var isStreaming: Bool {
        streamingText != nil
    }

    // チャットシートを初めて開いたときに、サーバの直近セッション（24時間以内）から
    // 会話を復元する。アプリ起動につき1回だけ試み、失敗は握りつぶす（会話が空の
    // まま始まるだけでエラーは出さない）。復元中も既存の空状態のままでよいので
    // 専用のローディングは持たない。カードは復元されない（BE契約: 本文のみ）
    func restoreIfNeeded(client: ChatAPIClient?) async {
        guard
            let client,
            !hasAttemptedRestore,
            messages.isEmpty
        else {
            return
        }
        // 失敗しても再試行しないので、結果を待たずにここで倒しておく。
        // シートの開き直しで多重に走らせないためでもある
        hasAttemptedRestore = true

        let generation = streamGeneration
        let restored = await client.fetchHistory()

        // 取得を待つ間に送信・会話クリア・サインアウトが起きていたら捨てる。
        // clearConversation は世代を進めるので、サインアウト直後の復元で
        // 前の利用者の会話が戻ってくることはない
        guard
            generation == streamGeneration,
            messages.isEmpty,
            !restored.isEmpty
        else {
            return
        }
        messages = restored.map {
            Message(
                role: $0.role == .user ? .user : .assistant,
                text: $0.content
            )
        }
    }

    func send(
        _ text: String,
        client: ChatAPIClient,
        context: ChatContext,
        dogID: String?
    ) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard
            !trimmed.isEmpty,
            !isStreaming,
            limitState != .dailyQuota
        else {
            return
        }
        sendError = nil
        // busy / rate_limited は時間経過で解除されるため、再送で解除を試みる
        limitState = nil
        messages.append(
            Message(
                role: .user,
                text: String(trimmed.prefix(Self.maxMessageLength))
            )
        )
        streamingText = ""

        let request = ChatRequest(
            messages: messages.suffix(Self.maxHistoryMessages).map {
                ChatRequest.Message(
                    role: $0.role == .user ? .user : .assistant,
                    content: String($0.text.prefix(Self.maxMessageLength))
                )
            },
            context: context,
            dogID: dogID
        )
        streamGeneration &+= 1
        let generation = streamGeneration
        streamTask = Task { [weak self] in
            await self?.consume(
                stream: client.streamChat(request: request),
                generation: generation
            )
            self?.finishStream(generation: generation)
        }
    }

    // ヘッダーの「会話をクリア」。ChatStore はシートより長生きするようになったため、
    // 新しい会話を始める手段はここだけになる。進行中のストリームも打ち切る
    func clearConversation() {
        streamGeneration &+= 1
        streamTask?.cancel()
        streamTask = nil
        streamingText = nil
        messages = []
        draft = ""
        sendError = nil
        // 残量と当日枠切れはアカウント側の状態なので会話クリアでは解除しない
        if limitState != .dailyQuota {
            limitState = nil
        }
    }

    // ストリーム完走時の後片付け。クリアや再送で世代が進んでいたら
    // 新しい streamTask を消さないよう何もしない
    private func finishStream(generation: Int) {
        guard generation == streamGeneration else { return }
        streamTask = nil
    }

    private func consume(
        stream: AsyncThrowingStream<ChatSSEEvent, Error>,
        generation: Int
    ) async {
        var grounding: ChatSSEEvent.Grounding?
        var spots: [ChatSSEEvent.SpotCard] = []
        var articles: [ChatSSEEvent.ArticleCard] = []
        var events: [ChatSSEEvent.EventCard] = []
        do {
            for try await event in stream {
                // 会話をクリアされた後に届いた残りは無視する
                guard generation == streamGeneration else { return }
                switch event.type {
                case ChatSSEEvent.EventType.meta:
                    if let remaining = event.quota?.remainingToday {
                        quotaRemaining = remaining
                    }
                    grounding = event.grounding
                case ChatSSEEvent.EventType.delta:
                    if let text = event.text {
                        streamingText = (streamingText ?? "") + text
                    }
                case ChatSSEEvent.EventType.reset:
                    // ツールを使う前の独り言（「探してみますね」）を捨て、
                    // 最終ラウンドの内容だけを残す。
                    // streamingText は nil に戻さない（nil は「ストリーム終了」を
                    // 意味し、入力欄が途中で有効に戻ってしまうため）。
                    // "" にすることで送信中インジケータの表示に戻る
                    if streamingText != nil {
                        streamingText = ""
                    }
                    // 破棄済みの本文に紐づいたカードも同時に捨てる
                    spots = []
                    articles = []
                    events = []
                case ChatSSEEvent.EventType.spots:
                    // placeId/name を欠く item は詳細へ遷移も表示もできないため
                    // 除外し、契約上限の5件で切り詰める
                    spots = (event.items ?? [])
                        .filter { item in
                            item.placeID?.isEmpty == false
                                && item.name?.isEmpty == false
                        }
                        .prefix(5)
                        .map { $0 }
                case ChatSSEEvent.EventType.articles:
                    // spots と同じ規則: 必須キー（articleId/title）欠損は除外・5件まで
                    articles = (event.articleItems ?? [])
                        .filter { item in
                            item.articleID?.isEmpty == false
                                && item.title?.isEmpty == false
                        }
                        .prefix(5)
                        .map { $0 }
                case ChatSSEEvent.EventType.events:
                    // spots と同じ規則: 必須キー（eventId/title）欠損は除外・5件まで
                    events = (event.eventItems ?? [])
                        .filter { item in
                            item.eventID?.isEmpty == false
                                && item.title?.isEmpty == false
                        }
                        .prefix(5)
                        .map { $0 }
                case ChatSSEEvent.EventType.limit:
                    limitState = Self.limitState(for: event.code)
                case ChatSSEEvent.EventType.error:
                    sendError = Self.genericErrorMessage
                case ChatSSEEvent.EventType.done:
                    break
                default:
                    // 未知typeは読み飛ばす（SSE契約の将来互換）
                    break
                }
            }
        } catch {
            guard generation == streamGeneration else { return }
            sendError = (error as? WanspotAPIError)?.errorDescription
                ?? Self.genericErrorMessage
        }
        guard generation == streamGeneration else { return }
        commitStreamingMessage(
            grounding: grounding,
            spots: spots,
            articles: articles,
            events: events
        )
        if
            !Task.isCancelled,
            limitState == nil,
            sendError == nil,
            messages.last?.role != .assistant
        {
            // 応答が1文字も届かずに閉じたケースは失敗として見せる
            sendError = Self.genericErrorMessage
        }
    }

    private func commitStreamingMessage(
        grounding: ChatSSEEvent.Grounding?,
        spots: [ChatSSEEvent.SpotCard],
        articles: [ChatSSEEvent.ArticleCard],
        events: [ChatSSEEvent.EventCard]
    ) {
        defer { streamingText = nil }
        guard let text = streamingText, !text.isEmpty else { return }
        messages.append(
            Message(
                role: .assistant,
                text: text,
                grounding: grounding,
                spots: spots,
                articles: articles,
                events: events
            )
        )
    }

    private static func limitState(for code: String?) -> LimitState {
        switch code {
        case "daily_quota":
            .dailyQuota
        case "rate_limited":
            .rateLimited
        default:
            // 未知codeは busy 扱いにして再送可能なままにする
            .busy
        }
    }
}
