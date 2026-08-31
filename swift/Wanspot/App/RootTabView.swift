import SwiftUI

struct RootTabView: View {
    @Environment(AppModel.self) private var model
    @Environment(AppRouter.self) private var router
    @State private var showsChatSheet = false

    var body: some View {
        @Bindable var router = router

        TabView(selection: $router.selectedTab) {
            tabContent(.search)
            tabContent(.articles)
            tabContent(.calendar)
            tabContent(.mypage)
        }
        .tint(WanspotColors.primary)
        .accessibilityIdentifier("root.tabs")
        // チャットFABは未ログイン時は非表示（相談枠が個人単位のため）
        .overlayPreferenceValue(
            ChatFABClearanceKey.self,
            alignment: .bottomTrailing
        ) { clearance in
            if model.isAuthenticated {
                ChatFAB { showsChatSheet = true }
                    .padding(.trailing, 16)
                    .padding(.bottom, Self.tabBarInset + clearance)
            }
        }
        .sheet(isPresented: $showsChatSheet) {
            ChatSheetView()
        }
    }

    // タブバーを避けるための固定ぶん。画面ごとの下部バーは clearance で加算する
    private static let tabBarInset: CGFloat = 66

    private func tabContent(_ tab: AppTab) -> some View {
        let isSelected = tab == router.selectedTab

        return AppTabNavigationStack(tab: tab)
            // 選択されていないタブも階層に残るので、そのぶんの申告は捨てる
            // （詳細から戻ったときや別タブへ移ったときに値が残らないように）
            .transformPreference(ChatFABClearanceKey.self) { value in
                if !isSelected {
                    value = 0
                }
            }
            .tabItem {
                Image(systemName: tab.systemImage)
                    .accessibilityLabel(tab.title)
                    .accessibilityIdentifier("tab.\(tab.rawValue)")
            }
            .tag(tab)
    }
}

private struct AppTabNavigationStack: View {
    @Environment(AppRouter.self) private var router

    let tab: AppTab

    var body: some View {
        let isPushed = !router.path(for: tab).isEmpty

        return NavigationStack(path: path) {
            rootView
                // push 中は根の画面も階層に残るので、そのぶんの申告は捨てる
                // （前面の画面が申告した値だけを FAB に効かせる）
                .transformPreference(ChatFABClearanceKey.self) { value in
                    if isPushed {
                        value = 0
                    }
                }
                .navigationDestination(for: AppRoute.self) { route in
                    switch route {
                    case let .spot(id):
                        SpotDetailView(routeID: id)
                    case let .article(slug):
                        ArticleDetailView(slug: slug)
                    case let .calendar(slug):
                        CalendarEventDetailView(slug: slug)
                    case .likes:
                        LikesListView()
                    case .visitedHistory:
                        VisitedHistoryView()
                    case .dogSettings:
                        DogSettingsView()
                    case let .editDog(destination):
                        switch destination {
                        case .identity:
                            DogIdentityEditView()
                        case .photo:
                            DogPhotoEditView()
                        case .vaccines:
                            DogVaccinesEditView()
                        case .walkAreas:
                            WalkAreaEditView()
                        }
                    case .walkForecast:
                        WalkForecastView()
                    case .appSettings:
                        AppSettingsView()
                    case .notificationSettings:
                        NotificationSettingsView()
                    case .accountDelete:
                        AccountDeleteView()
                    }
                }
        }
    }

    @ViewBuilder
    private var rootView: some View {
        switch tab {
        case .search:
            SearchTabView()
        case .articles:
            ArticlesTabView()
        case .calendar:
            CalendarTabView()
        case .mypage:
            MyPageTabView()
        }
    }

    private var path: Binding<[AppRoute]> {
        Binding(
            get: { router.path(for: tab) },
            set: { router.setPath($0, for: tab) }
        )
    }
}
