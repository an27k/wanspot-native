import SwiftUI
import UIKit

struct WanspotBrandHeader: View {
    var body: some View {
        HStack(spacing: 10) {
            Image("WanspotLogo")
                .resizable()
                .scaledToFill()
                .frame(width: 34, height: 34)
                .clipShape(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                )

            Text("Wanspot")
                .font(.title3.weight(.heavy))
                .foregroundStyle(WanspotColors.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Wanspot")
        .accessibilityIdentifier("wanspot.brandHeader")
    }
}

enum WanspotAuthenticationPrompt: String, Identifiable {
    case like
    case visit
    case likedFilter

    var id: String { rawValue }

    var title: String {
        switch self {
        case .like:
            "いいねを保存するには"
        case .visit:
            "「行った」を記録するには"
        case .likedFilter:
            "いいねしたスポットを見るには"
        }
    }

    var message: String {
        switch self {
        case .like:
            "ログインすると、気になるスポットを「いいね」に保存して、あとから見返せます。"
        case .visit:
            "ログインすると、訪れたスポットを「行った」に記録して、評価やメモを残せます。"
        case .likedFilter:
            "ログインすると、「いいね」したスポットだけに絞り込めます。"
        }
    }

    var systemImage: String {
        switch self {
        case .like, .likedFilter:
            "heart.fill"
        case .visit:
            "pawprint.fill"
        }
    }
}

private struct WanspotAuthenticationPromptModifier: ViewModifier {
    @Binding var prompt: WanspotAuthenticationPrompt?
    let onAuthenticate: () -> Void

    func body(content: Content) -> some View {
        content.sheet(item: $prompt) { presentedPrompt in
            WanspotAuthenticationPromptSheet(
                prompt: presentedPrompt,
                onAuthenticate: {
                    prompt = nil
                    onAuthenticate()
                },
                onCancel: {
                    prompt = nil
                }
            )
            .presentationDetents([.height(340)])
            .presentationDragIndicator(.visible)
            .presentationBackground(WanspotColors.paper)
        }
    }
}

private struct WanspotAuthenticationPromptSheet: View {
    let prompt: WanspotAuthenticationPrompt
    let onAuthenticate: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: prompt.systemImage)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(WanspotColors.primary)
                .frame(width: 64, height: 64)
                .background(WanspotColors.tintWeak, in: Circle())

            VStack(spacing: 8) {
                Text(prompt.title)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(WanspotColors.textPrimary)
                    .multilineTextAlignment(.center)

                Text(prompt.message)
                    .font(.subheadline)
                    .foregroundStyle(WanspotColors.textSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button("ログイン・新規登録", action: onAuthenticate)
                .buttonStyle(WanspotPrimaryButtonStyle())

            Button("今はしない", action: onCancel)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(WanspotColors.textSecondary)
                .frame(minHeight: 32)
        }
        .padding(.horizontal, 24)
        .padding(.top, 10)
        .padding(.bottom, 18)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("authentication.prompt")
    }
}

extension View {
    func wanspotAuthenticationPrompt(
        _ prompt: Binding<WanspotAuthenticationPrompt?>,
        onAuthenticate: @escaping () -> Void
    ) -> some View {
        modifier(
            WanspotAuthenticationPromptModifier(
                prompt: prompt,
                onAuthenticate: onAuthenticate
            )
        )
    }
}

struct WanspotAppHeader<Trailing: View>: View {
    private let title: String
    private let subtitle: String?
    private let trailing: Trailing

    init(
        title: String,
        subtitle: String? = nil,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.title = title
        self.subtitle = subtitle
        self.trailing = trailing()
    }

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.largeTitle.bold())
                    .foregroundStyle(WanspotColors.textPrimary)

                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(WanspotColors.textSecondary)
                }
            }

            Spacer(minLength: 0)
            trailing
        }
        .accessibilityElement(children: .contain)
    }
}

extension WanspotAppHeader where Trailing == EmptyView {
    init(title: String, subtitle: String? = nil) {
        self.init(title: title, subtitle: subtitle) {
            EmptyView()
        }
    }
}

struct WanspotGlassCard<Content: View>: View {
    private let contentPadding: CGFloat
    private let content: Content

    init(
        contentPadding: CGFloat = 16,
        @ViewBuilder content: () -> Content
    ) {
        self.contentPadding = contentPadding
        self.content = content()
    }

    var body: some View {
        content
            .padding(contentPadding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                .regularMaterial,
                in: RoundedRectangle(
                    cornerRadius: WanspotMetrics.fieldRadius,
                    style: .continuous
                )
            )
            .overlay {
                RoundedRectangle(
                    cornerRadius: WanspotMetrics.fieldRadius,
                    style: .continuous
                )
                .stroke(WanspotColors.border.opacity(0.8), lineWidth: 0.5)
            }
    }
}

struct WanspotLoadingState: View {
    var title = "読み込み中…"

    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
                .controlSize(.large)
                .tint(WanspotColors.primary)

            Text(title)
                .font(.subheadline)
                .foregroundStyle(WanspotColors.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(WanspotMetrics.pagePadding)
        .accessibilityElement(children: .combine)
    }
}

struct WanspotEmptyState: View {
    let title: String
    var message: String?
    var systemImage = "tray"
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        WanspotMessageState(
            title: title,
            message: message,
            systemImage: systemImage,
            symbolColor: WanspotColors.textSecondary,
            actionTitle: actionTitle,
            action: action
        )
    }
}

struct WanspotErrorState: View {
    let title: String
    var message: String?
    var actionTitle: String?
    var retry: (() -> Void)?

    var body: some View {
        WanspotMessageState(
            title: title,
            message: message,
            systemImage: "exclamationmark.triangle.fill",
            symbolColor: WanspotColors.error,
            actionTitle: actionTitle,
            action: retry
        )
    }
}

struct WanspotRemoteImage: View {
    let url: URL?
    var contentMode: ContentMode = .fill
    var cornerRadius: CGFloat = WanspotMetrics.fieldRadius
    var accessibilityLabel = "画像"

    @State private var loadedImage: UIImage?
    @State private var didFail = false

    var body: some View {
        GeometryReader { geometry in
            Group {
                if let loadedImage {
                    Image(uiImage: loadedImage)
                        .resizable()
                        .aspectRatio(contentMode: contentMode)
                        .transition(.opacity)
                } else if didFail || url == nil {
                    unavailablePlaceholder
                } else {
                    loadingPlaceholder
                }
            }
            .frame(
                width: geometry.size.width,
                height: geometry.size.height
            )
            .clipped()
        }
        .clipShape(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        )
        .contentShape(
            .interaction,
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        )
        .accessibilityLabel(accessibilityLabel)
        .task(id: url) {
            await loadImage()
        }
    }

    @MainActor
    private func loadImage() async {
        loadedImage = nil
        didFail = false
        guard let url else {
            didFail = true
            return
        }

        let image = await WanspotRemoteImageRepository.shared.image(for: url)
        guard !Task.isCancelled else { return }
        loadedImage = image
        didFail = image == nil
    }

    private var loadingPlaceholder: some View {
        ZStack {
            WanspotColors.surface
            ProgressView()
                .tint(WanspotColors.primary)
        }
    }

    private var unavailablePlaceholder: some View {
        ZStack {
            WanspotColors.surface
            Image(systemName: "photo")
                .font(.title2)
                .foregroundStyle(WanspotColors.textSecondary)
        }
    }
}

@MainActor
private final class WanspotRemoteImageRepository {
    static let shared = WanspotRemoteImageRepository()

    private let cache = NSCache<NSURL, UIImage>()

    func image(for url: URL) async -> UIImage? {
        if let cached = cache.object(forKey: url as NSURL) {
            return cached
        }

        for candidate in candidates(for: url) {
            for attempt in 0 ..< 2 {
                guard !Task.isCancelled else { return nil }
                if let image = await fetch(
                    candidate,
                    ignoringCache: attempt > 0
                ) {
                    cache.setObject(image, forKey: url as NSURL)
                    cache.setObject(image, forKey: candidate as NSURL)
                    return image
                }
                if attempt == 0 {
                    try? await Task.sleep(for: .milliseconds(250))
                }
            }
        }
        return nil
    }

    private func fetch(
        _ url: URL,
        ignoringCache: Bool
    ) async -> UIImage? {
        var request = URLRequest(
            url: url,
            cachePolicy: ignoringCache
                ? .reloadIgnoringLocalCacheData
                : .returnCacheDataElseLoad,
            timeoutInterval: 15
        )
        request.setValue("image/*", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard
                let http = response as? HTTPURLResponse,
                (200 ..< 300).contains(http.statusCode),
                http.mimeType?.hasPrefix("image/") == true,
                let image = UIImage(data: data)
            else {
                return nil
            }
            return image
        } catch {
            return nil
        }
    }

    private func candidates(for url: URL) -> [URL] {
        guard
            var components = URLComponents(
                url: url,
                resolvingAgainstBaseURL: false
            ),
            components.path.contains("/storage/v1/render/image/public/")
        else {
            return [url]
        }

        components.path = components.path.replacingOccurrences(
            of: "/storage/v1/render/image/public/",
            with: "/storage/v1/object/public/"
        )
        components.query = nil
        guard let original = components.url, original != url else {
            return [url]
        }
        return [url, original]
    }
}

private struct WanspotMessageState: View {
    let title: String
    let message: String?
    let systemImage: String
    let symbolColor: Color
    let actionTitle: String?
    let action: (() -> Void)?

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(symbolColor)

            Text(title)
                .font(.headline)
                .foregroundStyle(WanspotColors.textPrimary)
                .multilineTextAlignment(.center)

            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(WanspotColors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.borderedProminent)
                    .tint(WanspotColors.primary)
                    .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(WanspotMetrics.pagePadding)
        .accessibilityElement(children: .contain)
    }
}
