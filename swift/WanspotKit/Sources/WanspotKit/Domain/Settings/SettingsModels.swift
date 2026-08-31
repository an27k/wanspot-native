import Foundation

public enum AppThemePreference:
    String,
    CaseIterable,
    Codable,
    Equatable,
    Hashable,
    Sendable
{
    case system
    case light
    case dark
}

public struct FeatureConfiguration: Equatable, Sendable {
    public let adsEnabled: Bool

    public init(adsEnabled: Bool) {
        self.adsEnabled = adsEnabled
    }

    public static func resolve(
        appConfiguration: AppConfiguration,
        adsProviderAvailable: Bool
    ) -> Self {
        Self(
            adsEnabled: appConfiguration.adsEnabled && adsProviderAvailable
        )
    }

    public static let adsDisabled = Self(adsEnabled: false)
}

public enum LocalNotificationDestination:
    String,
    Codable,
    Equatable,
    Sendable
{
    case walkForecast = "walk_forecast"

    public var url: URL {
        switch self {
        case .walkForecast:
            URL(string: "wanspot://mypage/walk-forecast")!
        }
    }
}

public struct MorningWalkNotificationSchedule: Equatable, Sendable {
    public static let defaultHour = 5
    public static let identifier = "wanspot.walk-forecast.morning"

    public let hour: Int
    public let minute: Int
    public let destination: LocalNotificationDestination

    public init(
        hour: Int = Self.defaultHour,
        minute: Int = 0,
        destination: LocalNotificationDestination = .walkForecast
    ) {
        self.hour = min(max(hour, 0), 23)
        self.minute = min(max(minute, 0), 59)
        self.destination = destination
    }

    public var triggerDateComponents: DateComponents {
        DateComponents(hour: hour, minute: minute)
    }

    public func nextFireDate(
        after date: Date,
        calendar: Calendar = .autoupdatingCurrent
    ) -> Date? {
        calendar.nextDate(
            after: date,
            matching: triggerDateComponents,
            matchingPolicy: .nextTime,
            repeatedTimePolicy: .first,
            direction: .forward
        )
    }
}

public enum DogProfileFormValidationError:
    Error,
    Equatable,
    LocalizedError,
    Sendable
{
    case nameRequired
    case invalidBirthday
    case futureBirthday

    public var errorDescription: String? {
        switch self {
        case .nameRequired:
            "名前を入力してください。"
        case .invalidBirthday:
            "誕生日を正しい日付で入力してください。"
        case .futureBirthday:
            "誕生日に未来の日付は指定できません。"
        }
    }
}

public struct DogProfileFormSubmission: Equatable, Sendable {
    public let name: String
    public let breed: String?
    public let birthday: String?
    public let gender: DogGender?
    public let size: DogSize?
}

public struct DogProfileForm: Equatable, Sendable {
    public var name: String
    public var breed: String
    public var birthday: String?
    public var gender: DogGender?
    public var size: DogSize?

    public init(
        name: String,
        breed: String,
        birthday: String?,
        gender: DogGender?,
        size: DogSize?
    ) {
        self.name = name
        self.breed = breed
        self.birthday = birthday
        self.gender = gender
        self.size = size
    }

    public init(profile: DogProfile) {
        self.init(
            name: profile.name,
            breed: profile.breed ?? "",
            birthday: profile.birthday,
            gender: profile.gender,
            size: profile.size
        )
    }

    public func validated(
        now: Date = Date(),
        calendar: Calendar = .autoupdatingCurrent
    ) throws -> DogProfileFormSubmission {
        let normalizedName = name.trimmingCharacters(
            in: .whitespacesAndNewlines
        )
        guard !normalizedName.isEmpty else {
            throw DogProfileFormValidationError.nameRequired
        }

        let normalizedBreed = breed.trimmingCharacters(
            in: .whitespacesAndNewlines
        )
        let normalizedBirthday = birthday?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let normalizedBirthday, !normalizedBirthday.isEmpty {
            guard profileDate(normalizedBirthday) != nil else {
                throw DogProfileFormValidationError.invalidBirthday
            }
            if normalizedBirthday > profileDateKey(now, calendar: calendar) {
                throw DogProfileFormValidationError.futureBirthday
            }
        }

        return DogProfileFormSubmission(
            name: normalizedName,
            breed: normalizedBreed.isEmpty ? nil : normalizedBreed,
            birthday: normalizedBirthday.flatMap { $0.isEmpty ? nil : $0 },
            gender: gender,
            size: size
        )
    }
}

private func profileDate(_ value: String) -> Date? {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.isLenient = false
    guard let date = formatter.date(from: value) else { return nil }
    return formatter.string(from: date) == value ? date : nil
}

private func profileDateKey(_ date: Date, calendar: Calendar) -> String {
    let formatter = DateFormatter()
    formatter.calendar = calendar
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = calendar.timeZone
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
}
