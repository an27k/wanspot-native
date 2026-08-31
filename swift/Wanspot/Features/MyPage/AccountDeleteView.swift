import SwiftUI
import WanspotKit

struct AccountDeleteView: View {
    private static let confirmationText = "DELETE"

    @Environment(AppModel.self) private var model
    @Environment(AppRouter.self) private var router
    @State private var input = ""
    @State private var isDeleting = false
    @State private var showsFinalConfirmation = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section {
                Label(
                    "この操作は取り消せません",
                    systemImage: "exclamationmark.triangle.fill"
                )
                .font(.headline)
                .foregroundStyle(WanspotColors.error)

                Text(
                    "プロフィール、愛犬情報、写真、いいね、訪問履歴、"
                        + "イベント参加履歴、行動ログなど、"
                        + "アカウントに紐づくデータが削除されます。"
                )
                .font(.subheadline)
                .foregroundStyle(WanspotColors.textSecondary)
            }

            Section {
                TextField(Self.confirmationText, text: $input)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .disabled(isDeleting)
            } header: {
                Text(
                    "確認のため「\(Self.confirmationText)」"
                        + "と入力してください"
                )
            }

            if let errorMessage {
                Section {
                    Label(
                        errorMessage,
                        systemImage: "exclamationmark.triangle"
                    )
                    .foregroundStyle(WanspotColors.error)
                }
            }

            Section {
                Button(
                    isDeleting ? "削除中…" : "アカウントを削除",
                    role: .destructive
                ) {
                    showsFinalConfirmation = true
                }
                .disabled(
                    input != Self.confirmationText || isDeleting
                )
            }
        }
        .scrollContentBackground(.hidden)
        .background(WanspotColors.paper)
        .navigationTitle("アカウントを削除")
        .navigationBarTitleDisplayMode(.inline)
        .alert(
            "本当にアカウントを削除しますか？",
            isPresented: $showsFinalConfirmation
        ) {
            Button("キャンセル", role: .cancel) {}
            Button("完全に削除", role: .destructive) {
                Task { await deleteAccount() }
            }
        } message: {
            Text("削除後にデータを復元することはできません。")
        }
    }

    private func deleteAccount() async {
        guard !isDeleting, input == Self.confirmationText else { return }
        isDeleting = true
        errorMessage = nil
        model.track(AppAnalyticsEvent(.accountDeletionRequested))
        do {
            _ = try await model.deleteAccount()
            router.reset()
        } catch {
            errorMessage = error.localizedDescription.isEmpty
                ? "アカウントを削除できませんでした。"
                : error.localizedDescription
            isDeleting = false
        }
    }
}
