import SwiftUI

// 全画面常駐のチャット入口。FAB上のポップ吹き出しは出さない設計
// （文脈差はシート内のサジェスト質問チップで表現する）
struct ChatFAB: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image("ChatMascot")
                .resizable()
                .scaledToFill()
                .frame(width: 58, height: 58)
                .clipShape(Circle())
                .shadow(
                    color: WanspotColors.primary.opacity(0.35),
                    radius: 11,
                    y: 8
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("ワンスポAIに質問する")
        .accessibilityIdentifier("chat.fab")
    }
}
