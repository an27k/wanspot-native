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
        .overlay(alignment: .bottomTrailing) {
            if model.isAuthenticated {
                ChatFAB { showsChatSheet = true }
                    .padding(.trailing, 16)
                    .padding(.bottom, 66)
            }
        }
        .sheet(isPresented: $showsChatSheet) {
            ChatSheetView()
        }
    }

    private func tabContent(_ tab: AppTab) -> some View {
        AppTabNavigationStack(tab: tab)
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
        NavigationStack(path: path) {
            rootView
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
