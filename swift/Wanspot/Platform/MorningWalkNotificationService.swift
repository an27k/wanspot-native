import Foundation
import Observation
import UserNotifications
import WanspotKit

enum NotificationPermissionStatus: Equatable {
    case notDetermined
    case denied
    case authorized
    case provisional
    case ephemeral

    var allowsScheduling: Bool {
        switch self {
        case .authorized, .provisional, .ephemeral:
            true
        case .notDetermined, .denied:
            false
        }
    }
}

@MainActor
@Observable
final class MorningWalkNotificationService:
    NSObject,
    @preconcurrency UNUserNotificationCenterDelegate
{
    private(set) var permissionStatus: NotificationPermissionStatus =
        .notDetermined
    private(set) var isEnabled: Bool
    private(set) var schedule: MorningWalkNotificationSchedule
    private(set) var isBusy = false
    private(set) var errorMessage: String?

    @ObservationIgnored
    private let center: UNUserNotificationCenter
    @ObservationIgnored
    private let preferences: AppPreferences
    @ObservationIgnored
    private var destinationHandler:
        ((LocalNotificationDestination) -> Void)?
    @ObservationIgnored
    private var pendingDestination: LocalNotificationDestination?

    init(
        preferences: AppPreferences,
        center: UNUserNotificationCenter = .current()
    ) {
        self.preferences = preferences
        self.center = center
        isEnabled = preferences.morningNotificationEnabled
        schedule = MorningWalkNotificationSchedule(
            hour: preferences.morningNotificationHour
        )
        super.init()
        center.delegate = self
    }

    func installDestinationHandler(
        _ handler: @escaping (LocalNotificationDestination) -> Void
    ) {
        destinationHandler = handler
        if let pendingDestination {
            self.pendingDestination = nil
            handler(pendingDestination)
        }
    }

    func refresh() async {
        let settings = await center.notificationSettings()
        permissionStatus = Self.status(settings.authorizationStatus)
        if isEnabled, !permissionStatus.allowsScheduling {
            isEnabled = false
            preferences.saveMorningNotification(
                enabled: false,
                hour: schedule.hour
            )
            cancelPending()
        }
    }

    @discardableResult
    func setEnabled(_ enabled: Bool) async -> Bool {
        guard !isBusy else { return isEnabled }
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }

        if !enabled {
            cancelPending()
            isEnabled = false
            preferences.saveMorningNotification(
                enabled: false,
                hour: schedule.hour
            )
            return true
        }

        await refresh()
        if permissionStatus == .notDetermined {
            do {
                _ = try await center.requestAuthorization(options: [.alert])
            } catch {
                errorMessage = "通知の許可を確認できませんでした。"
                return false
            }
            await refresh()
        }
        guard permissionStatus.allowsScheduling else {
            errorMessage = "設定アプリで通知を許可してください。"
            return false
        }

        do {
            try await schedulePending()
            isEnabled = true
            preferences.saveMorningNotification(
                enabled: true,
                hour: schedule.hour
            )
            return true
        } catch {
            errorMessage = "通知を予約できませんでした。"
            return false
        }
    }

    func updateHour(_ hour: Int) async {
        schedule = MorningWalkNotificationSchedule(hour: hour)
        preferences.saveMorningNotification(
            enabled: isEnabled,
            hour: schedule.hour
        )
        guard isEnabled else { return }
        do {
            try await schedulePending()
            errorMessage = nil
        } catch {
            errorMessage = "通知時刻を更新できませんでした。"
        }
    }

    private func schedulePending() async throws {
        let content = UNMutableNotificationContent()
        content.title = "☀️ きょうのお散歩予報"
        content.body =
            "天気と愛犬に合わせたお散歩の目安をアプリで確認しましょう。"
        content.userInfo = [
            "destination": schedule.destination.rawValue,
            "url": schedule.destination.url.absoluteString,
            "delivery": "local",
        ]
        let trigger = UNCalendarNotificationTrigger(
            dateMatching: schedule.triggerDateComponents,
            repeats: true
        )
        try await center.add(
            UNNotificationRequest(
                identifier: MorningWalkNotificationSchedule.identifier,
                content: content,
                trigger: trigger
            )
        )
    }

    private func cancelPending() {
        center.removePendingNotificationRequests(
            withIdentifiers: [MorningWalkNotificationSchedule.identifier]
        )
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let value = response.notification.request.content.userInfo[
            "destination"
        ] as? String
        guard
            let value,
            let destination = LocalNotificationDestination(rawValue: value)
        else {
            return
        }
        if let destinationHandler {
            destinationHandler(destination)
        } else {
            pendingDestination = destination
        }
    }

    private static func status(
        _ status: UNAuthorizationStatus
    ) -> NotificationPermissionStatus {
        switch status {
        case .notDetermined:
            .notDetermined
        case .denied:
            .denied
        case .authorized:
            .authorized
        case .provisional:
            .provisional
        case .ephemeral:
            .ephemeral
        @unknown default:
            .denied
        }
    }
}
