import Foundation

public protocol PetPolicySource: Sendable {
    var petIndoorAllowed: Bool? { get }
    var petTerraceOnly: Bool? { get }
    var petFriendlyStatus: String? { get }
    var petFriendlyVerified: Bool? { get }
    var petPolicyEvidence: String? { get }
    var petSizeLimit: String? { get }
    var petReservationRequired: Bool? { get }
    var dogInteraction: String? { get }
}

extension PlaceResult: PetPolicySource {}
extension SpotDetail: PetPolicySource {}

public enum PetPolicyEvidenceTone: String, Codable, Equatable, Sendable {
    case confirmed
    case reported
    case weak
}

public enum PetPolicyBadgeTone: String, Codable, Equatable, Sendable {
    case ok
    case terrace
    case caution
}

public struct PetPolicyBadge: Codable, Equatable, Sendable {
    public let label: String
    public let tone: PetPolicyBadgeTone

    public init(label: String, tone: PetPolicyBadgeTone) {
        self.label = label
        self.tone = tone
    }
}

public enum PetAccessConditionKind: String, Codable, Equatable, Sendable {
    case size
    case reservation
    case interaction
}

public struct PetAccessCondition: Codable, Equatable, Sendable {
    public let kind: PetAccessConditionKind
    public let label: String
    public let isCaution: Bool

    public init(
        kind: PetAccessConditionKind,
        label: String,
        isCaution: Bool = false
    ) {
        self.kind = kind
        self.label = label
        self.isCaution = isCaution
    }
}

public struct PetPolicyPresentation: Equatable, Sendable {
    public let badge: PetPolicyBadge?
    public let conditions: [PetAccessCondition]
    public let advisory: String?

    public init(
        badge: PetPolicyBadge?,
        conditions: [PetAccessCondition],
        advisory: String?
    ) {
        self.badge = badge
        self.conditions = conditions
        self.advisory = advisory
    }
}

public enum PetPolicy {
    public static let indoorFilterLabel = "店内OK"
    public static let terraceFilterLabel = "テラスOK"

    public static func evidenceTone<Source: PetPolicySource>(
        for spot: Source
    ) -> PetPolicyEvidenceTone {
        switch spot.petPolicyEvidence {
        case "official", "aggregator":
            .confirmed
        case "reviews":
            .reported
        default:
            .weak
        }
    }

    public static func isIndoorAllowed<Source: PetPolicySource>(
        _ spot: Source
    ) -> Bool {
        spot.petIndoorAllowed == true
    }

    public static func isTerraceAllowed<Source: PetPolicySource>(
        _ spot: Source
    ) -> Bool {
        guard spot.petFriendlyStatus != "not_allowed" else { return false }
        return spot.petTerraceOnly == true
            || spot.petFriendlyStatus == "outdoor_only"
    }

    public static func badge<Source: PetPolicySource>(
        for spot: Source
    ) -> PetPolicyBadge? {
        if spot.petFriendlyStatus == "not_allowed" {
            return PetPolicyBadge(
                label: "同伴不可の可能性",
                tone: .caution
            )
        }
        if spot.petIndoorAllowed == true {
            return PetPolicyBadge(
                label: labelWithEvidence("店内OK", spot: spot),
                tone: .ok
            )
        }
        if isTerraceAllowed(spot) {
            return PetPolicyBadge(
                label: labelWithEvidence("テラス席のみOK", spot: spot),
                tone: .terrace
            )
        }
        if spot.petFriendlyStatus == "leashed_only" {
            return PetPolicyBadge(
                label: labelWithEvidence("リード着用で同伴OK", spot: spot),
                tone: .ok
            )
        }
        if spot.petFriendlyStatus == "allowed" {
            return PetPolicyBadge(
                label: labelWithEvidence(
                    "同伴OK・店内は要確認",
                    spot: spot
                ),
                tone: .ok
            )
        }
        if spot.petFriendlyVerified == true {
            return PetPolicyBadge(
                label: "同伴可否は要確認",
                tone: .caution
            )
        }
        return nil
    }

    public static func presentation<Source: PetPolicySource>(
        for spot: Source
    ) -> PetPolicyPresentation {
        var conditions: [PetAccessCondition] = []
        if
            let limit = spot.petSizeLimit?
                .trimmingCharacters(in: .whitespacesAndNewlines),
            !limit.isEmpty
        {
            conditions.append(
                PetAccessCondition(
                    kind: .size,
                    label: "サイズ条件: \(limit)",
                    isCaution: true
                )
            )
        }
        if spot.petReservationRequired == true {
            conditions.append(
                PetAccessCondition(
                    kind: .reservation,
                    label: "愛犬同伴での利用は予約が必要です",
                    isCaution: true
                )
            )
        }
        if spot.dogInteraction == "meet_dogs" {
            conditions.append(
                PetAccessCondition(
                    kind: .interaction,
                    label: "お店のワンちゃんと触れ合う施設です。愛犬の同伴可否は事前にご確認ください",
                    isCaution: true
                )
            )
        }

        let badge = badge(for: spot)
        let advisory: String?
        if badge == nil {
            advisory = "同伴条件はまだ確認できていません。お出かけ前に施設へご確認ください。"
        } else if spot.petFriendlyStatus == "not_allowed" {
            advisory = "施設の最新ルールが変わっている場合があります。来訪前にご確認ください。"
        } else {
            advisory = nil
        }
        return PetPolicyPresentation(
            badge: badge,
            conditions: conditions,
            advisory: advisory
        )
    }

    private static func labelWithEvidence<Source: PetPolicySource>(
        _ base: String,
        spot: Source
    ) -> String {
        switch evidenceTone(for: spot) {
        case .confirmed:
            "\(base)・確認済み"
        case .reported:
            "\(base)（口コミによる）"
        case .weak:
            base
        }
    }
}
