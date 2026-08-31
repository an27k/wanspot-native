import XCTest

@testable import WanspotKit

final class AuthRulesTests: XCTestCase {
    func testPasswordPolicyMatchesReactNativeRules() {
        XCTAssertNil(AuthRules.passwordPolicyError("ValidPass1!x"))
        XCTAssertEqual(
            AuthRules.passwordPolicyError("Aa1!"),
            "パスワードは12文字以上にしてください。"
        )
        XCTAssertEqual(
            AuthRules.passwordPolicyError("abcdefghijkl"),
            AuthRules.passwordPolicyMessage
        )
    }

    func testAuthErrorsAreSafeJapaneseMessages() {
        XCTAssertEqual(
            AuthRules.japaneseError("Invalid login credentials"),
            "メールアドレスまたはパスワードが正しくありません。"
        )
        XCTAssertEqual(
            AuthRules.japaneseError("request timeout"),
            "認証サービスに接続できません。しばらく待ってから再度お試しください。"
        )
        XCTAssertEqual(
            AuthRules.japaneseError("独自の日本語エラー"),
            "独自の日本語エラー"
        )
        XCTAssertEqual(
            AuthRules.japaneseError("unexpected backend detail"),
            "うまくいきませんでした。入力内容をご確認のうえ、もう一度お試しください。"
        )
    }

    func testAppGateMatchesGuestAndDogLookupSafetyRules() {
        XCTAssertEqual(
            AppGateRules.destination(
                hasSession: false,
                hasChosenGuest: false,
                isOnboardingComplete: false,
                dogLookup: .notRequested
            ),
            .authentication
        )
        XCTAssertEqual(
            AppGateRules.destination(
                hasSession: false,
                hasChosenGuest: true,
                isOnboardingComplete: false,
                dogLookup: .notRequested
            ),
            .main
        )
        XCTAssertEqual(
            AppGateRules.destination(
                hasSession: true,
                hasChosenGuest: false,
                isOnboardingComplete: false,
                dogLookup: .missing
            ),
            .onboarding
        )
        XCTAssertEqual(
            AppGateRules.destination(
                hasSession: true,
                hasChosenGuest: false,
                isOnboardingComplete: false,
                dogLookup: .failed
            ),
            .main
        )
    }
}
