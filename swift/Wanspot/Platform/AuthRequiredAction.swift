import SwiftUI

@MainActor
struct AuthRequiredAction {
    let isAuthenticated: Bool
    let onAuthenticationRequired: () -> Void

    @discardableResult
    func perform(_ action: () -> Void) -> Bool {
        guard isAuthenticated else {
            onAuthenticationRequired()
            return false
        }

        action()
        return true
    }

    @discardableResult
    func performAsync(_ action: () async -> Void) async -> Bool {
        guard isAuthenticated else {
            onAuthenticationRequired()
            return false
        }

        await action()
        return true
    }
}

struct AuthRequiredInlineCard: View {
    var title = "ログインが必要です"
    var message = "この機能はログイン後に利用できます。"
    var buttonTitle = "ログイン・新規登録"
    let onAuthenticate: () -> Void

    var body: some View {
        WanspotGlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Label(title, systemImage: "person.crop.circle.badge.exclamationmark")
                    .font(.headline)
                    .foregroundStyle(WanspotColors.textPrimary)

                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(WanspotColors.textSecondary)

                Button(buttonTitle, action: onAuthenticate)
                    .buttonStyle(.borderedProminent)
                    .tint(WanspotColors.primary)
            }
        }
    }
}
