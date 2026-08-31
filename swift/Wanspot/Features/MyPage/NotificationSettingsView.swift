import SwiftUI
import UIKit

struct NotificationSettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(MorningWalkNotificationService.self)
    private var notifications
    @State private var selectedTime = Date()

    var body: some View {
        List {
            scheduleSection
            permissionSection
            errorSection
        }
        .scrollContentBackground(.hidden)
        .background(WanspotColors.paper)
        .navigationTitle("通知設定")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await load()
        }
    }

    private var scheduleSection: some View {
        Section {
            Toggle(
                "毎朝通知する",
                isOn: Binding(
                    get: { notifications.isEnabled },
                    set: { enabled in
                        updateEnabled(enabled)
                    }
                )
            )
                .disabled(notifications.isBusy)

            DatePicker(
                "通知時刻",
                selection: $selectedTime,
                displayedComponents: .hourAndMinute
            )
            .disabled(!notifications.isEnabled)

            if notifications.isEnabled {
                Button("通知時刻を保存", action: saveTime)
            }
        } header: {
            Text("朝のお散歩予報")
        } footer: {
            Text(
                "指定時刻に、このiPhoneがローカル通知を表示します。"
                    + "通知を開くとお散歩予報の画面へ移動します。"
                    + "リモートプッシュ通知ではありません。"
            )
        }
    }

    private var permissionSection: some View {
        Section("通知の許可") {
            LabeledContent(
                "状態",
                value: notifications.permissionStatus.displayName
            )

            if notifications.permissionStatus == .denied {
                Button("設定アプリを開く", action: openSystemSettings)
            }
        }
    }

    @ViewBuilder
    private var errorSection: some View {
        if let errorMessage = notifications.errorMessage {
            Section {
                Label(errorMessage, systemImage: "exclamationmark.triangle")
                    .foregroundStyle(WanspotColors.error)
            }
        }
    }

    @MainActor
    private func load() async {
        model.track(AppAnalyticsEvent(.notificationSettingsViewed))
        await notifications.refresh()
        selectedTime = notificationTime(hour: notifications.schedule.hour)
    }

    private func saveTime() {
        let hour = Calendar.autoupdatingCurrent.component(
            .hour,
            from: selectedTime
        )
        Task {
            await notifications.updateHour(hour)
        }
    }

    private func updateEnabled(_ enabled: Bool) {
        Task {
            if enabled {
                model.track(
                    AppAnalyticsEvent(.notificationPermissionRequested)
                )
            }

            let didUpdate = await notifications.setEnabled(enabled)
            guard didUpdate else { return }

            let eventName: AppAnalyticsEventName
            if enabled {
                eventName = .notificationScheduleEnabled
            } else {
                eventName = .notificationScheduleDisabled
            }
            model.track(
                AppAnalyticsEvent(
                    eventName,
                    properties: [
                        "hour": .integer(notifications.schedule.hour),
                        "delivery": .string("local"),
                    ]
                )
            )
        }
    }

    private func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            return
        }
        UIApplication.shared.open(url)
    }

    private func notificationTime(hour: Int) -> Date {
        Calendar.autoupdatingCurrent.date(
            bySettingHour: hour,
            minute: 0,
            second: 0,
            of: Date()
        ) ?? Date()
    }
}

private extension NotificationPermissionStatus {
    var displayName: String {
        switch self {
        case .notDetermined:
            "未確認"
        case .denied:
            "許可されていません"
        case .authorized:
            "許可済み"
        case .provisional:
            "仮許可"
        case .ephemeral:
            "一時許可"
        }
    }
}
