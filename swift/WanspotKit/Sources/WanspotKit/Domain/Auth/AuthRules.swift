import Foundation

public enum AuthRules {
    public static let passwordMinimumLength = 12
    public static let passwordHint =
        "12文字以上。英大文字・英小文字・数字・記号をそれぞれ1文字以上"
    public static let passwordPolicyMessage =
        "パスワードは12文字以上で、英大文字・英小文字・数字・記号をそれぞれ1文字以上含めてください。"

    public static func passwordPolicyError(_ password: String) -> String? {
        let isTooShort = password.utf16.count < passwordMinimumLength
        let hasLowercase = password.range(of: "[a-z]", options: .regularExpression) != nil
        let hasUppercase = password.range(of: "[A-Z]", options: .regularExpression) != nil
        let hasDigit = password.range(of: "[0-9]", options: .regularExpression) != nil
        let hasSymbol = password.range(
            of: #"[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~]"#,
            options: .regularExpression
        ) != nil
        let isMissingKind =
            !hasLowercase || !hasUppercase || !hasDigit || !hasSymbol

        if !isTooShort, !isMissingKind {
            return nil
        }
        if isTooShort, !isMissingKind {
            return "パスワードは12文字以上にしてください。"
        }
        return passwordPolicyMessage
    }

    public static func japaneseError(_ raw: String) -> String {
        if matches(
            raw,
            #"timeout|522|503|504|502|fetch failed|failed to fetch|ECONNRESET|ETIMEDOUT|network|connection|Connection terminated|auth_timeout"#
        ) {
            return "認証サービスに接続できません。しばらく待ってから再度お試しください。"
        }
        if matches(
            raw,
            #"Password should be at least|Password should contain at least one character of each|weak_password|Password is known to be weak"#
        ) {
            return passwordPolicyMessage
        }
        if matches(raw, "Invalid login credentials") {
            return "メールアドレスまたはパスワードが正しくありません。"
        }
        if matches(
            raw,
            "User already registered|already been registered|already exists"
        ) {
            return "このメールアドレスはすでに登録されています。ログインしてください。"
        }
        if matches(raw, "Email not confirmed") {
            return "メールアドレスの確認が完了していません。"
        }
        if matches(
            raw,
            "Unable to validate email address|invalid format|invalid email"
        ) {
            return "メールアドレスの形式が正しくありません。"
        }
        if matches(raw, "Signup requires a valid password|Password should") {
            return passwordPolicyMessage
        }
        if matches(
            raw,
            "For security purposes, you can only request this after"
        ) {
            return "短時間に何度も試されたため、しばらく待ってから再度お試しください。"
        }
        if matches(raw, "rate limit") {
            return "アクセスが集中しています。しばらく待ってから再度お試しください。"
        }
        if raw.range(
            of: "[ぁ-んァ-ン一-龯]",
            options: .regularExpression
        ) != nil {
            return raw
        }
        return "うまくいきませんでした。入力内容をご確認のうえ、もう一度お試しください。"
    }
}

private func matches(_ value: String, _ pattern: String) -> Bool {
    value.range(
        of: pattern,
        options: [.regularExpression, .caseInsensitive]
    ) != nil
}
