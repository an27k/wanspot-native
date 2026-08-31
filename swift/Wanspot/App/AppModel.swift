import Foundation
import Observation
import Supabase
import WanspotKit

enum AppGate: Equatable {
    case loading
    case authentication
    case onboarding
    case main
    case unavailable(String)
}

enum AppModelError: LocalizedError {
    case unavailable
    case emailConfirmationRequired
    case missingSession
    case missingDog

    var errorDescription: String? {
        switch self {
        case .unavailable:
            "アプリの設定を読み込めませんでした。"
        case .emailConfirmationRequired:
            "確認メールを送信しました。メール内のリンクを開いてからログインしてください。"
        case .missingSession:
            "ログイン情報が見つかりません。もう一度ログインしてください。"
        case .missingDog:
            "愛犬プロフィールが見つかりません。"
        }
    }
}

@MainActor
@Observable
final class AppModel {
    private(set) var gate: AppGate = .loading
    private(set) var session: Session?
    private(set) var primaryDog: DogProfile?
    private(set) var themePreference: AppThemePreference

    let client: SupabaseClient?
    let profileRepository: SupabaseProfileRepository?
    let dogPhotosRepository: SupabaseDogPhotosRepository?
    let spotActivityRepository: SupabaseSpotActivityRepository?
    let visitsRepository: SupabaseVisitsRepository?
    let userEventsRepository: SupabaseUserEventsRepository?
    let wanspotAPIClient: WanspotAPIClient?
    let chatAPIClient: ChatAPIClient?
    // チャット送信時に添える「いま見ている画面」の文脈。表示中の画面が設定・解除する
    var chatScreenContext: ChatScreenContext?
    let userSpotHistoryResolver: UserSpotHistoryResolver?
    let spotsRepository: SpotsRepository?
    let cachedWanspotService: CachedWanspotService?
    let nearbyRepository: NearbyRepository?
    let weatherRepository: WeatherRepository?
    let calendarRepository: CalendarRepository?
    let articlesRepository: ArticlesRepository?
    let wanspotSiteURL: URL?
    let features: FeatureConfiguration
    // チャットはシートより長生きさせる。カードからスポット等へ遷移して
    // シートが閉じても会話を残すため、寿命をアプリ側で持つ
    let chatStore = ChatStore()
    let spotDetailNavigationState = SpotDetailNavigationState()
    let calendarEventNavigationState = CalendarEventNavigationState()

    // slug / id しか持たない入口（チャットのイベントカード・イベントの
    // ディープリンク）からカレンダーイベント本体を復元する共通経路
    var calendarEventLookup: CalendarEventLookup? {
        calendarRepository.map {
            CalendarEventLookup(
                repository: $0,
                navigationState: calendarEventNavigationState
            )
        }
    }

    private let preferences: AppPreferences
    private let analytics: AppAnalytics?
    private let onboardingService: OnboardingService?
    private let bypassesAuthStartup: Bool
    private var authStateTask: Task<Void, Never>?
    private var hasStarted = false

    init(
        bundle: Bundle = .main,
        environment: [String: String] = ProcessInfo.processInfo.environment,
        preferences: AppPreferences = AppPreferences(),
        transport: any HTTPTransport = URLSessionHTTPTransport(),
        initialGate: AppGate? = nil,
        analyticsEnabled: Bool = true,
        bypassesAuthStartup: Bool = false
    ) {
        self.preferences = preferences
        self.bypassesAuthStartup = bypassesAuthStartup
        themePreference = preferences.themePreference
        do {
            let configuration = try AppConfiguration.load(
                bundle: bundle,
                environment: environment
            )
            let client = SupabaseClientFactory.make(configuration: configuration)
            let repository = SupabaseProfileRepository(client: client)
            let apiClient = SupabaseClientFactory.makeWanspotAPIClient(
                configuration: configuration,
                supabaseClient: client,
                transport: transport
            )
            let cache = MemoryCache()
            self.client = client
            profileRepository = repository
            dogPhotosRepository = SupabaseDogPhotosRepository(
                client: client,
                cache: cache
            )
            spotActivityRepository = SupabaseSpotActivityRepository(
                client: client
            )
            visitsRepository = SupabaseVisitsRepository(client: client)
            let userEventsRepository = SupabaseUserEventsRepository(
                client: client
            )
            self.userEventsRepository = userEventsRepository
            wanspotAPIClient = apiClient
            chatAPIClient = ChatAPIClient(
                configuration: configuration,
                transport: transport,
                accessTokenProvider: {
                    try? await client.auth.session.accessToken
                }
            )
            userSpotHistoryResolver = UserSpotHistoryResolver(
                client: apiClient
            )
            spotsRepository = SpotsRepository(client: apiClient)
            cachedWanspotService = CachedWanspotService(
                client: apiClient,
                cache: cache
            )
            nearbyRepository = NearbyRepository(
                client: apiClient,
                cache: cache
            )
            weatherRepository = WeatherRepository(
                cache: cache,
                transport: transport
            )
            calendarRepository = CalendarRepository(
                client: apiClient,
                cache: cache
            )
            articlesRepository = ArticlesRepository(
                client: apiClient,
                cache: cache
            )
            wanspotSiteURL = configuration.wanspotSiteURL
            features = FeatureConfiguration.resolve(
                appConfiguration: configuration,
                adsProviderAvailable: false
            )
            analytics = analyticsEnabled
                ? AppAnalytics(
                    repository: userEventsRepository,
                    anonymousID: preferences.analyticsAnonymousID,
                    bundle: bundle
                )
                : nil
            onboardingService = OnboardingService(
                profileRepository: repository
            )
            if let initialGate {
                gate = initialGate
            }
        } catch {
            client = nil
            profileRepository = nil
            dogPhotosRepository = nil
            spotActivityRepository = nil
            visitsRepository = nil
            userEventsRepository = nil
            wanspotAPIClient = nil
            chatAPIClient = nil
            userSpotHistoryResolver = nil
            spotsRepository = nil
            cachedWanspotService = nil
            nearbyRepository = nil
            weatherRepository = nil
            calendarRepository = nil
            articlesRepository = nil
            wanspotSiteURL = nil
            features = .adsDisabled
            analytics = nil
            onboardingService = nil
            gate = .unavailable(error.localizedDescription)
        }
    }

    var isAuthenticated: Bool {
        session != nil
    }

    var currentUserID: String? {
        session.map(userID(for:))
    }

    func setThemePreference(_ preference: AppThemePreference) {
        themePreference = preference
        preferences.saveThemePreference(preference)
    }

    func track(
        _ event: AppAnalyticsEvent,
        spotID: String? = nil
    ) {
        analytics?.track(
            event,
            userID: currentUserID,
            spotID: spotID,
            dog: primaryDog
        )
    }

    @discardableResult
    func refreshPrimaryDog() async throws -> DogProfile? {
        guard
            let userID = currentUserID,
            let profileRepository
        else {
            primaryDog = nil
            return nil
        }
        let dog = try await profileRepository.fetchPrimaryDog(userID: userID)
        primaryDog = dog
        return dog
    }

    func updateDogIdentity(
        _ submission: DogProfileFormSubmission
    ) async throws {
        guard let profileRepository else {
            throw AppModelError.unavailable
        }
        let dog = try await requirePrimaryDog()
        try await profileRepository.updateDogIdentity(
            dogID: dog.id,
            name: submission.name,
            breed: submission.breed,
            birthday: submission.birthday,
            gender: submission.gender,
            size: submission.size,
            photoURL: dog.photoURL
        )
        _ = try await refreshPrimaryDog()
    }

    func updateDogPhoto(jpegData: Data?) async throws {
        guard let profileRepository, let userID = currentUserID else {
            throw AppModelError.missingSession
        }
        let dog = try await requirePrimaryDog()
        let photoURL: URL?
        if let jpegData {
            photoURL = try await profileRepository.uploadDogPhoto(
                userID: userID,
                jpegData: jpegData
            )
        } else {
            photoURL = nil
        }
        try await profileRepository.updateDogIdentity(
            dogID: dog.id,
            name: dog.name,
            breed: dog.breed,
            birthday: dog.birthday,
            gender: dog.gender,
            size: dog.size,
            photoURL: photoURL
        )
        _ = try await refreshPrimaryDog()
    }

    func updateDogVaccination(
        kind: DogVaccineKind,
        vaccinatedAt: String?
    ) async throws {
        guard let profileRepository else {
            throw AppModelError.unavailable
        }
        let dog = try await requirePrimaryDog()
        try await profileRepository.updateDogVaccination(
            dogID: dog.id,
            kind: kind,
            vaccinatedAt: vaccinatedAt
        )
        _ = try await refreshPrimaryDog()
    }

    func fetchWalkAreaTags() async throws -> [String] {
        guard
            let userID = currentUserID,
            let profileRepository
        else {
            throw AppModelError.missingSession
        }
        return try await profileRepository.fetchWalkAreaTags(userID: userID)
    }

    func updateWalkAreaTags(_ tags: [String]) async throws {
        guard
            let userID = currentUserID,
            let profileRepository
        else {
            throw AppModelError.missingSession
        }
        let tags = OnboardingCatalog.normalizeWalkAreaTags(tags)
        try await profileRepository.updateWalkAreaTags(
            userID: userID,
            tags: tags
        )
        preferences.saveWalkAreaTags(tags)
    }

    func start() async {
        guard !hasStarted else { return }
        hasStarted = true
        guard !bypassesAuthStartup else { return }
        track(
            AppAnalyticsEvent(
                .appOpened,
                storageType: .appOpen
            )
        )
        guard let client else { return }

        authStateTask = Task { [weak self, client] in
            for await change in client.auth.authStateChanges {
                guard !Task.isCancelled else { return }
                await self?.receiveAuthState(change.session)
            }
        }

        do {
            let session = try await client.auth.session
            await receiveAuthState(session)
        } catch {
            await receiveAuthState(nil)
        }
    }

    func continueAsGuest() {
        preferences.chooseGuest()
        session = nil
        gate = .main
    }

    func requestAuthentication() {
        gate = .authentication
    }

    func signIn(email: String, password: String) async throws {
        guard let client else { throw AppModelError.unavailable }
        let session = try await client.auth.signIn(
            email: email.trimmingCharacters(in: .whitespacesAndNewlines),
            password: password
        )
        preferences.clearGuestChoice()
        self.session = session
        await routeAuthenticatedSession(session)
    }

    func signUp(email: String, password: String) async throws {
        guard let client else { throw AppModelError.unavailable }
        let response = try await client.auth.signUp(
            email: email.trimmingCharacters(in: .whitespacesAndNewlines),
            password: password
        )
        guard let session = response.session else {
            throw AppModelError.emailConfirmationRequired
        }
        preferences.clearGuestChoice()
        preferences.clearOnboardingCompletion()
        self.session = session
        gate = .onboarding
    }

    func signInWithGoogle() async throws {
        guard let client else { throw AppModelError.unavailable }
        let session = try await client.auth.signInWithOAuth(
            provider: .google,
            redirectTo: SupabaseClientFactory.oauthRedirectURL
        )
        preferences.clearGuestChoice()
        self.session = session
        await routeAuthenticatedSession(session)
    }

    func signInWithApple(
        identityToken: Data,
        displayName: String?
    ) async throws {
        guard
            let client,
            let token = String(data: identityToken, encoding: .utf8)
        else {
            throw AppModelError.unavailable
        }
        let session = try await client.auth.signInWithIdToken(
            credentials: OpenIDConnectCredentials(
                provider: .apple,
                idToken: token
            )
        )
        preferences.clearGuestChoice()
        self.session = session

        if let displayName, !displayName.isEmpty {
            try? await profileRepository?.updateOwnerNameIfEmpty(
                userID: userID(for: session),
                displayName: displayName
            )
        }
        await routeAuthenticatedSession(session)
    }

    func signOut() async {
        try? await client?.auth.signOut()
        preferences.clearOnboardingCompletion()
        session = nil
        primaryDog = nil
        // 会話はアプリ側で保持しているため、明示的に捨てないと次の利用者に残る
        chatStore.clearConversation()
        // RN版同様、その回はゲストとしてタブに留める。ゲスト選択は保存しないため、
        // 次回起動時は新規登録の入口へ戻る。
        gate = .main
    }

    func deleteAccount() async throws -> AccountDeleteResponse {
        guard let wanspotAPIClient, session != nil else {
            throw AppModelError.missingSession
        }
        let response = try await wanspotAPIClient.deleteAccount()
        await signOut()
        return response
    }

    func handleOpenURL(_ url: URL) {
        guard
            url.scheme == SupabaseClientFactory.oauthRedirectURL.scheme,
            url.host == "auth"
        else {
            return
        }
        client?.auth.handle(url)
    }

    func savedOnboardingDraft() -> OnboardingDogDraft? {
        preferences.loadDraft()
    }

    func saveOnboardingDraft(
        _ draft: OnboardingDogDraft,
        walkTimeWasPicked: Bool,
        walkTimeHour: Int?
    ) {
        preferences.saveDraft(draft)
        if walkTimeWasPicked {
            preferences.saveWalkTimeHour(walkTimeHour)
        }
    }

    func uploadDogPhoto(_ data: Data) async throws -> URL {
        guard
            let profileRepository,
            let session
        else {
            throw AppModelError.missingSession
        }
        return try await profileRepository.uploadDogPhoto(
            userID: userID(for: session),
            jpegData: data
        )
    }

    func completeOnboarding(
        draft: OnboardingDogDraft,
        walkAreaTags: [String]
    ) async throws {
        guard
            let onboardingService,
            let session
        else {
            throw AppModelError.missingSession
        }
        _ = try await onboardingService.complete(
            userID: userID(for: session),
            email: session.user.email,
            draft: draft,
            walkAreaTags: walkAreaTags
        )
        preferences.saveWalkAreaTags(walkAreaTags)
        preferences.markOnboardingComplete()
        gate = .main
    }

    func saveOnboardingLocation(_ coordinate: (Double, Double)) {
        preferences.saveLocation(
            .init(latitude: coordinate.0, longitude: coordinate.1)
        )
    }

    func markOnboardingLocationDeclined() {
        preferences.markLocationDeclined()
    }

    private func receiveAuthState(_ session: Session?) async {
        let priorUserID = self.session.map(userID(for:))
        self.session = session
        if priorUserID != session.map(userID(for:)) {
            primaryDog = nil
            chatStore.clearConversation()
        }
        guard let session else {
            gate = switch AppGateRules.destination(
                hasSession: false,
                hasChosenGuest: preferences.hasChosenGuest,
                isOnboardingComplete: false,
                dogLookup: .notRequested
            ) {
            case .authentication:
                .authentication
            case .onboarding:
                .onboarding
            case .main:
                .main
            }
            return
        }
        preferences.clearGuestChoice()
        let newUserID = userID(for: session)
        if
            priorUserID != newUserID
                || gate == .loading
                || gate == .authentication
        {
            await routeAuthenticatedSession(session)
        }
    }

    private func routeAuthenticatedSession(_ session: Session) async {
        if preferences.isOnboardingComplete {
            gate = .main
            return
        }
        guard let onboardingService else {
            gate = .main
            return
        }
        let dogLookup = await onboardingService.dogLookupOutcome(
            userID: userID(for: session)
        )
        let destination = AppGateRules.destination(
            hasSession: true,
            hasChosenGuest: false,
            isOnboardingComplete: false,
            dogLookup: dogLookup
        )
        switch destination {
        case .authentication:
            gate = .authentication
        case .onboarding:
            preferences.clearOnboardingCompletion()
            gate = .onboarding
        case .main:
            if dogLookup == .exists {
                preferences.markOnboardingComplete()
            }
            gate = .main
        }
    }

    private func userID(for session: Session) -> String {
        session.user.id.uuidString.lowercased()
    }

    private func requirePrimaryDog() async throws -> DogProfile {
        if let primaryDog {
            return primaryDog
        }
        guard let dog = try await refreshPrimaryDog() else {
            throw AppModelError.missingDog
        }
        return dog
    }
}
