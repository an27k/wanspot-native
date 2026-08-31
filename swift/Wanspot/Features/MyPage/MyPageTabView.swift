import SwiftUI
import WanspotKit

struct MyPageTabView: View {
    @Environment(AppModel.self) private var model
    @Environment(AppRouter.self) private var router
    @Environment(\.openURL) private var openURL
    @State private var isLoadingProfile = false
    @State private var profileError: String?
    @State private var showsSignOutConfirmation = false

    var body: some View {
        List {
            WanspotBrandHeader()
                .listRowInsets(
                    EdgeInsets(
                        top: 8,
                        leading: WanspotMetrics.pagePadding,
                        bottom: 8,
                        trailing: WanspotMetrics.pagePadding
                    )
                )
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)

            headerSection

            Section("表示") {
                ThemePreferencePicker()
                    .padding(.vertical, 6)
            }

            if model.isAuthenticated {
                walkForecastSection
                historySection
            }

            Section("設定") {
                Button {
                    router.navigate(to: .appSettings)
                } label: {
                    SettingsNavigationLabel(
                        title: "アプリ設定",
                        subtitle: "通知・テーマ・アプリ情報",
                        systemImage: "gearshape.fill"
                    )
                }
                .buttonStyle(.plain)
            }

            supportSection

            if model.isAuthenticated {
                accountSection
            }
        }
        .contentMargins(.top, 0, for: .scrollContent)
        .scrollContentBackground(.hidden)
        .background(WanspotColors.paper)
        .accessibilityIdentifier("mypage.screen")
        .toolbar(.hidden, for: .navigationBar)
        .task(id: model.currentUserID) {
            model.track(AppAnalyticsEvent(.myPageViewed))
            await loadProfile()
        }
        .refreshable {
            await loadProfile()
        }
        .alert(
            "ログアウトしますか？",
            isPresented: $showsSignOutConfirmation
        ) {
            Button("キャンセル", role: .cancel) {}
            Button("ログアウト", role: .destructive) {
                model.track(AppAnalyticsEvent(.signedOut))
                Task {
                    await model.signOut()
                    router.reset()
                }
            }
        }
    }

    @ViewBuilder
    private var headerSection: some View {
        Section {
            if model.isAuthenticated {
                Button {
                    router.navigate(to: .dogSettings)
                } label: {
                    MyPageDogProfileCard(
                        dog: model.primaryDog,
                        isLoading: isLoadingProfile
                    )
                }
                .buttonStyle(.plain)

                if let profileError {
                    Label(
                        profileError,
                        systemImage: "exclamationmark.triangle"
                    )
                    .font(.caption)
                    .foregroundStyle(WanspotColors.error)
                }
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    Label(
                        "ログインすると愛犬情報や履歴を保存できます",
                        systemImage: "pawprint.fill"
                    )
                    .font(.headline)
                    .foregroundStyle(WanspotColors.textPrimary)

                    Button {
                        model.track(
                            AppAnalyticsEvent(
                                .loginPrompted,
                                storageType: .loginPrompt,
                                properties: [
                                    "source": .string("mypage"),
                                ]
                            )
                        )
                        model.requestAuthentication()
                    } label: {
                        Text("ログイン / 新規登録")
                    }
                    .buttonStyle(WanspotPrimaryButtonStyle())
                    .accessibilityIdentifier("mypage.authenticate")
                }
                .padding(.vertical, 8)
            }
        }
    }

    private var walkForecastSection: some View {
        Section("今日のお散歩") {
            Button {
                router.navigate(to: .walkForecast)
            } label: {
                SettingsNavigationLabel(
                    title: "お散歩予報を確認",
                    subtitle: "現在地の天気と愛犬に合わせた目安",
                    systemImage: "sun.max.fill"
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("mypage.walkForecast")
        }
    }

    private var historySection: some View {
        Section("履歴") {
            Button {
                router.navigate(to: .likes)
            } label: {
                SettingsNavigationLabel(
                    title: "いいねしたスポット",
                    systemImage: "heart.fill"
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("mypage.likes")

            Button {
                router.navigate(to: .visitedHistory)
            } label: {
                SettingsNavigationLabel(
                    title: "行ったスポット",
                    systemImage: "pawprint.fill"
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("mypage.visited")
        }
    }

    private var supportSection: some View {
        Section("サポート") {
            externalButton(.support)
            externalButton(.privacy)
            externalButton(.terms)
        }
    }

    private var accountSection: some View {
        Section("アカウント") {
            Button {
                showsSignOutConfirmation = true
            } label: {
                Label("ログアウト", systemImage: "rectangle.portrait.and.arrow.right")
                    .foregroundStyle(WanspotColors.textPrimary)
            }

            Button {
                router.navigate(to: .accountDelete)
            } label: {
                Label(
                    "アカウントを削除",
                    systemImage: "person.crop.circle.badge.minus"
                )
                .foregroundStyle(WanspotColors.error)
            }
        }
    }

    private func externalButton(
        _ destination: MyPageExternalDestination
    ) -> some View {
        Button {
            guard let url = destination.url(baseURL: model.wanspotSiteURL) else {
                return
            }
            model.track(
                AppAnalyticsEvent(
                    destination == .support
                        ? .supportLinkOpened
                        : .legalLinkOpened,
                    properties: [
                        "destination": .string(destination.rawValue),
                    ]
                )
            )
            openURL(url)
        } label: {
            HStack {
                Label(destination.title, systemImage: destination.systemImage)
                    .foregroundStyle(WanspotColors.textPrimary)
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(WanspotColors.textSecondary)
            }
        }
    }

    private func loadProfile() async {
        guard model.isAuthenticated else {
            profileError = nil
            return
        }
        isLoadingProfile = true
        defer { isLoadingProfile = false }
        do {
            _ = try await model.refreshPrimaryDog()
            profileError = nil
        } catch {
            profileError = "愛犬情報を読み込めませんでした。"
        }
    }
}

struct DogAvatarView: View {
    let photoURL: URL?
    var size: CGFloat = 64

    var body: some View {
        ZStack {
            Circle()
                .fill(WanspotColors.tintWeak)
            if let photoURL {
                AsyncImage(url: photoURL) { phase in
                    switch phase {
                    case let .success(image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .empty:
                        ProgressView()
                    case .failure:
                        placeholder
                    @unknown default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(.circle)
        .overlay {
            Circle().stroke(WanspotColors.border)
        }
    }

    private var placeholder: some View {
        Image(systemName: "pawprint.fill")
            .font(.system(size: size * 0.34, weight: .semibold))
            .foregroundStyle(WanspotColors.primary)
    }
}

private struct MyPageDogProfileCard: View {
    let dog: DogProfile?
    let isLoading: Bool

    var body: some View {
        HStack(spacing: 14) {
            DogAvatarView(photoURL: dog?.photoURL)
            VStack(alignment: .leading, spacing: 4) {
                Text(dog?.name ?? (isLoading ? "読み込み中…" : "愛犬プロフィール"))
                    .font(.headline)
                    .foregroundStyle(WanspotColors.textPrimary)
                Text(metadata)
                    .font(.subheadline)
                    .foregroundStyle(WanspotColors.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(WanspotColors.textSecondary)
        }
        .padding(.vertical, 6)
        .contentShape(.rect)
    }

    private var metadata: String {
        guard let dog else {
            return isLoading ? "愛犬情報を確認しています" : "タップして設定"
        }
        let parts = [
            dog.breed,
            dog.size.map(\.displayName),
        ].compactMap { $0 }
        return parts.isEmpty ? "タップして編集" : parts.joined(separator: "・")
    }
}

enum MyPageExternalDestination: String, Equatable {
    case support
    case privacy
    case terms

    var title: String {
        switch self {
        case .support:
            "お問い合わせ"
        case .privacy:
            "プライバシーポリシー"
        case .terms:
            "利用規約"
        }
    }

    var systemImage: String {
        switch self {
        case .support:
            "envelope"
        case .privacy:
            "hand.raised"
        case .terms:
            "doc.text"
        }
    }

    func url(baseURL: URL?) -> URL? {
        let baseURL = baseURL ?? URL(string: "https://www.wanspot.app")
        return baseURL?.appending(path: rawValue == "support" ? "contact" : rawValue)
    }
}

extension DogSize {
    var displayName: String {
        switch self {
        case .extraSmall:
            "超小型犬"
        case .small:
            "小型犬"
        case .medium:
            "中型犬"
        case .large:
            "大型犬"
        case .extraLarge:
            "超大型犬"
        }
    }
}
