public enum DogLookupOutcome: Equatable, Sendable {
    case notRequested
    case exists
    case missing
    case failed
}

public enum AppGateDestination: Equatable, Sendable {
    case authentication
    case onboarding
    case main
}

public enum AppGateRules {
    public static func destination(
        hasSession: Bool,
        hasChosenGuest: Bool,
        isOnboardingComplete: Bool,
        dogLookup: DogLookupOutcome
    ) -> AppGateDestination {
        guard hasSession else {
            return hasChosenGuest ? .main : .authentication
        }
        if isOnboardingComplete {
            return .main
        }
        switch dogLookup {
        case .missing:
            return .onboarding
        case .notRequested, .exists, .failed:
            // 判定失敗を未登録扱いすると既存プロフィールを再作成し得る。
            return .main
        }
    }
}
