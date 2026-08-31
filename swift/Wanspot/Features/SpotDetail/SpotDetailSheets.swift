import SwiftUI

struct SpotInformationTipSheet: View {
    let spotName: String
    let isSubmitting: Bool
    let onSubmit: (String) async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var bodyText = ""
    @State private var wasSubmitted = false

    private var characterCount: Int {
        bodyText.utf16.count
    }

    private var canSubmit: Bool {
        !bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && characterCount <= 1_000
            && !isSubmitting
    }

    var body: some View {
        NavigationStack {
            Group {
                if wasSubmitted {
                    thankYou
                } else {
                    form
                }
            }
            .navigationTitle("犬連れ情報を教える")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") {
                        dismiss()
                    }
                    .disabled(isSubmitting)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(isSubmitting)
        .onChange(of: bodyText) { _, value in
            let limited = limitedToUTF16Length(value, maximum: 1_000)
            if limited != value {
                bodyText = limited
            }
        }
    }

    private var form: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(spotName)
                        .font(.headline)
                        .foregroundStyle(WanspotColors.textPrimary)
                    Text("行ったことがあれば、わかる範囲で教えてください。")
                        .font(.subheadline)
                        .foregroundStyle(WanspotColors.textSecondary)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Label("たとえば", systemImage: "lightbulb.fill")
                        .font(.caption.bold())
                        .foregroundStyle(.orange)
                    Text("店内OKだった・テラスのみ・大型犬もいた・足洗い場があった")
                        .font(.footnote)
                        .foregroundStyle(WanspotColors.textSecondary)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    WanspotColors.tintWeak,
                    in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                )

                TextEditor(text: $bodyText)
                    .font(.body)
                    .frame(minHeight: 150)
                    .scrollContentBackground(.hidden)
                    .padding(10)
                    .background(
                        WanspotColors.input,
                        in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(
                                characterCount > 1_000
                                    ? WanspotColors.error
                                    : WanspotColors.border
                            )
                    }
                    .overlay(alignment: .topLeading) {
                        if bodyText.isEmpty {
                            Text("例: 店内は小型犬のみOKでした。入口に水飲み場あり")
                                .font(.body)
                                .foregroundStyle(WanspotColors.textSecondary.opacity(0.72))
                                .padding(.horizontal, 15)
                                .padding(.vertical, 19)
                                .allowsHitTesting(false)
                        }
                    }
                    .disabled(isSubmitting)

                Text("\(characterCount) / 1000")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(
                        characterCount > 1_000
                            ? WanspotColors.error
                            : WanspotColors.textSecondary
                    )
                    .frame(maxWidth: .infinity, alignment: .trailing)

                Button {
                    Task {
                        if await onSubmit(bodyText) {
                            wasSubmitted = true
                            try? await Task.sleep(for: .milliseconds(1_400))
                            dismiss()
                        }
                    }
                } label: {
                    HStack {
                        if isSubmitting {
                            ProgressView()
                                .tint(WanspotColors.onPrimary)
                        }
                        Text(isSubmitting ? "送信中…" : "送る")
                    }
                }
                .buttonStyle(WanspotPrimaryButtonStyle())
                .disabled(!canSubmit)
                .opacity(canSubmit ? 1 : 0.55)
            }
            .padding(WanspotMetrics.pagePadding)
        }
        .background(WanspotColors.paper)
    }

    private var thankYou: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 52))
                .foregroundStyle(.green)
            Text("ありがとうございます！")
                .font(.title2.bold())
                .foregroundStyle(WanspotColors.textPrimary)
            Text("いただいた情報は、犬連れ情報の充実に使わせていただきます。")
                .font(.subheadline)
                .foregroundStyle(WanspotColors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WanspotColors.paper)
    }

    private func limitedToUTF16Length(
        _ value: String,
        maximum: Int
    ) -> String {
        var result = ""
        var count = 0
        for character in value {
            let text = String(character)
            let nextCount = count + text.utf16.count
            guard nextCount <= maximum else { break }
            result.append(character)
            count = nextCount
        }
        return result
    }
}
