import SwiftUI
import WanspotKit

struct AppSettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(AppRouter.self) private var router

    var body: some View {
        List {
            Section("表示") {
                ThemePreferencePicker()
                    .padding(.vertical, 6)
            }

            Section {
                Button {
                    router.navigate(to: .notificationSettings)
                } label: {
                    SettingsNavigationLabel(
                        title: "朝のお散歩予報",
                        subtitle: "端末内のローカル通知",
                        systemImage: "sunrise.fill"
                    )
                }
                .buttonStyle(.plain)
            } header: {
                Text("通知")
            } footer: {
                Text("サーバーからのプッシュ配信は使用していません。")
            }

            Section("アプリ情報") {
                LabeledContent(
                    "バージョン",
                    value: appVersion
                )
            }
        }
        .scrollContentBackground(.hidden)
        .background(WanspotColors.paper)
        .navigationTitle("アプリ設定")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            model.track(AppAnalyticsEvent(.appSettingsViewed))
        }
    }

    private var appVersion: String {
        let version = Bundle.main.object(
            forInfoDictionaryKey: "CFBundleShortVersionString"
        ) as? String ?? "—"
        let build = Bundle.main.object(
            forInfoDictionaryKey: "CFBundleVersion"
        ) as? String
        return build.map { "\(version) (\($0))" } ?? version
    }
}

struct ThemePreferencePicker: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Picker(
            "テーマ",
            selection: Binding(
                get: { model.themePreference },
                set: { preference in
                    model.setThemePreference(preference)
                    model.track(
                        AppAnalyticsEvent(
                            .themeChanged,
                            properties: [
                                "theme": .string(preference.rawValue),
                            ]
                        )
                    )
                }
            )
        ) {
            ForEach(AppThemePreference.allCases, id: \.self) { preference in
                Text(preference.displayName).tag(preference)
            }
        }
        .pickerStyle(.segmented)
    }
}

struct SettingsNavigationLabel: View {
    let title: String
    var subtitle: String?
    let systemImage: String
    var tint = WanspotColors.primary

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 28, height: 28)
                .background(tint.opacity(0.12), in: .rect(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .foregroundStyle(WanspotColors.textPrimary)
                if let subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(WanspotColors.textSecondary)
                }
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(WanspotColors.textSecondary)
        }
        .contentShape(.rect)
    }
}

private extension AppThemePreference {
    var displayName: String {
        switch self {
        case .system:
            "端末"
        case .light:
            "ライト"
        case .dark:
            "ダーク"
        }
    }
}
