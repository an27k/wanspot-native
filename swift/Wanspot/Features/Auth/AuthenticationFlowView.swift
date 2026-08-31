import AuthenticationServices
import SwiftUI
import WanspotKit

private enum AuthenticationMode: Hashable {
    case signUp
    case signIn
}

struct AuthenticationFlowView: View {
    @Environment(AppModel.self) private var model
    @State private var mode = AuthenticationMode.signUp
    @State private var email = ""
    @State private var password = ""
    @State private var activeTask: String?
    @State private var errorMessage = ""
    @FocusState private var focusedField: Field?

    private enum Field {
        case email
        case password
    }

    private var isBusy: Bool {
        activeTask != nil
    }

    private var canSubmit: Bool {
        !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !password.isEmpty
            && !isBusy
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Spacer(minLength: 42)
                brand
                credentials
                if !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(WanspotColors.error)
                        .multilineTextAlignment(.center)
                }
                submitButton
                oauthSection
                modeButton
                guestButton
                Spacer(minLength: 32)
            }
            .padding(.horizontal, 24)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(WanspotColors.paper)
        .accessibilityIdentifier("authentication.screen")
    }

    private var brand: some View {
        VStack(spacing: 8) {
            Image("WanspotLogo")
                .resizable()
                .scaledToFill()
                .frame(width: 72, height: 72)
                .clipShape(
                    RoundedRectangle(
                        cornerRadius: 72 * 0.22,
                        style: .continuous
                    )
                )
                .accessibilityLabel("wanspot")
            Text("Wanspot")
                .font(.system(size: 28, weight: .heavy))
                .foregroundStyle(WanspotColors.textPrimary)
        }
        .padding(.bottom, 8)
    }

    private var credentials: some View {
        VStack(spacing: 12) {
            TextField("メールアドレス", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.next)
                .focused($focusedField, equals: .email)
                .onSubmit { focusedField = .password }
                .authFieldStyle()

            SecureField("パスワード", text: $password)
                .textContentType(
                    mode == .signUp ? .newPassword : .password
                )
                .submitLabel(.done)
                .focused($focusedField, equals: .password)
                .onSubmit {
                    if canSubmit {
                        submitCredentials()
                    }
                }
                .authFieldStyle()

            if mode == .signUp {
                Text(AuthRules.passwordHint)
                    .font(.caption)
                    .foregroundStyle(WanspotColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private var submitButton: some View {
        Button {
            submitCredentials()
        } label: {
            if activeTask == "credentials" {
                ProgressView()
                    .tint(WanspotColors.onPrimary)
            } else {
                Text(mode == .signUp ? "新規登録" : "ログイン")
            }
        }
        .buttonStyle(WanspotPrimaryButtonStyle())
        .disabled(!canSubmit)
        .opacity(canSubmit ? 1 : 0.45)
    }

    private var oauthSection: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Rectangle()
                    .frame(height: 1)
                Text("または")
                    .font(.caption)
                Rectangle()
                    .frame(height: 1)
            }
            .foregroundStyle(WanspotColors.borderEmphasis)
            .padding(.vertical, 4)

            Button {
                signInWithGoogle()
            } label: {
                HStack {
                    if activeTask == "google" {
                        ProgressView()
                    } else {
                        Image(systemName: "globe")
                        Text(
                            mode == .signUp
                                ? "Googleで登録"
                                : "Googleでログイン"
                        )
                            .fontWeight(.bold)
                    }
                }
                .foregroundStyle(WanspotColors.textPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(WanspotColors.surface)
                .overlay {
                    RoundedRectangle(cornerRadius: WanspotMetrics.buttonRadius)
                        .stroke(WanspotColors.borderEmphasis)
                }
            }
            .disabled(isBusy)

            SignInWithAppleButton(
                mode == .signUp ? .signUp : .signIn
            ) { request in
                request.requestedScopes = [.fullName, .email]
            } onCompletion: { result in
                handleAppleResult(result)
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 50)
            .overlay {
                HStack(spacing: 9) {
                    if activeTask == "apple" {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "apple.logo")
                        Text(
                            mode == .signUp
                                ? "Appleで登録"
                                : "Appleでログイン"
                        )
                            .fontWeight(.semibold)
                    }
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(.black)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            }
            .clipShape(.rect(cornerRadius: WanspotMetrics.buttonRadius))
            .disabled(isBusy)
            .accessibilityLabel(
                mode == .signUp ? "Appleで登録" : "Appleでログイン"
            )
            .accessibilityIdentifier("authentication.apple")
            .id(mode)
        }
    }

    private var modeButton: some View {
        Button {
            mode = mode == .signUp ? .signIn : .signUp
            errorMessage = ""
        } label: {
            Text(
                mode == .signUp
                    ? "すでにアカウントをお持ちの方"
                    : "新規登録はこちら"
            )
            .foregroundStyle(WanspotColors.textSecondary)
        }
        .padding(.top, 4)
    }

    private var guestButton: some View {
        Button("登録しないで使う") {
            model.continueAsGuest()
        }
        .font(.caption)
        .foregroundStyle(WanspotColors.textSecondary)
        .underline()
        .padding(.vertical, 10)
        .accessibilityLabel("登録せずに地図とイベントを見る")
        .accessibilityIdentifier("authentication.continueAsGuest")
    }

    private func submitCredentials() {
        guard canSubmit else { return }
        if
            mode == .signUp,
            let policyError = AuthRules.passwordPolicyError(password)
        {
            errorMessage = policyError
            return
        }
        focusedField = nil
        activeTask = "credentials"
        errorMessage = ""
        Task {
            defer { activeTask = nil }
            do {
                switch mode {
                case .signUp:
                    try await model.signUp(email: email, password: password)
                case .signIn:
                    try await model.signIn(email: email, password: password)
                }
            } catch {
                errorMessage = AuthRules.japaneseError(
                    error.localizedDescription
                )
            }
        }
    }

    private func signInWithGoogle() {
        guard !isBusy else { return }
        activeTask = "google"
        errorMessage = ""
        Task {
            defer { activeTask = nil }
            do {
                try await model.signInWithGoogle()
            } catch {
                if
                    let webError = error as? ASWebAuthenticationSessionError,
                    webError.code == .canceledLogin
                {
                    return
                }
                errorMessage = AuthRules.japaneseError(
                    error.localizedDescription
                )
            }
        }
    }

    private func handleAppleResult(
        _ result: Result<ASAuthorization, Error>
    ) {
        guard !isBusy else { return }
        switch result {
        case let .failure(error):
            if
                let authorizationError = error as? ASAuthorizationError,
                authorizationError.code == .canceled
            {
                return
            }
            errorMessage = AuthRules.japaneseError(
                error.localizedDescription
            )
        case let .success(authorization):
            guard
                let credential =
                    authorization.credential
                        as? ASAuthorizationAppleIDCredential,
                let identityToken = credential.identityToken
            else {
                errorMessage = "Apple認証情報が取得できませんでした"
                return
            }
            let displayName = [
                credential.fullName?.familyName,
                credential.fullName?.givenName,
            ]
            .compactMap { value in
                let value = value?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                return value?.isEmpty == false ? value : nil
            }
            .joined(separator: " ")

            activeTask = "apple"
            errorMessage = ""
            Task {
                defer { activeTask = nil }
                do {
                    try await model.signInWithApple(
                        identityToken: identityToken,
                        displayName: displayName
                    )
                } catch {
                    errorMessage = AuthRules.japaneseError(
                        error.localizedDescription
                    )
                }
            }
        }
    }
}

private extension View {
    func authFieldStyle() -> some View {
        padding(.horizontal, 14)
            .frame(height: 50)
            .background(WanspotColors.input)
            .overlay {
                RoundedRectangle(cornerRadius: 12)
                    .stroke(WanspotColors.border)
            }
            .clipShape(.rect(cornerRadius: 12))
            .foregroundStyle(WanspotColors.textPrimary)
    }
}
