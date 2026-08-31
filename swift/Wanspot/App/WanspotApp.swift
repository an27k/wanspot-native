import SwiftUI
import WanspotKit

@main
struct WanspotApp: App {
    @State private var model: AppModel
    @State private var router = AppRouter()
    @State private var locationSession: LocationSession
    @State private var notifications: MorningWalkNotificationService

    private let isUITesting: Bool
    private let uiTestDeepLink: URL?
    private let uiTestCalendarEvent: CalendarEvent?

    init() {
        let overrides = UITestBootstrap.resolve()
        let previewLocation = Self.previewLocationSimulation()
        let preferences = overrides?.preferences ?? AppPreferences()
        if let overrides {
            _model = State(
                initialValue: AppModel(
                    environment: overrides.environment,
                    preferences: preferences,
                    transport: overrides.transport,
                    initialGate: overrides.initialGate,
                    analyticsEnabled: false,
                    bypassesAuthStartup: true
                )
            )
            _locationSession = State(
                initialValue: LocationSession(
                    simulation: overrides.locationSimulation
                )
            )
        } else {
            _model = State(initialValue: AppModel(preferences: preferences))
            _locationSession = State(
                initialValue: previewLocation.map {
                    LocationSession(simulation: $0)
                } ?? LocationSession()
            )
        }
        _notifications = State(
            initialValue: MorningWalkNotificationService(
                preferences: preferences
            )
        )
        isUITesting = overrides != nil
        uiTestDeepLink = overrides?.deepLink
        uiTestCalendarEvent = overrides?.calendarEvent
    }

    private static func previewLocationSimulation()
        -> LocationSessionSimulation?
    {
        let environment = ProcessInfo.processInfo.environment
        guard
            let latitude = environment["WANSPOT_PREVIEW_LAT"]
                .flatMap(Double.init),
            let longitude = environment["WANSPOT_PREVIEW_LNG"]
                .flatMap(Double.init),
            (-90 ... 90).contains(latitude),
            (-180 ... 180).contains(longitude)
        else {
            return nil
        }
        return .fixed(latitude: latitude, longitude: longitude)
    }

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environment(model)
                .environment(router)
                .environment(locationSession)
                .environment(notifications)
                .preferredColorScheme(model.themePreference.colorScheme)
                .task {
                    if !isUITesting {
                        notifications.installDestinationHandler { destination in
                            navigate(to: destination.appRoute)
                        }
                        await notifications.refresh()
                        if notifications.isEnabled {
                            _ = await notifications.setEnabled(true)
                        }
                    }
                    await model.start()
                    if let uiTestDeepLink {
                        if let uiTestCalendarEvent {
                            await model.calendarEventNavigationState.set(
                                uiTestCalendarEvent
                            )
                        }
                        open(uiTestDeepLink)
                    }
                }
                .onOpenURL { url in
                    open(url)
                }
        }
    }

    private func open(_ url: URL) {
        model.handleOpenURL(url)
        guard let route = AppRouter.route(for: url) else { return }
        navigate(to: route)
    }

    private func navigate(to route: AppRoute) {
        guard !route.requiresAuthenticatedUser || model.isAuthenticated else {
            router.reset()
            model.requestAuthentication()
            return
        }
        router.navigate(to: route)
    }
}

private extension AppThemePreference {
    var colorScheme: ColorScheme? {
        switch self {
        case .system:
            nil
        case .light:
            .light
        case .dark:
            .dark
        }
    }
}

private extension LocalNotificationDestination {
    var appRoute: AppRoute {
        switch self {
        case .walkForecast:
            .walkForecast
        }
    }
}

private extension AppRoute {
    var requiresAuthenticatedUser: Bool {
        switch self {
        case .likes, .visitedHistory, .dogSettings, .editDog, .walkForecast,
             .notificationSettings, .accountDelete:
            true
        case .spot, .article, .calendar, .appSettings:
            false
        }
    }
}

private struct AppRootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        switch model.gate {
        case .loading:
            ProgressView("読み込み中…")
                .controlSize(.large)
        case .authentication:
            AuthenticationFlowView()
        case .onboarding:
            OnboardingFlowView()
        case .main:
            RootTabView()
        case let .unavailable(message):
            ContentUnavailableView(
                "設定を確認してください",
                systemImage: "exclamationmark.triangle",
                description: Text(message)
            )
            .padding()
        }
    }
}
