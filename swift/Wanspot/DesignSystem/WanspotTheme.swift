import SwiftUI
import UIKit

enum WanspotColors {
    static let primary = adaptive(light: 0xFF6757, dark: 0xFF7A68)
    static let coral = primary
    static let onPrimary = adaptive(light: 0xFFFFFF, dark: 0x241512)
    static let paper = adaptive(light: 0xF8F6F1, dark: 0x151311)
    static let surface = adaptive(light: 0xFFFFFF, dark: 0x201D1A)
    static let input = adaptive(light: 0xFFFFFF, dark: 0x28231F)
    static let border = adaptive(light: 0xE7E2DA, dark: 0x39332E)
    static let borderEmphasis = adaptive(light: 0xD8D2CA, dark: 0x514840)
    static let textPrimary = adaptive(light: 0x242220, dark: 0xF7F2EC)
    static let textSecondary = adaptive(light: 0x77736D, dark: 0xBDB5AC)
    static let tintWeak = adaptive(light: 0xFFF1EE, dark: 0x3A2420)
    static let error = adaptive(light: 0xE84335, dark: 0xFF766A)

    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(
            uiColor: UIColor { traits in
                UIColor(
                    rgb: traits.userInterfaceStyle == .dark ? dark : light
                )
            }
        )
    }
}

enum WanspotMetrics {
    static let pagePadding: CGFloat = 20
    static let fieldRadius: CGFloat = 14
    static let buttonRadius: CGFloat = 16
}

enum WanspotSpacing {
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
}

private extension UIColor {
    convenience init(rgb: UInt32) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: 1
        )
    }
}

struct WanspotPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(WanspotColors.onPrimary)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(WanspotColors.primary)
            .clipShape(
                .rect(cornerRadius: WanspotMetrics.buttonRadius)
            )
            .opacity(configuration.isPressed ? 0.82 : 1)
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
    }
}
