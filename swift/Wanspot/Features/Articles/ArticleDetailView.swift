import Observation
import SwiftUI
import WanspotKit

struct ArticleDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(AppRouter.self) private var router

    let slug: String

    @State private var store = ArticleDetailStore()
    @State private var showsShareSheet = false
    @State private var shareItems: [WanspotShareItem] = []

    var body: some View {
        Group {
            if store.isLoading, store.article == nil {
                WanspotLoadingState(title: "記事を読み込み中…")
            } else if let message = store.errorMessage, store.article == nil {
                WanspotErrorState(
                    title: "記事を読み込めませんでした",
                    message: message,
                    actionTitle: "再試行"
                ) {
                    Task { await store.load(slug: slug, force: true) }
                }
            } else if let article = store.article {
                articleContent(article)
            } else {
                WanspotEmptyState(
                    title: "記事が見つかりません",
                    message: "公開が終了した可能性があります。",
                    systemImage: "newspaper"
                )
            }
        }
        .background(WanspotColors.paper)
        .accessibilityIdentifier("articleDetail.screen")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if store.article != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        prepareShare()
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .accessibilityLabel("記事をシェア")
                }
            }
        }
        .task(id: slug) {
            store.configure(repository: model.articlesRepository)
            await store.load(slug: slug)
        }
        .sheet(isPresented: $showsShareSheet) {
            WanspotShareSheet(items: shareItems)
        }
    }

    private func articleContent(_ article: ArticleDetail) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if let imageURL = ContentImageURL.resized(
                    article.imageURL,
                    to: .hero
                ) {
                    WanspotRemoteImage(
                        url: imageURL,
                        cornerRadius: 0,
                        accessibilityLabel: article.title
                    )
                    .frame(maxWidth: .infinity)
                    .aspectRatio(16 / 9, contentMode: .fit)
                }

                VStack(alignment: .leading, spacing: 0) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("WANSPOT ARTICLE")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(WanspotColors.primary)
                        Text(article.title)
                            .font(.largeTitle.bold())
                            .foregroundStyle(WanspotColors.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)

                        if !article.keywords.isEmpty {
                            FlowLayout(spacing: 8) {
                                ForEach(article.keywords, id: \.self) { keyword in
                                    Text("#\(keyword)")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(WanspotColors.primary)
                                        .padding(.horizontal, 9)
                                        .padding(.vertical, 5)
                                        .background(
                                            WanspotColors.tintWeak,
                                            in: Capsule()
                                        )
                                }
                            }
                            .padding(.top, 4)
                        }
                    }
                    .padding(.vertical, 20)
                    .overlay(alignment: .bottom) { Divider() }
                    .padding(.bottom, 24)

                    ForEach(
                        Array(article.renderedBlocks.enumerated()),
                        id: \.offset
                    ) { index, block in
                        blockView(
                            block,
                            index: index,
                            articleID: article.id
                        )
                    }

                    if !article.spotLinks.isEmpty {
                        relatedSpots(article.spotLinks)
                    }
                }
                .padding(.horizontal, WanspotMetrics.pagePadding)
                .padding(.bottom, 36)
            }
        }
    }

    @ViewBuilder
    private func blockView(
        _ block: ArticleBlock,
        index: Int,
        articleID: String
    ) -> some View {
        switch block {
        case let .text(content):
            if ArticleRules.isTextBlockSectionTitle(content) {
                Text(content.trimmingCharacters(in: .whitespacesAndNewlines))
                    .font(.title3.bold())
                    .foregroundStyle(WanspotColors.textPrimary)
                    .padding(.top, index > 0 ? 24 : 0)
                    .padding(.bottom, 10)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text(content)
                    .font(.body)
                    .foregroundStyle(WanspotColors.textPrimary)
                    .lineSpacing(5)
                    .padding(.bottom, 20)
                    .fixedSize(horizontal: false, vertical: true)
            }
        case let .heading(content):
            let item = content.trimmingCharacters(
                in: .whitespacesAndNewlines
            ).hasPrefix("【")
            Text(content.trimmingCharacters(in: .whitespacesAndNewlines))
                .font(item ? .headline : .title3.bold())
                .foregroundStyle(WanspotColors.textPrimary)
                .padding(.top, index > 0 ? (item ? 16 : 24) : 0)
                .padding(.bottom, item ? 8 : 10)
                .fixedSize(horizontal: false, vertical: true)
        case let .image(urlString, caption):
            if let url = URL(string: urlString) {
                VStack(spacing: 8) {
                    WanspotRemoteImage(
                        url: ContentImageURL.resized(url, to: .card),
                        cornerRadius: 12,
                        accessibilityLabel: caption ?? "記事内画像"
                    )
                    .frame(maxWidth: .infinity)
                    .aspectRatio(16 / 9, contentMode: .fit)
                    if let caption {
                        Text(caption)
                            .font(.caption)
                            .foregroundStyle(WanspotColors.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.vertical, 24)
            }
        case let .spot(reference, _, _):
            if let spot = store.linkedSpots[reference] {
                articleSpotCard(spot, articleID: articleID)
                    .padding(.vertical, 24)
            }
        }
    }

    private func articleSpotCard(
        _ spot: ArticleLinkedSpot,
        articleID _: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            WanspotRemoteImage(
                url: spot.photoURL,
                cornerRadius: 0,
                accessibilityLabel: spot.displayName
            )
            .frame(maxWidth: .infinity)
            .frame(height: 144)

            VStack(alignment: .leading, spacing: 7) {
                HStack {
                    Text(spot.displayCategory)
                        .font(.caption2.bold())
                        .foregroundStyle(WanspotColors.primary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(WanspotColors.tintWeak, in: Capsule())
                    Spacer()
                    if let rating = spot.enrichment?.rating {
                        Label(
                            rating.formatted(
                                .number.precision(.fractionLength(1))
                            ),
                            systemImage: "star.fill"
                        )
                        .font(.caption.bold())
                        .foregroundStyle(.orange)
                    }
                    if let level = spot.enrichment?.priceLevel {
                        Text(
                            level == 0
                                ? "無料"
                                : String(
                                    repeating: "¥",
                                    count: min(4, max(1, level))
                                )
                        )
                        .font(.caption2.bold())
                        .foregroundStyle(WanspotColors.primary)
                    }
                }

                Text(spot.displayName)
                    .font(.headline)
                    .foregroundStyle(WanspotColors.textPrimary)
                Text(spot.displayAddress)
                    .font(.caption)
                    .foregroundStyle(WanspotColors.textSecondary)
                    .lineLimit(2)

                Button {
                    openSpot(spot)
                } label: {
                    Text("→ スポットを見る")
                        .font(.subheadline.bold())
                        .foregroundStyle(WanspotColors.onPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 42)
                        .background(
                            WanspotColors.primary,
                            in: RoundedRectangle(cornerRadius: 12)
                        )
                }
                .buttonStyle(.plain)
                .padding(.top, 5)
            }
            .padding(12)
        }
        .background(WanspotColors.surface)
        .clipShape(.rect(cornerRadius: 16))
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(WanspotColors.border)
        }
    }

    private func relatedSpots(_ links: [ArticleSpotLink]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("関連スポット")
                .font(.title3.bold())
                .foregroundStyle(WanspotColors.textPrimary)

            ForEach(Array(links.enumerated()), id: \.offset) { _, link in
                VStack(alignment: .leading, spacing: 7) {
                    Text(link.spotName)
                        .font(.headline)
                        .foregroundStyle(WanspotColors.textPrimary)
                    if !link.description.isEmpty {
                        Text(link.description)
                            .font(.caption)
                            .foregroundStyle(WanspotColors.textSecondary)
                    }
                    if
                        let reference = link.spotID,
                        let spot = store.linkedSpots[reference]
                    {
                        Button("→ スポットを見る") {
                            openSpot(spot)
                        }
                        .font(.subheadline.bold())
                        .buttonStyle(.borderedProminent)
                        .tint(WanspotColors.primary)
                    } else {
                        Text("スポット情報なし")
                            .font(.caption)
                            .foregroundStyle(WanspotColors.textSecondary)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    WanspotColors.surface,
                    in: RoundedRectangle(cornerRadius: 14)
                )
            }
        }
        .padding(.top, 40)
        .overlay(alignment: .top) { Divider() }
    }

    private func openSpot(_ spot: ArticleLinkedSpot) {
        guard let routeID = spot.routeID else { return }
        Task {
            if let place = spot.row.placeResult {
                await model.spotDetailNavigationState.setPlace(
                    routeID: routeID,
                    place: place
                )
                await model.spotDetailNavigationState.setHandoff(
                    routeID: routeID,
                    place: place
                )
                await model.spotDetailNavigationState.stash(
                    spotID: routeID,
                    place: place
                )
            }
            router.navigate(to: .spot(id: routeID), in: .articles)
        }
    }

    private func prepareShare() {
        guard
            let article = store.article,
            let siteURL = model.wanspotSiteURL
                ?? URL(string: "https://www.wanspot.app")
        else {
            return
        }
        let content = ContentSharing.article(article, siteURL: siteURL)
        shareItems = [.text(content.text)]
        if let url = content.url {
            shareItems.append(.url(url))
        }
        showsShareSheet = true
    }
}

@MainActor
@Observable
private final class ArticleDetailStore {
    private(set) var article: ArticleDetail?
    private(set) var linkedSpots: [String: ArticleLinkedSpot] = [:]
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    private var repository: ArticlesRepository?
    private var loadedSlug: String?

    func configure(repository: ArticlesRepository?) {
        self.repository = repository
    }

    func load(slug: String, force: Bool = false) async {
        guard let repository else {
            errorMessage = ContentRepositoryError.unavailable.localizedDescription
            return
        }
        if loadedSlug == slug, !force { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let loaded = try await repository.fetchArticle(
                idOrSlug: slug,
                force: force
            )
            article = loaded
            loadedSlug = slug
            if let loaded {
                linkedSpots = await repository.fetchLinkedSpots(
                    for: loaded,
                    force: force
                )
            } else {
                linkedSpots = [:]
            }
        } catch {
            if article == nil {
                errorMessage = error.localizedDescription
            }
        }
    }
}

private struct FlowLayout: Layout {
    let spacing: CGFloat

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache _: inout ()
    ) -> CGSize {
        let result = arrange(
            proposal: proposal,
            subviews: subviews
        )
        return result.size
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache _: inout ()
    ) {
        let result = arrange(
            proposal: ProposedViewSize(
                width: bounds.width,
                height: proposal.height
            ),
            subviews: subviews
        )
        for (index, point) in result.points.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y),
                proposal: .unspecified
            )
        }
    }

    private func arrange(
        proposal: ProposedViewSize,
        subviews: Subviews
    ) -> (size: CGSize, points: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var points: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var usedWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            points.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            usedWidth = max(usedWidth, x - spacing)
        }
        return (
            CGSize(
                width: maxWidth.isFinite ? maxWidth : usedWidth,
                height: y + rowHeight
            ),
            points
        )
    }
}
