import Foundation
import WanspotKit

enum AppAnalyticsEventName: String, Sendable {
    case appOpened = "app_opened"
    case myPageViewed = "mypage_viewed"
    case loginPrompted = "login_prompted"
    case dogSettingsViewed = "dog_settings_viewed"
    case dogProfileUpdated = "dog_profile_updated"
    case dogPhotoUpdated = "dog_photo_updated"
    case dogVaccinesUpdated = "dog_vaccines_updated"
    case walkAreasUpdated = "walk_areas_updated"
    case likesViewed = "likes_viewed"
    case visitedHistoryViewed = "visited_history_viewed"
    case historySpotOpened = "history_spot_opened"
    case likeRemoved = "like_removed"
    case appSettingsViewed = "app_settings_viewed"
    case themeChanged = "theme_changed"
    case notificationSettingsViewed = "notification_settings_viewed"
    case notificationPermissionRequested =
        "notification_permission_requested"
    case notificationScheduleEnabled =
        "notification_schedule_enabled"
    case notificationScheduleDisabled =
        "notification_schedule_disabled"
    case walkForecastViewed = "walk_forecast_viewed"
    case legalLinkOpened = "legal_link_opened"
    case supportLinkOpened = "support_link_opened"
    case signedOut = "signed_out"
    case accountDeletionRequested = "account_deletion_requested"
}

struct AppAnalyticsEvent: Sendable {
    let name: AppAnalyticsEventName
    let storageType: UserEventType
    let properties: [String: JSONValue]

    init(
        _ name: AppAnalyticsEventName,
        storageType: UserEventType = .eventView,
        properties: [String: JSONValue] = [:]
    ) {
        self.name = name
        self.storageType = storageType
        self.properties = properties
    }
}

struct AppAnalytics: Sendable {
    private let repository: SupabaseUserEventsRepository
    private let anonymousID: String
    private let sessionID: String
    private let appVersion: String?

    init(
        repository: SupabaseUserEventsRepository,
        anonymousID: String,
        bundle: Bundle = .main,
        sessionID: UUID = UUID()
    ) {
        self.repository = repository
        self.anonymousID = anonymousID
        self.sessionID = sessionID.uuidString.lowercased()
        appVersion = bundle.object(
            forInfoDictionaryKey: "CFBundleShortVersionString"
        ) as? String
    }

    func track(
        _ descriptor: AppAnalyticsEvent,
        userID: String?,
        spotID: String? = nil,
        dog: DogProfile? = nil
    ) {
        var properties = descriptor.properties
        properties["event_name"] = .string(descriptor.name.rawValue)
        properties["event_schema"] = .string("amplitude_compatible_v1")
        let event = UserEvent(
            eventType: descriptor.storageType,
            anonymousID: anonymousID,
            properties: properties,
            userID: userID,
            spotID: spotID,
            dogBreed: dog?.breed,
            dogSize: dog?.size,
            dogID: dog?.id,
            dogAgeMonths: dog?.birthday.flatMap(dogAgeMonths),
            platform: "ios",
            appVersion: appVersion,
            sessionID: sessionID
        )
        let repository = repository
        Task(priority: .utility) {
            try? await repository.record(event)
        }
    }
}

private func dogAgeMonths(_ birthday: String) -> Int? {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.isLenient = false
    guard let birthday = formatter.date(from: birthday) else { return nil }
    let months = Calendar(identifier: .gregorian).dateComponents(
        [.month],
        from: birthday,
        to: Date()
    ).month
    return months.map { min(max($0, 0), 360) }
}
