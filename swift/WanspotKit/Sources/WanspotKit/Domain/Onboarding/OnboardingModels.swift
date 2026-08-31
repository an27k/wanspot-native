import Foundation

public struct OnboardingDogDraft: Codable, Equatable, Sendable {
    public var name: String
    public var breed: String
    public var size: DogSize?
    public var birthday: String?
    public var photoURL: URL?
    public var mixedVaccine: Bool?
    public var rabiesVaccine: Bool?
    public var mixedVaccineDate: String?
    public var rabiesVaccineDate: String?

    public init(
        name: String = "",
        breed: String = "",
        size: DogSize? = nil,
        birthday: String? = nil,
        photoURL: URL? = nil,
        mixedVaccine: Bool? = nil,
        rabiesVaccine: Bool? = nil,
        mixedVaccineDate: String? = nil,
        rabiesVaccineDate: String? = nil
    ) {
        self.name = name
        self.breed = breed
        self.size = size
        self.birthday = birthday
        self.photoURL = photoURL
        self.mixedVaccine = mixedVaccine
        self.rabiesVaccine = rabiesVaccine
        self.mixedVaccineDate = mixedVaccineDate
        self.rabiesVaccineDate = rabiesVaccineDate
    }

    public var isReadyForNextStep: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !breed.isEmpty
            && size != nil
    }
}

public struct DogSizeOption: Equatable, Sendable, Identifiable {
    public let size: DogSize
    public let description: String

    public var id: DogSize { size }

    public init(size: DogSize, description: String) {
        self.size = size
        self.description = description
    }
}

public extension DogSize {
    static let onboardingOptions: [DogSizeOption] = [
        DogSizeOption(size: .extraSmall, description: "〜4kg · 〜25cm"),
        DogSizeOption(size: .small, description: "4〜10kg · 25〜40cm"),
        DogSizeOption(size: .medium, description: "10〜25kg · 40〜60cm"),
        DogSizeOption(size: .large, description: "25〜45kg · 60〜75cm"),
        DogSizeOption(size: .extraLarge, description: "45kg〜 · 75cm〜"),
    ]
}

public struct WalkTimeChoice: Equatable, Sendable, Identifiable {
    public let label: String
    public let hour: Int?

    public var id: String { label }

    public init(label: String, hour: Int?) {
        self.label = label
        self.hour = hour
    }
}

public enum OnboardingDomain {
    public static let walkTimeChoices: [WalkTimeChoice] = [
        WalkTimeChoice(label: "早朝（5〜6時）", hour: 6),
        WalkTimeChoice(label: "朝（7〜9時）", hour: 8),
        WalkTimeChoice(label: "夕方（16〜18時）", hour: 17),
        WalkTimeChoice(label: "夜（19〜21時）", hour: 20),
        WalkTimeChoice(label: "きめていない", hour: nil),
    ]

    public static func defaultBio(dogName: String?, breed: String?) -> String {
        let dogName = dogName?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let breed = breed?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if dogName.isEmpty {
            return "愛犬と一緒に新しいスポットを探しています！"
        }
        if !breed.isEmpty {
            return "\(dogName)（\(breed)）と一緒に新しいスポットを探しています！"
        }
        return "\(dogName)と一緒に新しいスポットを探しています！"
    }

    public static func dogLabel(_ name: String?) -> String {
        let name = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return name.isEmpty ? "うちの子" : "\(name)ちゃん"
    }

    public static func dateKey(
        _ date: Date,
        calendar: Calendar = .autoupdatingCurrent
    ) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(
            format: "%04d-%02d-%02d",
            parts.year ?? 0,
            parts.month ?? 0,
            parts.day ?? 0
        )
    }
}
