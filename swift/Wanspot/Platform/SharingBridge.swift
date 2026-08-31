import SwiftUI
import UIKit

enum WanspotShareItem: Hashable, Sendable {
    case text(String)
    case url(URL)

    fileprivate var activityValue: Any {
        switch self {
        case let .text(text):
            text
        case let .url(url):
            url
        }
    }
}

@MainActor
struct WanspotShareSheet: UIViewControllerRepresentable {
    let items: [WanspotShareItem]

    func makeUIViewController(
        context: Context
    ) -> UIActivityViewController {
        let controller = UIActivityViewController(
            activityItems: items.map(\.activityValue),
            applicationActivities: nil
        )
        controller.popoverPresentationController?.sourceView = controller.view
        return controller
    }

    func updateUIViewController(
        _ uiViewController: UIActivityViewController,
        context: Context
    ) {}
}
