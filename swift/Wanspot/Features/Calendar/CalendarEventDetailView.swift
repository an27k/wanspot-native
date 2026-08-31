import SwiftUI
import WanspotKit

struct CalendarEventDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(AppRouter.self) private var router

    let slug: String

    @State private var event: CalendarEvent?
    @State private var nearby: [CalendarNearbySpot] = []
    @State private var relatedArticles: [ArticleSummary] = []
    @State private var isLoading = true
    @State private var showsShareSheet = false
    @State private var shareItems: [WanspotShareItem] = []

    var body: some View {
        Group {
            if isLoading {
                WanspotLoadingState(title: "イベントを読み込み中…")
            } else if let event {
                eventContent(event)
            } else {
                WanspotEmptyState(
                    title: "イベント情報を表示できませんでした",
                    message: "カレンダーからイベントを開き直してください。",
                    systemImage: "calendar.badge.exclamationmark"
                )
            }
        }
        .background(WanspotColors.paper)
        .accessibilityIdentifier("calendarDetail.screen")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if event != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        prepareShare()
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .accessibilityLabel("共有")
                }
            }
        }
        .task(id: slug) {
            await load()
        }
        .sheet(isPresented: $showsShareSheet) {
            WanspotShareSheet(items: shareItems)
        }
    }

    private func eventContent(_ event: CalendarEvent) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14) {
                if let thumbnail = ContentImageURL.resized(
                    event.thumbnailURL,
                    to: .card
                ) {
                    WanspotRemoteImage(
                        url: thumbnail,
                        cornerRadius: 0,
                        accessibilityLabel: event.title
                    )
                    .frame(maxWidth: .infinity)
                    .aspectRatio(16 / 9, contentMode: .fit)
                }

                VStack(alignment: .leading, spacing: 14) {
                    Text(event.title)
                        .font(.largeTitle.bold())
                        .foregroundStyle(WanspotColors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)

                    if event.priceLevel != nil || !event.tags.isEmpty {
                        HStack(spacing: 8) {
                            CalendarPriceMark(level: event.priceLevel)
                            ForEach(event.tags) { tag in
                                Text(tag.name)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(WanspotColors.textSecondary)
                                    .padding(.horizontal, 9)
                                    .padding(.vertical, 4)
                                    .overlay {
                                        Capsule().strokeBorder(
                                            Color(hex: tag.color)
                                                ?? WanspotColors.border
                                        )
                                    }
                            }
                        }
                    }

                    detailSection(title: "開催日時") {
                        ForEach(event.occurrences) { occurrence in
                            Text(CalendarRules.occurrenceLabel(occurrence))
                                .font(.body)
                                .foregroundStyle(WanspotColors.textPrimary)
                        }
                        if let lastEntry = event.lastEntryText {
                            Text("最終入場 \(lastEntry)")
                                .font(.caption)
                                .foregroundStyle(WanspotColors.textSecondary)
                        }
                    }

                    if event.venueName != nil || event.address != nil {
                        detailSection(title: "会場") {
                            if let venue = event.venueName {
                                Text(decodeHTMLEntities(venue))
                                    .font(.body)
                                    .foregroundStyle(WanspotColors.textPrimary)
                            }
                            if let address = event.address {
                                Text(decodeHTMLEntities(address))
                                    .font(.caption)
                                    .foregroundStyle(WanspotColors.textSecondary)
                            }
                            if let mapURL = mapURL(for: event) {
                                Link(destination: mapURL) {
                                    Label("地図で見る", systemImage: "map")
                                        .font(.subheadline.bold())
                                        .foregroundStyle(WanspotColors.primary)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .background(WanspotColors.tintWeak, in: Capsule())
                                }
                                .padding(.top, 4)
                            }
                        }
                    }

                    aiReview(event)

                    if let price = event.priceText {
                        detailSection(title: "料金") {
                            Text(price)
                                .font(.body)
                                .foregroundStyle(WanspotColors.textPrimary)
                        }
                    }

                    if !nearby.isEmpty {
                        detailSection(
                            title: nearby.contains(where: { $0.kind == .stay })
                                ? "泊まりで行くなら"
                                : "前後に寄るなら"
                        ) {
                            ForEach(nearby) { spot in
                                nearbyRow(spot)
                            }
                        }
                    }

                    let links = CalendarRules.directLinks(
                        [event.officialURLString]
                            + event.relatedURLStrings.map(Optional.some),
                        listingURL: event.sourceURLString
                    )
                    if !links.isEmpty || event.ticketURL != nil {
                        detailSection(title: "リンク") {
                            ForEach(Array(links.enumerated()), id: \.offset) {
                                index,
                                url in
                                Link(destination: url) {
                                    HStack {
                                        Text(index == 0 ? "①" : "\(index + 1)")
                                        Text(
                                            index == 0
                                                ? "公式サイト"
                                                : url.host ?? url.absoluteString
                                        )
                                        .lineLimit(1)
                                        Spacer()
                                        Image(systemName: "arrow.up.right")
                                    }
                                    .font(.subheadline)
                                    .foregroundStyle(WanspotColors.textPrimary)
                                    .padding(.vertical, 6)
                                }
                            }
                            if let ticketURL = event.ticketURL {
                                Link(destination: ticketURL) {
                                    Label(
                                        "チケット",
                                        systemImage: "ticket"
                                    )
                                    .font(.subheadline.bold())
                                    .foregroundStyle(WanspotColors.primary)
                                    .padding(.vertical, 6)
                                }
                            }
                        }
                    }

                    if !relatedArticles.isEmpty {
                        detailSection(title: "このイベントの掲載記事") {
                            Text("記事を開くと、同じ時期のイベントや前後に立ち寄れるスポットも探せます。")
                                .font(.subheadline)
                                .foregroundStyle(WanspotColors.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)

                            ForEach(relatedArticles) { article in
                                relatedArticleRow(article)
                            }
                        }
                    }
                }
                .padding(.horizontal, WanspotMetrics.pagePadding)
                .padding(.bottom, 32)
            }
        }
    }

    private func detailSection<Content: View>(
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(WanspotColors.textSecondary)
            content()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(WanspotColors.surface)
        .clipShape(.rect(cornerRadius: 16))
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(WanspotColors.border)
        }
    }

    @ViewBuilder
    private func aiReview(_ event: CalendarEvent) -> some View {
        if !model.isAuthenticated {
            VStack(alignment: .leading, spacing: 10) {
                Label("ワンスポ AIレビュー", systemImage: "sparkles")
                    .font(.headline)
                    .foregroundStyle(WanspotColors.textPrimary)
                Text("このイベントが愛犬とどうなのかをまとめたAIレビューは、登録すると読めます。")
                    .font(.subheadline)
                    .foregroundStyle(WanspotColors.textSecondary)
                Button("登録して読む") {
                    model.requestAuthentication()
                }
                .buttonStyle(.borderedProminent)
                .tint(WanspotColors.primary)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(WanspotColors.tintWeak)
            .clipShape(.rect(cornerRadius: 16))
        } else if let review = (event.aiSummary ?? event.description)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
            !review.isEmpty
        {
            VStack(alignment: .leading, spacing: 8) {
                Label("ワンスポ AIレビュー", systemImage: "sparkles")
                    .font(.headline)
                    .foregroundStyle(WanspotColors.primary)
                Text(stripTrailingEllipsis(review))
                    .font(.body)
                    .foregroundStyle(WanspotColors.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(WanspotColors.tintWeak)
            .clipShape(.rect(cornerRadius: 16))
        }
    }

    private func nearbyRow(_ spot: CalendarNearbySpot) -> some View {
        Button {
            Task {
                if let place = spot.placeResult {
                    await model.spotDetailNavigationState.setPlace(
                        routeID: spot.spotID,
                        place: place
                    )
                    await model.spotDetailNavigationState.setHandoff(
                        routeID: spot.spotID,
                        place: place
                    )
                    await model.spotDetailNavigationState.stash(
                        spotID: spot.spotID,
                        place: place
                    )
                }
                router.navigate(to: .spot(id: spot.spotID), in: .calendar)
            }
        } label: {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(spot.name)
                        .font(.subheadline.bold())
                        .foregroundStyle(WanspotColors.textPrimary)
                        .lineLimit(1)
                    Text(
                        [
                            CalendarRules.nearbyKindLabel(spot.kind),
                            CalendarRules.distanceLabel(
                                meters: spot.distanceMeters
                            ),
                            spot.rating.map {
                                "★\($0.formatted(.number.precision(.fractionLength(1))))"
                            },
                        ].compactMap(\.self).joined(separator: " · ")
                    )
                    .font(.caption)
                    .foregroundStyle(WanspotColors.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.bold())
                    .foregroundStyle(WanspotColors.textSecondary)
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func relatedArticleRow(_ article: ArticleSummary) -> some View {
        Button {
            router.navigate(
                to: .article(slug: article.slug),
                in: .calendar
            )
        } label: {
            HStack(spacing: 12) {
                WanspotRemoteImage(
                    url: ContentImageURL.resized(
                        article.imageURL,
                        to: .thumbnail
                    ),
                    cornerRadius: 10,
                    accessibilityLabel: article.title
                )
                .frame(width: 88, height: 78)

                VStack(alignment: .leading, spacing: 4) {
                    if let metadata = articleMetadata(for: article) {
                        Text(metadata)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(WanspotColors.primary)
                            .lineLimit(1)
                    }

                    Text(article.title)
                        .font(.subheadline.bold())
                        .foregroundStyle(WanspotColors.textPrimary)
                        .multilineTextAlignment(.leading)
                        .lineLimit(2)

                    if !article.summary.isEmpty {
                        Text(article.summary)
                            .font(.caption)
                            .foregroundStyle(WanspotColors.textSecondary)
                            .multilineTextAlignment(.leading)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "chevron.right")
                    .font(.caption.bold())
                    .foregroundStyle(WanspotColors.textSecondary)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                WanspotColors.input,
                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
            )
            .contentShape(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
            )
        }
        .buttonStyle(.plain)
        .accessibilityHint("記事を開いて関連するイベントやスポットを探します")
        .accessibilityIdentifier(
            "calendarDetail.relatedArticle.\(article.slug)"
        )
    }

    private func articleMetadata(for article: ArticleSummary) -> String? {
        let theme = ArticleRules.parseTheme(article.theme)
        let value = [theme.area, theme.genreLabel]
            .compactMap(\.self)
            .joined(separator: " ・ ")
        return value.isEmpty ? nil : value
    }

    private func load() async {
        isLoading = true
        // 通常（カレンダータブのカードから）は stash 済みの本体が即返る。
        // チャットのイベントカードや /events/[slug] のディープリンクのように
        // slug しか無い入口では、単一イベント取得API
        // （/api/calendar/events/by-slug/[slug]）を1回引いて開く。
        // 月別APIの horizon に縛られないので過去・遠い未来のイベントも開く
        let resolved: CalendarEvent?
        if let lookup = model.calendarEventLookup {
            resolved = await lookup.event(slug: slug)
        } else {
            resolved = await model.calendarEventNavigationState.resolve(
                slug: slug
            )
        }
        event = resolved
        if let resolved {
            async let fetchedNearby = fetchNearbySpots(for: resolved)
            async let fetchedArticles = fetchRelatedArticles(for: resolved)
            (nearby, relatedArticles) = await (
                fetchedNearby,
                fetchedArticles
            )
        } else {
            nearby = []
            relatedArticles = []
        }
        isLoading = false
    }

    private func fetchNearbySpots(
        for event: CalendarEvent
    ) async -> [CalendarNearbySpot] {
        guard let repository = model.calendarRepository else { return [] }
        return (try? await repository.fetchNearbySpots(
            eventID: event.id
        )) ?? []
    }

    private func fetchRelatedArticles(
        for event: CalendarEvent
    ) async -> [ArticleSummary] {
        guard let repository = model.articlesRepository else { return [] }
        let eventMonth = event.occurrences
            .map(\.startsAt)
            .min()
            .map { CalendarRules.month(containing: $0).cacheKey }
        return (try? await repository.fetchRelatedArticles(
            eventID: event.id,
            eventMonth: eventMonth,
            prefecture: event.prefecture?.name
        )) ?? []
    }

    private func prepareShare() {
        guard
            let event,
            let siteURL = model.wanspotSiteURL
                ?? URL(string: "https://www.wanspot.app")
        else {
            return
        }
        let content = ContentSharing.calendarEvent(event, siteURL: siteURL)
        shareItems = [.text(content.text)]
        if let url = content.url {
            shareItems.append(.url(url))
        }
        showsShareSheet = true
    }

    private func mapURL(for event: CalendarEvent) -> URL? {
        SpotSharing.googleMapsURL(
            name: event.venueName ?? event.title,
            placeID: event.placeID,
            latitude: event.latitude,
            longitude: event.longitude
        )
    }

    private func stripTrailingEllipsis(_ value: String) -> String {
        value
            .replacingOccurrences(
                of: #"\s*\[\.\.\.\]\s*$"#,
                with: "",
                options: .regularExpression
            )
            .replacingOccurrences(
                of: #"\s*…\s*$"#,
                with: "",
                options: .regularExpression
            )
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func decodeHTMLEntities(_ value: String) -> String {
        var result = value
        let numeric = try? NSRegularExpression(pattern: #"&#(\d+);"#)
        let matches = numeric?.matches(
            in: result,
            range: NSRange(result.startIndex..., in: result)
        ).reversed() ?? []
        for match in matches {
            guard
                let whole = Range(match.range(at: 0), in: result),
                let digits = Range(match.range(at: 1), in: result),
                let scalar = UInt32(result[digits]).flatMap(UnicodeScalar.init)
            else {
                continue
            }
            result.replaceSubrange(whole, with: String(Character(scalar)))
        }
        return result
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&apos;", with: "'")
            .replacingOccurrences(of: "&nbsp;", with: " ")
    }
}

private extension Color {
    init?(hex: String) {
        var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let number = UInt64(value, radix: 16) else {
            return nil
        }
        self.init(
            red: Double((number >> 16) & 0xff) / 255,
            green: Double((number >> 8) & 0xff) / 255,
            blue: Double(number & 0xff) / 255
        )
    }
}
