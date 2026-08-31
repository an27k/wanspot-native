import SwiftUI

// FAB は RootTabView の overlay に常駐しているため、画面側の下部バーやカルーセルの
// 存在を知らない。重なりを避けるのに必要な余白は画面側が申告し、RootTabView が足す
struct ChatFABClearanceKey: PreferenceKey {
    static let defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

extension View {
    func chatFABClearance(_ height: CGFloat) -> some View {
        preference(key: ChatFABClearanceKey.self, value: height)
    }

    /// 下部に置いたビューの高さを実測して申告する。
    /// 計測は background の GeometryReader で行うので、申告値が変わっても
    /// 計測対象のレイアウトは変わらない（FAB の余白だけが動く）
    func measuresChatFABClearance(spacing: CGFloat = 12) -> some View {
        background {
            GeometryReader { proxy in
                Color.clear
                    .chatFABClearance(proxy.size.height + spacing)
            }
        }
    }
}
