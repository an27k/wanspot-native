import Foundation
import Observation
import WanspotKit

enum AppTab: String, CaseIterable, Hashable, Identifiable, Sendable {
    case search
    case articles
    case calendar
    case mypage

    var id: Self { self }

    var title: String {
        switch self {
        case .search:
            "検索"
        case .articles:
            "まとめ"
        case .calendar:
            "カレンダー"
        case .mypage:
            "マイページ"
        }
    }

    var systemImage: String {
        switch self {
        case .search:
            "magnifyingglass"
        case .articles:
            "newspaper"
        case .calendar:
            "calendar"
        case .mypage:
            "person.crop.circle"
        }
    }
}

enum DogSettingsDestination: Hashable, Sendable {
    case identity
    case photo
    case vaccines
    case walkAreas
}

enum AppRoute: Hashable, Sendable {
    case spot(id: String)
    case article(slug: String)
    case calendar(slug: String)
    case likes
    case visitedHistory
    case dogSettings
    case editDog(DogSettingsDestination)
    case walkForecast
    case appSettings
    case notificationSettings
    case accountDelete

    var preferredTab: AppTab {
        switch self {
        case .spot:
            .search
        case .article:
            .articles
        case .calendar:
            .calendar
        case .likes,
             .visitedHistory,
             .dogSettings,
             .editDog,
             .walkForecast,
             .appSettings,
             .notificationSettings,
             .accountDelete:
            .mypage
        }
    }
}

@MainActor
@Observable
final class AppRouter {
    var selectedTab: AppTab

    private var paths: [AppTab: [AppRoute]]

    init(
        selectedTab: AppTab = .search,
        paths: [AppTab: [AppRoute]] = [:]
    ) {
        self.selectedTab = selectedTab
        self.paths = paths
    }

    func path(for tab: AppTab) -> [AppRoute] {
        paths[tab] ?? []
    }

    func setPath(_ path: [AppRoute], for tab: AppTab) {
        paths[tab] = path
    }

    func navigate(to route: AppRoute, in tab: AppTab? = nil) {
        let destinationTab = tab ?? route.preferredTab
        var path = path(for: destinationTab)
        guard path.last != route else {
            selectedTab = destinationTab
            return
        }
        path.append(route)
        paths[destinationTab] = path
        selectedTab = destinationTab
    }

    @discardableResult
    func open(url: URL) -> Bool {
        guard let route = Self.route(for: url) else { return false }
        navigate(to: route)
        return true
    }

    func pop(in tab: AppTab? = nil) {
        let destinationTab = tab ?? selectedTab
        var path = path(for: destinationTab)
        guard !path.isEmpty else { return }
        path.removeLast()
        paths[destinationTab] = path
    }

    func popToRoot(in tab: AppTab? = nil) {
        paths[tab ?? selectedTab] = []
    }

    func reset() {
        paths.removeAll()
        selectedTab = .search
    }

    static func route(for url: URL) -> AppRoute? {
        switch WanspotDeepLink.destination(for: url) {
        case let .spot(id):
            .spot(id: id)
        case let .article(slug):
            .article(slug: slug)
        case let .calendar(slug):
            .calendar(slug: slug)
        case .walkForecast:
            .walkForecast
        case .notificationSettings:
            .notificationSettings
        case nil:
            nil
        }
    }
}
