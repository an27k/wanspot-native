import SwiftUI
import WanspotKit

struct SpotDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(AppRouter.self) private var router
    @Environment(LocationSession.self) private var locationSession

    @State private var store: SpotDetailStore
    @State private var showsShareSheet = false
    @State private var shareItems: [WanspotShareItem] = []
    @State private var showsTipSheet = false
    @State private var showsCancelVisitConfirmation = false
    @State private var authenticationPrompt: WanspotAuthenticationPrompt?
    @State private var reviewScrollRequest = 0

    init(routeID: String) {
        _store = State(
            initialValue: SpotDetailStore(routeID: routeID)
        )
    }

    var body: some View {
        @Bindable var store = store

        Group {
            if store.isLoading, store.detail == nil {
                WanspotLoadingState(title: "スポット詳細を読み込み中…")
            } else if let message = store.loadError, store.detail == nil {
                WanspotErrorState(
                    title: "スポット情報を取得できませんでした",
                    message: message,
                    actionTitle: "再試行"
                ) {
                    Task { await load() }
                }
            } else if let detail = store.detail {
                content(detail)
                    .safeAreaInset(edge: .bottom, spacing: 0) {
                        bottomActionBar
                    }
            } else {
                WanspotEmptyState(
                    title: "スポットが見つかりませんでした",
                    message: "一覧からもう一度お試しください。",
                    systemImage: "mappin.slash"
                )
            }
        }
        .background(WanspotColors.paper)
        .accessibilityIdentifier("spotDetail.screen")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            if store.detail != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        prepareShare()
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .accessibilityLabel("シェア")
                }
            }
        }
        .task(id: model.currentUserID ?? "guest") {
            await load()
        }
        .onAppear { model.chatScreenContext = .spotDetail(store.detail) }
        .onChange(of: store.detail) { model.chatScreenContext = .spotDetail(store.detail) }
        .onDisappear {
            model.chatScreenContext = nil
            guard store.isVisited, !store.memoWasSaved else { return }
            Task { await store.saveMemo() }
        }
        .sheet(isPresented: $showsShareSheet) {
            WanspotShareSheet(items: shareItems)
        }
        .sheet(isPresented: $showsTipSheet) {
            if let detail = store.detail {
                SpotInformationTipSheet(
                    spotName: detail.name,
                    isSubmitting: store.isTipSubmitting,
                    onSubmit: { body in
                        await store.submitTip(body)
                    }
                )
            }
        }
        .confirmationDialog(
            "「行った」を取り消しますか？",
            isPresented: $showsCancelVisitConfirmation,
            titleVisibility: .visible
        ) {
            Button("取り消す", role: .destructive) {
                Task { await store.cancelVisit() }
            }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("本日の記録と、あなたの評価・メモが削除されます。")
        }
        .alert(item: $store.notice) { notice in
            Alert(
                title: Text(notice.title),
                message: Text(notice.message),
                dismissButton: .default(Text("OK"))
            )
        }
    }

    private func content(_ detail: SpotDetail) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 16) {
                    SpotDetailHero(
                        detail: detail,
                        photoURLs: store.photoURLs
                    )

                    VStack(spacing: 16) {
                        SpotDetailIdentitySection(
                            detail: detail,
                            distanceLabel: distanceLabel(for: detail)
                        )

                        if store.isVisited, model.isAuthenticated {
                            SpotUserReviewSection(store: store)
                                .id("spotDetail.userReview")
                        }

                        SpotPetAccessSection(detail: detail)

                        SpotOpeningHoursSection(detail: detail)

                        if model.isAuthenticated {
                            SpotAIReviewSection(
                                isLoading: store.isAILoading,
                                summary: store.aiSummary,
                                emptyReason: store.aiEmptyReason,
                                onRetry: {
                                    Task { await store.reloadAI() }
                                },
                                onSubmitInformation: requestTipSubmission
                            )
                        } else {
                            AuthRequiredInlineCard(
                                title: "ワンスポ AIレビュー",
                                message: "うちの子の年齢やサイズに合わせた読み方は、ログイン後に表示します。住所・営業時間・地図はこのまま見られます。",
                                onAuthenticate: model.requestAuthentication
                            )
                            .accessibilityIdentifier(
                                "spotDetail.aiLoginRequired"
                            )
                        }

                        SpotDetailsSection(detail: detail)

                        if !store.relatedArticles.isEmpty {
                            SpotRelatedArticlesSection(
                                articles: store.relatedArticles
                            ) { article in
                                router.navigate(
                                    to: .article(slug: article.slug),
                                    in: router.selectedTab
                                )
                            }
                        }
                    }
                    .padding(.horizontal, WanspotMetrics.pagePadding)
                    .padding(.bottom, 8)
                }
            }
            .scrollIndicators(.hidden)
            .refreshable {
                await load()
            }
            .onChange(of: reviewScrollRequest) {
                withAnimation(.snappy) {
                    proxy.scrollTo(
                        "spotDetail.userReview",
                        anchor: .center
                    )
                }
            }
        }
    }

    private var bottomActionBar: some View {
        HStack(spacing: 12) {
            Button {
                requireAuthentication(for: .like) {
                    Task { await store.toggleLike() }
                }
            } label: {
                HStack(spacing: 8) {
                    if store.isLikeBusy {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Image(
                            systemName: store.isLiked
                                ? "heart.fill"
                                : "heart"
                        )
                        .foregroundStyle(
                            store.isLiked
                                ? WanspotColors.primary
                                : WanspotColors.textPrimary
                        )
                    }
                    Text(
                        store.likeCount > 0
                            ? "いいね \(store.likeCount)"
                            : "いいね"
                    )
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
                .frame(height: 54)
                .foregroundStyle(WanspotColors.textPrimary)
                .background(
                    store.isLiked
                        ? WanspotColors.tintWeak
                        : WanspotColors.surface,
                    in: Capsule()
                )
                .overlay {
                    Capsule()
                        .stroke(
                            store.isLiked
                                ? WanspotColors.primary.opacity(0.45)
                                : WanspotColors.border
                        )
                }
            }
            .buttonStyle(.plain)
            .disabled(store.isLikeBusy)
            .accessibilityLabel(
                store.isLiked ? "いいねを取り消す" : "いいねする"
            )

            Button {
                requireAuthentication(for: .visit) {
                    if store.isVisited {
                        showsCancelVisitConfirmation = true
                    } else {
                        Task {
                            await store.recordVisit()
                            if store.isVisited {
                                reviewScrollRequest += 1
                            }
                        }
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    if store.isVisitBusy {
                        ProgressView()
                            .tint(WanspotColors.onPrimary)
                    } else {
                        Image(
                            systemName: store.isVisited
                                ? "checkmark"
                                : "pawprint.fill"
                        )
                    }
                    Text("行った")
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
                .frame(height: 54)
                .foregroundStyle(WanspotColors.onPrimary)
                .background(WanspotColors.primary, in: Capsule())
            }
            .buttonStyle(.plain)
            .disabled(store.isVisitBusy)
            .accessibilityLabel(
                store.isVisited
                    ? "行った記録を取り消す"
                    : "行った記録を保存する"
            )
        }
        .padding(.horizontal, WanspotMetrics.pagePadding)
        .padding(.top, 10)
        .padding(.bottom, 8)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Divider()
        }
        .wanspotAuthenticationPrompt($authenticationPrompt) {
            model.requestAuthentication()
        }
    }

    private func load() async {
        guard
            let spotsRepository = model.spotsRepository,
            let activityRepository = model.spotActivityRepository,
            let visitsRepository = model.visitsRepository,
            let cachedService = model.cachedWanspotService,
            let profileRepository = model.profileRepository
        else {
            return
        }
        let resolver = SpotDetailResolver(
            repository: spotsRepository,
            navigationState: model.spotDetailNavigationState
        )
        let coordinate = locationSession.location.map {
            NearbyCoordinate(
                latitude: $0.coordinate.latitude,
                longitude: $0.coordinate.longitude
            )
        }
        await store.load(
            resolver: resolver,
            spotsRepository: spotsRepository,
            activityRepository: activityRepository,
            visitsRepository: visitsRepository,
            cachedService: cachedService,
            profileRepository: profileRepository,
            articlesRepository: model.articlesRepository,
            navigationState: model.spotDetailNavigationState,
            userID: model.currentUserID,
            location: coordinate
        )
    }

    private func distanceLabel(for detail: SpotDetail) -> String? {
        guard
            let current = locationSession.location,
            let destination = detail.coordinate
        else {
            return nil
        }
        let origin = NearbyCoordinate(
            latitude: current.coordinate.latitude,
            longitude: current.coordinate.longitude
        )
        let meters = NearbyGeometry.distanceMeters(
            from: origin,
            to: destination
        )
        return NearbyGeometry.distanceLabel(meters)
    }

    private func requireAuthentication(
        for prompt: WanspotAuthenticationPrompt,
        action: () -> Void
    ) {
        guard model.isAuthenticated else {
            authenticationPrompt = prompt
            return
        }
        action()
    }

    private func requestTipSubmission() {
        guard model.isAuthenticated else {
            model.requestAuthentication()
            return
        }
        showsTipSheet = true
    }

    private func prepareShare() {
        guard
            let detail = store.detail
        else {
            return
        }
        guard
            let siteURL = model.wanspotSiteURL
                ?? URL(string: "https://www.wanspot.app")
        else {
            return
        }
        let content = SpotSharing.content(for: detail, siteURL: siteURL)
        var items = [WanspotShareItem.text(content.text)]
        if let url = content.url {
            items.append(.url(url))
        }
        shareItems = items
        showsShareSheet = true
    }
}
