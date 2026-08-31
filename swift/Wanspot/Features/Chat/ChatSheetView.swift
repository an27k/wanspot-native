import SwiftUI
import WanspotKit

struct ChatSheetView: View {
    @Environment(AppModel.self) private var model
    @Environment(AppRouter.self) private var router
    @Environment(LocationSession.self) private var locationSession
    @Environment(\.dismiss) private var dismiss

    // 解決中のイベントカード（eventId）。カレンダー詳細は slug が要るため、
    // slug を持たない旧サーバのカードはタップ時に月別APIを引く。その間の待ちをカードに出す
    // （slug を持つカードは直行するのでここは nil のまま）
    @State private var openingEventID: String?
    @FocusState private var isInputFocused: Bool

    // 会話はシートより長生きさせる契約のため、AppModel が持つ1個を参照する。
    // ここで @State として生成すると提示のたびに会話が消える
    private var store: ChatStore { model.chatStore }

    var body: some View {
        VStack(spacing: 0) {
            header
            conversation
            if store.limitState != .dailyQuota {
                inputBar
            }
        }
        .background(WanspotColors.paper)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(WanspotColors.paper)
        .accessibilityIdentifier("chat.sheet")
        .task {
            // 起動をまたいだ会話の復元はここが入口。起動直後に無条件で叩くと
            // チャットを使わない人にも通信させることになるため、
            // 「シートを初めて開いたとき（＝起動につき1回）」に寄せている。
            // 多重呼び出しの抑止と失敗の握りつぶしは ChatStore 側が持つ
            await store.restoreIfNeeded(client: model.chatAPIClient)
        }
    }

    // 文脈は表示中の画面が AppModel に供給する。未設定の画面は選択中タブから組み立てる
    private var screenContext: ChatScreenContext {
        if let context = model.chatScreenContext {
            return context
        }
        let coordinate = locationSession.location?.coordinate
        return .tab(
            router.selectedTab,
            latitude: coordinate?.latitude,
            longitude: coordinate?.longitude
        )
    }

    private var canSend: Bool {
        !store.draft
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .isEmpty
            && !store.isStreaming
            && store.limitState != .dailyQuota
            && model.chatAPIClient != nil
    }

    private func send(_ text: String) {
        guard let client = model.chatAPIClient else { return }
        store.send(
            text,
            client: client,
            context: screenContext.context,
            dogID: model.primaryDog?.id
        )
        store.draft = ""
    }

    private var header: some View {
        HStack(spacing: 10) {
            Image("ChatMascot")
                .resizable()
                .scaledToFill()
                .frame(width: 40, height: 40)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 1) {
                Text("ワンスポAI")
                    .font(.subheadline.weight(.heavy))
                    .foregroundStyle(WanspotColors.textPrimary)

                // 定型文を足すと実機幅で途切れるため文脈名のみ。
                // 文脈のない画面（マイページ等）はサブタイトル自体を出さない
                if let contextName = screenContext.displayName {
                    Text("いま見ている: \(contextName)")
                        .font(.caption2)
                        .foregroundStyle(WanspotColors.textSecondary)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 8)

            Menu {
                Button(role: .destructive) {
                    store.clearConversation()
                } label: {
                    Label("会話をクリア", systemImage: "trash")
                }
                .accessibilityIdentifier("chat.clearConversation")
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(WanspotColors.textSecondary)
                    .frame(width: 34, height: 34)
                    .background(
                        WanspotColors.border.opacity(0.55),
                        in: Circle()
                    )
            }
            .buttonStyle(.plain)
            // 消すものが無いときは開いても意味がないので伏せる
            .disabled(store.messages.isEmpty && !store.isStreaming)
            .accessibilityLabel("チャットのメニュー")
            .accessibilityIdentifier("chat.menu")

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(WanspotColors.textSecondary)
                    .frame(width: 34, height: 34)
                    .background(
                        WanspotColors.border.opacity(0.55),
                        in: Circle()
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("閉じる")
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 12)
        .overlay(alignment: .bottom) {
            Divider()
        }
    }

    private var conversation: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 14) {
                    Text("会話は品質改善のため保存されます")
                        .font(.caption2)
                        .foregroundStyle(
                            WanspotColors.textSecondary.opacity(0.8)
                        )

                    if store.messages.isEmpty {
                        suggestionChips
                    }

                    ForEach(store.messages) { message in
                        messageRow(message)
                    }

                    if let streamingText = store.streamingText {
                        assistantRow(
                            text: streamingText,
                            grounding: nil,
                            isStreaming: true
                        )
                    }

                    if
                        let remaining = store.quotaRemaining,
                        (1 ... 3).contains(remaining),
                        store.limitState == nil
                    {
                        noticeChip("きょうはあと\(remaining)回質問できます")
                    }

                    switch store.limitState {
                    case .dailyQuota:
                        dailyQuotaCard
                    case .busy:
                        noticeChip("いま混み合っています。少しあとでお試しください")
                    case .rateLimited:
                        noticeChip("メッセージの間隔が短いようです。少し待ってからお試しください")
                    case nil:
                        EmptyView()
                    }

                    if let sendError = store.sendError {
                        Text(sendError)
                            .font(.caption)
                            .foregroundStyle(WanspotColors.error)
                            .multilineTextAlignment(.center)
                    }

                    Color.clear
                        .frame(height: 1)
                        .id("chat.bottom")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: store.messages.count) {
                scrollToBottom(proxy)
            }
            .onChange(of: store.streamingText) {
                scrollToBottom(proxy)
            }
            .onChange(of: store.limitState) {
                scrollToBottom(proxy)
            }
            .onAppear {
                // 会話は閉じても残るので、開き直したときは続きから見せる
                proxy.scrollTo("chat.bottom", anchor: .bottom)
            }
        }
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        withAnimation(.snappy) {
            proxy.scrollTo("chat.bottom", anchor: .bottom)
        }
    }

    private var suggestionChips: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 6) {
                ForEach(screenContext.suggestions, id: \.self) { suggestion in
                    Button {
                        send(suggestion)
                    } label: {
                        Text(suggestion)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(WanspotColors.textPrimary)
                            .padding(.horizontal, 12)
                            .frame(height: 40)
                            .background(WanspotColors.surface, in: Capsule())
                            .overlay {
                                Capsule()
                                    .stroke(WanspotColors.border)
                            }
                    }
                    .buttonStyle(.plain)
                    .disabled(store.isStreaming)
                }
            }
            .padding(.horizontal, 2)
            .padding(.vertical, 1)
        }
        .scrollIndicators(.hidden)
        .accessibilityIdentifier("chat.suggestions")
    }

    @ViewBuilder
    private func messageRow(_ message: ChatStore.Message) -> some View {
        switch message.role {
        case .user:
            HStack {
                Spacer(minLength: 48)
                Text(message.text)
                    .font(.subheadline)
                    .lineSpacing(4)
                    .foregroundStyle(WanspotColors.onPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 11)
                    .background(
                        WanspotColors.primary,
                        in: UnevenRoundedRectangle(
                            topLeadingRadius: 18,
                            bottomLeadingRadius: 18,
                            bottomTrailingRadius: 6,
                            topTrailingRadius: 18,
                            style: .continuous
                        )
                    )
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        case .assistant:
            assistantRow(
                text: message.text,
                grounding: message.grounding,
                isStreaming: false,
                spots: message.spots,
                articles: message.articles,
                events: message.events
            )
        }
    }

    private func assistantRow(
        text: String,
        grounding: ChatSSEEvent.Grounding?,
        isStreaming: Bool,
        spots: [ChatSSEEvent.SpotCard] = [],
        articles: [ChatSSEEvent.ArticleCard] = [],
        events: [ChatSSEEvent.EventCard] = []
    ) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image("ChatMascot")
                .resizable()
                .scaledToFill()
                .frame(width: 26, height: 26)
                .clipShape(Circle())
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 6) {
                Group {
                    if text.isEmpty, isStreaming {
                        ChatTypingIndicator()
                    } else {
                        Text(text)
                            .font(.subheadline)
                            .lineSpacing(4)
                            .foregroundStyle(WanspotColors.textPrimary)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(
                    WanspotColors.surface,
                    in: UnevenRoundedRectangle(
                        topLeadingRadius: 18,
                        bottomLeadingRadius: 6,
                        bottomTrailingRadius: 18,
                        topTrailingRadius: 18,
                        style: .continuous
                    )
                )
                .overlay {
                    UnevenRoundedRectangle(
                        topLeadingRadius: 18,
                        bottomLeadingRadius: 6,
                        bottomTrailingRadius: 18,
                        topTrailingRadius: 18,
                        style: .continuous
                    )
                    .stroke(WanspotColors.border.opacity(0.8), lineWidth: 0.5)
                }

                if let grounding, let label = groundingLabel(grounding) {
                    groundingChip(
                        label: label,
                        isOfficial: grounding.evidence == "official"
                    )
                }

                // 横断検索の回答は「短い本文＋カード＋一言説明」のセットで見せる
                ForEach(Array(spots.enumerated()), id: \.offset) { _, spot in
                    spotCard(spot)
                }

                ForEach(
                    Array(articles.enumerated()),
                    id: \.offset
                ) { _, article in
                    articleCard(article)
                }

                ForEach(Array(events.enumerated()), id: \.offset) { _, event in
                    eventCard(event)
                }
            }

            Spacer(minLength: 32)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // spots イベント1件分のカード＋一言説明。placeId/name 欠損は Store 側で
    // 除外済みだが、型上 Optional のためここでも守っておく
    @ViewBuilder
    private func spotCard(_ spot: ChatSSEEvent.SpotCard) -> some View {
        if let placeID = spot.placeID, let name = spot.name {
            VStack(alignment: .leading, spacing: 6) {
                Button {
                    openSpot(placeID: placeID)
                } label: {
                    HStack(spacing: 10) {
                        spotThumbnail(spot.photoURL)

                        VStack(alignment: .leading, spacing: 3) {
                            Text(name)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(WanspotColors.textPrimary)
                                .lineLimit(1)

                            if let meta = Self.spotMetaLabel(spot) {
                                Text(meta)
                                    .font(.system(size: 11.5))
                                    .foregroundStyle(
                                        WanspotColors.textSecondary
                                    )
                                    .lineLimit(1)
                            }

                            if let label = spot.label, !label.isEmpty {
                                spotToneChip(label: label, tone: spot.tone)
                            }
                        }

                        Spacer(minLength: 6)

                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(WanspotColors.textSecondary)
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        WanspotColors.surface,
                        in: RoundedRectangle(
                            cornerRadius: 14,
                            style: .continuous
                        )
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(
                                WanspotColors.border.opacity(0.8),
                                lineWidth: 0.5
                            )
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("chat.spotCard")

                spotCardFooter(spot, name: name)
            }
            // カードと直下のリンク行を1組に見せるため、次のカードとの間だけ広げる
            .padding(.bottom, 6)
        }
    }

    // 一言説明と外部リンク（Instagram / Google マップ）の行。
    //
    // リンクはカード本体の Button の **外側** に置く。カード全面が「詳細へ」の
    // Button なので、その label の中に Link を入れると入れ子のタップが競合し、
    // アイコンを押したのに詳細へ飛ぶ（またはその逆）が起きる。行を分ければ
    // 競合そのものが発生しない。
    // 加えてカード1行は サムネ52pt＋テキスト＋シェブロン で埋まっており、
    // iPhone SE 幅で 28pt のアイコンを2つ差し込むと店名がほとんど出ない
    // （契約 3. の「comment 行の右端に置く」案を採った）
    @ViewBuilder
    private func spotCardFooter(
        _ spot: ChatSSEEvent.SpotCard,
        name: String
    ) -> some View {
        let comment = spot.comment ?? ""
        let links = Self.spotCardLinks(spot, name: name)
        if !comment.isEmpty || !links.isEmpty {
            HStack(alignment: .bottom, spacing: 6) {
                if !comment.isEmpty {
                    Text(comment)
                        .font(.system(size: 12.5))
                        .lineSpacing(5)
                        .foregroundStyle(WanspotColors.textSecondary)
                        // HStack の中の Text は「1行にわずかに収まらない」長さのとき
                        // 折り返さずに末尾を省略してしまう（アイコン1個の行で再現）。
                        // 縦だけ理想サイズを尊重させて、必ず折り返させる
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    Spacer(minLength: 0)
                }

                ForEach(links) { link in
                    ChatSpotCardLinkButton(link: link)
                }
            }
            .padding(.horizontal, 4)
        }
    }

    // カードに出す外部リンク。Instagram は **instagramID を持つカードだけ**
    // （SpotSharing の「Google で名前を検索」フォールバックには乗せない。
    // 詳細画面と違いカードは狭く、当たり外れのある導線を並べたくない）
    private static func spotCardLinks(
        _ spot: ChatSSEEvent.SpotCard,
        name: String
    ) -> [ChatSpotCardLink] {
        var links: [ChatSpotCardLink] = []

        let instagramID = spot.instagramID?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if
            !instagramID.isEmpty,
            let url = SpotSharing.instagramURL(
                instagramID: instagramID,
                spotName: name
            )
        {
            links.append(
                ChatSpotCardLink(
                    kind: .instagram,
                    url: url,
                    accessibilityLabel: "\(name)のInstagram",
                    accessibilityIdentifier: "chat.spotCard.instagram"
                )
            )
        }

        if let url = SpotSharing.googleMapsURL(
            name: name,
            placeID: spot.placeID
        ) {
            links.append(
                ChatSpotCardLink(
                    kind: .googleMaps,
                    url: url,
                    accessibilityLabel: "\(name)をGoogleマップで開く",
                    accessibilityIdentifier: "chat.spotCard.maps"
                )
            )
        }

        return links
    }

    // 写真なし/読み込み失敗は肉球プレースホルダにフォールバック
    private func spotThumbnail(_ urlString: String?) -> some View {
        ZStack {
            LinearGradient(
                colors: [
                    WanspotColors.tintWeak,
                    WanspotColors.primary.opacity(0.25),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Image(systemName: "pawprint.fill")
                .font(.system(size: 18))
                .foregroundStyle(WanspotColors.primary.opacity(0.55))

            if let url = urlString.flatMap(URL.init(string:)) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image
                            .resizable()
                            .scaledToFill()
                    }
                }
            }
        }
        .frame(width: 52, height: 52)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    // 確度チップはサーバが決定的に導出した label/tone をそのまま表示する
    // （LLMには言わせない）。未知toneは最弱のグレー表示に倒す
    private func spotToneChip(label: String, tone: String?) -> some View {
        let isConfirmed = tone == "confirmed"
        let isReported = tone == "reported"
        return Text(label)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(
                isConfirmed
                    ? WanspotColors.primary
                    : isReported
                        ? WanspotColors.textPrimary
                        : WanspotColors.textSecondary
            )
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(
                isConfirmed
                    ? WanspotColors.tintWeak
                    : isReported
                        ? WanspotColors.border.opacity(0.55)
                        : WanspotColors.border.opacity(0.35),
                in: Capsule()
            )
    }

    private static func spotMetaLabel(
        _ spot: ChatSSEEvent.SpotCard
    ) -> String? {
        var parts: [String] = []
        if let category = spot.category, !category.isEmpty {
            parts.append(category)
        }
        if let distanceM = spot.distanceM {
            parts.append(Self.distanceLabel(distanceM))
        }
        if let rating = spot.rating {
            parts.append(
                "★\(rating.formatted(.number.precision(.fractionLength(1))))"
            )
        }
        return parts.isEmpty ? nil : parts.joined(separator: " ・ ")
    }

    // 契約: 1000m未満は「◯m」、以上は「◯.◯km」
    private static func distanceLabel(_ meters: Double) -> String {
        guard meters >= 1000 else {
            return "\(Int(meters.rounded()))m"
        }
        let km = (meters / 1000)
            .formatted(.number.precision(.fractionLength(1)))
        return "\(km)km"
    }

    // 検索結果タップと同じ place_ ルートIDで既存のスポット詳細解決に乗せる。
    // カードには座標が無いため PlaceResult は仕込まず、詳細側の再取得に任せる
    private func openSpot(placeID: String) {
        router.navigate(
            to: .spot(id: SpotDetailNavigationState.placeRouteID(for: placeID))
        )
        dismiss()
    }

    // articles イベント1件分のカード＋一言説明。スポットカードと同系の見た目。
    // articleId/title 欠損は Store 側で除外済みだが、型上 Optional のため守っておく
    @ViewBuilder
    private func articleCard(_ article: ChatSSEEvent.ArticleCard) -> some View {
        if let articleID = article.articleID, let title = article.title {
            VStack(alignment: .leading, spacing: 6) {
                Button {
                    openArticle(articleID: articleID)
                } label: {
                    HStack(spacing: 10) {
                        cardIconTile(systemName: "newspaper.fill")

                        VStack(alignment: .leading, spacing: 3) {
                            Text(title)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(WanspotColors.textPrimary)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)

                            if
                                let summary = article.summary,
                                !summary.isEmpty
                            {
                                Text(summary)
                                    .font(.system(size: 11.5))
                                    .foregroundStyle(
                                        WanspotColors.textSecondary
                                    )
                                    .lineLimit(1)
                            }

                            if
                                let category = article.category,
                                !category.isEmpty
                            {
                                cardCategoryChip(category)
                            }
                        }

                        Spacer(minLength: 6)

                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(WanspotColors.textSecondary)
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        WanspotColors.surface,
                        in: RoundedRectangle(
                            cornerRadius: 14,
                            style: .continuous
                        )
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(
                                WanspotColors.border.opacity(0.8),
                                lineWidth: 0.5
                            )
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("chat.articleCard")

                if let comment = article.comment, !comment.isEmpty {
                    Text(comment)
                        .font(.system(size: 12.5))
                        .lineSpacing(5)
                        .foregroundStyle(WanspotColors.textSecondary)
                        .padding(.horizontal, 4)
                }
            }
        }
    }

    // events イベント1件分のカード＋一言説明。スポットカードと同系の見た目
    @ViewBuilder
    private func eventCard(_ event: ChatSSEEvent.EventCard) -> some View {
        if let eventID = event.eventID, let title = event.title {
            VStack(alignment: .leading, spacing: 6) {
                Button {
                    openEvent(eventID: eventID, slug: event.slug)
                } label: {
                    HStack(spacing: 10) {
                        cardIconTile(systemName: "calendar")

                        VStack(alignment: .leading, spacing: 3) {
                            Text(title)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(WanspotColors.textPrimary)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)

                            if let meta = Self.eventMetaLabel(event) {
                                Text(meta)
                                    .font(.system(size: 11.5))
                                    .foregroundStyle(
                                        WanspotColors.textSecondary
                                    )
                                    .lineLimit(1)
                            }
                        }

                        Spacer(minLength: 6)

                        if openingEventID == eventID {
                            ProgressView()
                                .controlSize(.small)
                                .tint(WanspotColors.textSecondary)
                        } else {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(WanspotColors.textSecondary)
                        }
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        WanspotColors.surface,
                        in: RoundedRectangle(
                            cornerRadius: 14,
                            style: .continuous
                        )
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(
                                WanspotColors.border.opacity(0.8),
                                lineWidth: 0.5
                            )
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("chat.eventCard")

                if let comment = event.comment, !comment.isEmpty {
                    Text(comment)
                        .font(.system(size: 12.5))
                        .lineSpacing(5)
                        .foregroundStyle(WanspotColors.textSecondary)
                        .padding(.horizontal, 4)
                }
            }
        }
    }

    // 記事・イベントカードにはサムネURLが無いため、スポットの肉球
    // プレースホルダと同じ52ptタイルにアイコンを置いてレイアウトを揃える
    private func cardIconTile(systemName: String) -> some View {
        ZStack {
            LinearGradient(
                colors: [
                    WanspotColors.tintWeak,
                    WanspotColors.primary.opacity(0.25),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Image(systemName: systemName)
                .font(.system(size: 18))
                .foregroundStyle(WanspotColors.primary.opacity(0.55))
        }
        .frame(width: 52, height: 52)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func cardCategoryChip(_ category: String) -> some View {
        Text(category)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(WanspotColors.primary)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(WanspotColors.tintWeak, in: Capsule())
    }

    private static func eventMetaLabel(
        _ event: ChatSSEEvent.EventCard
    ) -> String? {
        let parts = [event.schedule, event.venueName, event.priceText]
            .compactMap { value in
                value?.isEmpty == false ? value : nil
            }
        return parts.isEmpty ? nil : parts.joined(separator: " ・ ")
    }

    // 記事詳細の既存経路（AppRoute.article）に乗せる。バックエンドの
    // /api/articles/[id] は UUID でも slug でも受けるため articleId をそのまま渡す
    private func openArticle(articleID: String) {
        router.navigate(to: .article(slug: articleID))
        dismiss()
    }

    // カレンダー詳細（AppRoute.calendar）のルートは slug で組む。
    // slug が載っているカード（v7以降のサーバ）は月別APIを一切引かずに直行できる。
    // 詳細画面はイベント本体を CalendarEventNavigationState から受け取る設計だが、
    // 本体が無い場合は詳細画面側が同じ slug で解決しに行くため（CalendarEventLookup
    // → /api/calendar/events/by-slug/[slug]）、ここで先に取得する必要はない。
    // slug が無い旧サーバのカードだけ、従来どおり eventId から本体を解決して
    // slug を得る（その間はカードにインジケータを出し、二重タップは弾く）。
    // 解決できない場合はカレンダータブへの遷移で妥協する
    // （id で単一イベントを引くAPIは無く、月別APIの走査しか手が無いため）。
    private func openEvent(eventID: String, slug: String?) {
        if
            let slug = slug?.trimmingCharacters(in: .whitespacesAndNewlines),
            !slug.isEmpty
        {
            router.navigate(to: .calendar(slug: slug))
            dismiss()
            return
        }

        guard openingEventID == nil else { return }
        openingEventID = eventID
        Task {
            let event = await model.calendarEventLookup?.event(id: eventID)
            if let event {
                await model.calendarEventNavigationState.stash(event)
                router.navigate(to: .calendar(slug: event.slug))
            } else {
                router.selectedTab = .calendar
            }
            openingEventID = nil
            dismiss()
        }
    }

    // 確度チップはサーバが meta で決定的に送った値をそのまま表示する（LLMには言わせない）
    private func groundingLabel(
        _ grounding: ChatSSEEvent.Grounding
    ) -> String? {
        guard let evidence = grounding.evidence, !evidence.isEmpty else {
            return nil
        }
        let base = evidence == "official"
            ? "公式情報で確認"
            : "掲載情報にもとづく"
        if let checkedAt = Self.checkedAtLabel(grounding.checkedAt) {
            return "\(base) ・ \(checkedAt)"
        }
        return base
    }

    private func groundingChip(
        label: String,
        isOfficial: Bool
    ) -> some View {
        HStack(spacing: 6) {
            Image(
                systemName: isOfficial
                    ? "checkmark.shield.fill"
                    : "info.circle"
            )
            .font(.system(size: 10, weight: .bold))
            Text(label)
                .font(.system(size: 10.5, weight: .bold))
        }
        .foregroundStyle(
            isOfficial ? WanspotColors.primary : WanspotColors.textSecondary
        )
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(
            isOfficial
                ? WanspotColors.tintWeak
                : WanspotColors.border.opacity(0.45),
            in: Capsule()
        )
    }

    // "2026-08" / ISO8601 のどちらで来ても年月だけ取り出して表示する
    private static func checkedAtLabel(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let parts = raw.prefix(7).split(separator: "-")
        guard
            parts.count == 2,
            let year = Int(parts[0]),
            let month = Int(parts[1]),
            (1 ... 12).contains(month)
        else {
            return nil
        }
        return "\(year)年\(month)月"
    }

    private func noticeChip(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(WanspotColors.textSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(WanspotColors.border.opacity(0.55), in: Capsule())
    }

    private var dailyQuotaCard: some View {
        VStack(spacing: 10) {
            Image("ChatMascot")
                .resizable()
                .scaledToFill()
                .frame(width: 48, height: 48)
                .clipShape(Circle())

            Text("きょうの相談枠を使い切りました")
                .font(.subheadline.weight(.heavy))
                .foregroundStyle(WanspotColors.textPrimary)

            Text("また明日お話しできます。\nお店の基本情報はこのままご覧いただけます。")
                .font(.caption)
                .lineSpacing(4)
                .foregroundStyle(WanspotColors.textSecondary)
                .multilineTextAlignment(.center)

            Button {
                dismiss()
            } label: {
                Text("スポット情報を見る")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(WanspotColors.textPrimary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(
                        WanspotColors.surface,
                        in: RoundedRectangle(
                            cornerRadius: 12,
                            style: .continuous
                        )
                    )
                    .overlay {
                        RoundedRectangle(
                            cornerRadius: 12,
                            style: .continuous
                        )
                        .stroke(WanspotColors.border)
                    }
            }
            .buttonStyle(.plain)
            .padding(.top, 4)

            Text("相談枠は毎日リセットされます")
                .font(.caption2)
                .foregroundStyle(WanspotColors.textSecondary.opacity(0.7))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 24)
        .frame(maxWidth: .infinity)
        .background(
            WanspotColors.surface,
            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(WanspotColors.border)
        }
        .accessibilityIdentifier("chat.dailyQuotaCard")
    }

    private var inputBar: some View {
        @Bindable var store = store

        return HStack(spacing: 10) {
            TextField(
                "気になることを聞いてみる",
                text: $store.draft,
                axis: .vertical
            )
            .font(.subheadline)
            .lineLimit(1 ... 4)
            .focused($isInputFocused)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(minHeight: 44)
            .background(
                WanspotColors.input,
                in: RoundedRectangle(cornerRadius: 22, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(WanspotColors.border)
            }
            .onChange(of: store.draft) { _, value in
                if value.count > ChatStore.maxMessageLength {
                    store.draft = String(
                        value.prefix(ChatStore.maxMessageLength)
                    )
                }
            }
            .accessibilityIdentifier("chat.input")

            Button {
                send(store.draft)
            } label: {
                Group {
                    if store.isStreaming {
                        ProgressView()
                            .tint(WanspotColors.onPrimary)
                    } else {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(WanspotColors.onPrimary)
                    }
                }
                .frame(width: 44, height: 44)
                .background(
                    canSend
                        ? WanspotColors.primary
                        : WanspotColors.primary.opacity(0.4),
                    in: Circle()
                )
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .accessibilityLabel("送信")
            .accessibilityIdentifier("chat.send")
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 12)
        .background(WanspotColors.paper)
        .overlay(alignment: .top) {
            Divider()
        }
    }
}

/*
  返答を待っている間の表示。本文は最終ラウンドが確定するまで送られてこないので、
  ここが数秒続く。止まったスピナーだと「固まった」ように見えるため、
  会話らしく3点が順に浮き上がる形にしている。
*/
private struct ChatTypingIndicator: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let dotSize: CGFloat = 6
    private let cycle: Double = 1.2
    private let stagger: Double = 0.2

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(WanspotColors.textSecondary)
                    .frame(width: dotSize, height: dotSize)
                    .modifier(ChatTypingDotMotion(
                        delay: Double(index) * stagger,
                        cycle: cycle,
                        animated: !reduceMotion
                    ))
            }
        }
        .frame(height: 18)
        .accessibilityElement()
        .accessibilityLabel("返答を考えています")
    }
}

/*
  チャットのスポットカードに添える外部リンク1件。
  カード本体（詳細へ遷移する Button）とは別の行に置く前提。
*/
private struct ChatSpotCardLink: Identifiable {
    enum Kind {
        case instagram
        case googleMaps
    }

    let kind: Kind
    let url: URL
    let accessibilityLabel: String
    let accessibilityIdentifier: String

    var id: String { accessibilityIdentifier }
}

/*
  30pt の丸ボタン。アイコンはスポット詳細と同じもの
  （Instagram は自作グリフの写し、マップは SpotDetailSections の GoogleMapsIcon）。
*/
private struct ChatSpotCardLinkButton: View {
    let link: ChatSpotCardLink

    var body: some View {
        Link(destination: link.url) {
            icon
                .frame(width: 30, height: 30)
                .background(WanspotColors.surface, in: Circle())
                .overlay {
                    Circle().strokeBorder(WanspotColors.border)
                }
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(link.accessibilityLabel)
        .accessibilityIdentifier(link.accessibilityIdentifier)
    }

    @ViewBuilder
    private var icon: some View {
        switch link.kind {
        case .instagram:
            ChatInstagramIcon(size: 16.5)
        case .googleMaps:
            // 塗りのアイコンは輪郭線の Instagram より重く見えるので、
            // 角丸の外周が Instagram の枠と揃う 18pt にしてある
            // （下地は 48 座標系の 2..46＝frame の 91.7%＝16.5pt）
            GoogleMapsIcon()
                .frame(width: 18, height: 18)
        }
    }
}

/*
  スポット詳細（SpotDetailSections の InstagramIcon）と同じグリフ。
  向こうは private なので、24pt 原寸の各寸法をそのまま比率で持ち直した写しにしてある
  （カード用に 16.5pt まで小さくするため寸法を size 依存にした）。
*/
private struct ChatInstagramIcon: View {
    let size: CGFloat

    private let gradient = LinearGradient(
        colors: [
            Color(red: 0.50, green: 0.20, blue: 0.80),
            Color(red: 0.88, green: 0.18, blue: 0.47),
            Color(red: 1.00, green: 0.58, blue: 0.20),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    // 原寸 24pt に対する倍率。詳細画面の見た目をそのまま縮める
    private var scale: CGFloat { size / 24 }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 6.5 * scale, style: .continuous)
                .stroke(gradient, lineWidth: 2.4 * scale)

            Circle()
                .stroke(gradient, lineWidth: 2.4 * scale)
                .frame(width: 9.5 * scale, height: 9.5 * scale)

            Circle()
                .fill(gradient)
                .frame(width: 3 * scale, height: 3 * scale)
                .offset(x: 6.5 * scale, y: -6.5 * scale)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/*
  Reduce Motion のときは静止した3点にする（動きに弱い人向けの配慮）。
  animated が false のときは onAppear でも値を動かさない。
*/
private struct ChatTypingDotMotion: ViewModifier {
    let delay: Double
    let cycle: Double
    let animated: Bool

    @State private var lifted = false

    func body(content: Content) -> some View {
        content
            .opacity(lifted ? 1 : 0.45)
            .offset(y: lifted ? -3 : 0)
            .animation(
                animated
                    ? .easeInOut(duration: cycle / 2)
                        .repeatForever(autoreverses: true)
                        .delay(delay)
                    : nil,
                value: lifted
            )
            .onAppear {
                guard animated else { return }
                lifted = true
            }
    }
}
