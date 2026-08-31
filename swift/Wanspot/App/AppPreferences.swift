import CoreLocation
import Foundation
import WanspotKit

@MainActor
final class AppPreferences {
    private enum Key {
        static let guestChosen = "auth:continue_as_guest"
        static let onboardingComplete = "onboarding_complete_v1"
        static let onboardingDog = "ob_dog"
        static let onboardingLocation = "ob_location"
        static let onboardingLocationGranted = "ob_location_granted"
        static let onboardingWalkAreaTags = "ob_walk_area_tags"
        static let postOnboardingTutorial = "post_onboarding_tutorial_hint"
        static let walkTimeHour = "walk_time_hour_v1"
        static let themePreference = "theme_preference_v1"
        static let morningNotificationEnabled =
            "walk_forecast_notification_enabled_v1"
        static let morningNotificationHour =
            "walk_forecast_notification_hour_v1"
        static let analyticsAnonymousID = "analytics_anonymous_id_v1"
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var hasChosenGuest: Bool {
        defaults.bool(forKey: Key.guestChosen)
    }

    var themePreference: AppThemePreference {
        guard
            let value = defaults.string(forKey: Key.themePreference),
            let preference = AppThemePreference(rawValue: value)
        else {
            return .system
        }
        return preference
    }

    var walkTimeHour: Int? {
        guard let value = defaults.object(forKey: Key.walkTimeHour) as? Int else {
            return nil
        }
        return (0 ... 23).contains(value) ? value : nil
    }

    var morningNotificationEnabled: Bool {
        defaults.bool(forKey: Key.morningNotificationEnabled)
    }

    var morningNotificationHour: Int {
        let value = defaults.object(
            forKey: Key.morningNotificationHour
        ) as? Int
        return MorningWalkNotificationSchedule(
            hour: value ?? MorningWalkNotificationSchedule.defaultHour
        ).hour
    }

    var analyticsAnonymousID: String {
        if
            let value = defaults.string(forKey: Key.analyticsAnonymousID)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
            !value.isEmpty
        {
            return value
        }
        let value = UUID().uuidString.lowercased()
        defaults.set(value, forKey: Key.analyticsAnonymousID)
        return value
    }

    func chooseGuest() {
        defaults.set(true, forKey: Key.guestChosen)
    }

    func clearGuestChoice() {
        defaults.removeObject(forKey: Key.guestChosen)
    }

    func saveThemePreference(_ preference: AppThemePreference) {
        defaults.set(preference.rawValue, forKey: Key.themePreference)
    }

    func saveMorningNotification(enabled: Bool, hour: Int) {
        defaults.set(enabled, forKey: Key.morningNotificationEnabled)
        defaults.set(
            MorningWalkNotificationSchedule(hour: hour).hour,
            forKey: Key.morningNotificationHour
        )
    }

    var isOnboardingComplete: Bool {
        defaults.bool(forKey: Key.onboardingComplete)
    }

    func markOnboardingComplete() {
        defaults.set(true, forKey: Key.onboardingComplete)
        defaults.set(true, forKey: Key.postOnboardingTutorial)
        clearOnboardingDraft()
    }

    func clearOnboardingCompletion() {
        defaults.removeObject(forKey: Key.onboardingComplete)
    }

    func saveDraft(_ draft: OnboardingDogDraft) {
        guard let data = try? JSONEncoder().encode(draft) else { return }
        defaults.set(data, forKey: Key.onboardingDog)
    }

    func loadDraft() -> OnboardingDogDraft? {
        guard let data = defaults.data(forKey: Key.onboardingDog) else {
            return nil
        }
        return try? JSONDecoder().decode(OnboardingDogDraft.self, from: data)
    }

    func saveLocation(_ location: CLLocationCoordinate2D) {
        defaults.set(true, forKey: Key.onboardingLocationGranted)
        defaults.set(
            ["lat": location.latitude, "lng": location.longitude],
            forKey: Key.onboardingLocation
        )
    }

    func markLocationDeclined() {
        defaults.set(false, forKey: Key.onboardingLocationGranted)
    }

    func saveWalkAreaTags(_ tags: [String]) {
        defaults.set(
            OnboardingCatalog.normalizeWalkAreaTags(tags),
            forKey: Key.onboardingWalkAreaTags
        )
    }

    func saveWalkTimeHour(_ hour: Int?) {
        if let hour {
            defaults.set(hour, forKey: Key.walkTimeHour)
        } else {
            defaults.set("", forKey: Key.walkTimeHour)
        }
    }

    func clearOnboardingDraft() {
        [
            Key.onboardingDog,
            Key.onboardingLocation,
            Key.onboardingLocationGranted,
            Key.onboardingWalkAreaTags,
        ].forEach { defaults.removeObject(forKey: $0) }
    }
}
