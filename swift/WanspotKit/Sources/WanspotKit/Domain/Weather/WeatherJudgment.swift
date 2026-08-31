import Foundation

public enum WeatherCondition: String, Codable, Equatable, Sendable {
    case clear
    case partly
    case cloudy
    case rain
    case snow
    case thunder
    case fog
    case wind

    public var isRainy: Bool {
        self == .rain || self == .snow || self == .thunder
    }
}

public struct CurrentWeather: Codable, Equatable, Sendable {
    public let temperatureCelsius: Double
    public let condition: WeatherCondition

    public init(
        temperatureCelsius: Double,
        condition: WeatherCondition
    ) {
        self.temperatureCelsius = temperatureCelsius
        self.condition = condition
    }
}

public struct WalkAlert: Codable, Equatable, Sendable {
    public let level: WalkAlertLevel
    public let label: String
    public let rangeLabel: String
    public let advice: String

    public init(
        level: WalkAlertLevel,
        label: String,
        rangeLabel: String,
        advice: String
    ) {
        self.level = level
        self.label = label
        self.rangeLabel = rangeLabel
        self.advice = advice
    }
}

public enum WeatherJudgment {
    public static func condition(fromWMOCode code: Int) -> WeatherCondition {
        if code == 0 { return .clear }
        if code <= 3 { return .partly }
        if code <= 48 { return code <= 45 ? .cloudy : .fog }
        if code <= 67 { return .rain }
        if code <= 77 { return .snow }
        if code <= 82 { return .rain }
        if code <= 86 { return .snow }
        return .thunder
    }

    public static func condition(
        fromGoogleType type: String?
    ) -> WeatherCondition {
        let value = type?.uppercased() ?? ""
        if value.contains("THUNDER") { return .thunder }
        if [
            "SNOW",
            "FLURR",
            "SLEET",
            "ICE",
            "HAIL",
            "BLIZZARD",
            "WINTRY",
        ].contains(where: value.contains) {
            return .snow
        }
        if ["RAIN", "SHOWER", "DRIZZLE"].contains(where: value.contains) {
            return .rain
        }
        if ["FOG", "MIST", "HAZE"].contains(where: value.contains) {
            return .fog
        }
        if value.contains("WIND") { return .wind }
        if value.contains("PARTLY") || value == "MOSTLY_CLEAR" {
            return .partly
        }
        if value.contains("CLOUD") { return .cloudy }
        return .clear
    }

    public static func ageHeatSensitivity(_ ageMonths: Int?) -> Int {
        guard let ageMonths, ageMonths >= 0 else { return 0 }
        if ageMonths < 6 || ageMonths >= 120 {
            return 2
        }
        return ageMonths >= 84 ? 1 : 0
    }

    public static func breedHeatSensitivity(_ breed: String?) -> Int {
        let breed = breed?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if stronglyHeatSensitiveBreeds.contains(breed) {
            return 2
        }
        if mildlyHeatSensitiveBreeds.contains(breed) {
            return 1
        }
        return 0
    }

    public static func dogAgeMonths(
        birthday: String?,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> Int? {
        guard
            let birthday,
            let date = birthdayFormatter.date(from: birthday)
        else {
            return nil
        }
        var calendar = calendar
        calendar.locale = Locale(identifier: "en_US_POSIX")
        let birth = calendar.dateComponents([.year, .month, .day], from: date)
        let current = calendar.dateComponents([.year, .month, .day], from: now)
        guard
            let birthYear = birth.year,
            let birthMonth = birth.month,
            let birthDay = birth.day,
            let currentYear = current.year,
            let currentMonth = current.month,
            let currentDay = current.day
        else {
            return nil
        }
        var months =
            (currentYear - birthYear) * 12
            + currentMonth
            - birthMonth
        if currentDay < birthDay {
            months -= 1
        }
        return (0 ... 360).contains(months) ? months : nil
    }

    public static func walkAlert(
        temperatureCelsius: Double,
        humidityPercent: Double? = nil,
        feelsLikeCelsius: Double? = nil,
        heatSensitivity: Int? = nil,
        ageMonths: Int? = nil
    ) -> WalkAlert {
        let baseSensitivity = max(0, heatSensitivity ?? 0)
        let sensitivity = min(
            2,
            baseSensitivity + ageHeatSensitivity(ageMonths)
        )
        let shift = Double(sensitivity * 2)
        let mildShift = (shift / 2).rounded()

        if
            temperatureCelsius >= 35 - shift
            || (feelsLikeCelsius.map { $0 >= 38 - shift } ?? false)
        {
            return alert(for: .stop)
        }

        var level: WalkAlertLevel
        if temperatureCelsius <= 0 {
            level = .numb
        } else if temperatureCelsius <= 7 {
            level = .sting
        } else if temperatureCelsius <= 15 {
            level = .chilly
        } else if temperatureCelsius <= 24 - mildShift {
            level = .comfortable
        } else if temperatureCelsius <= 31 - shift {
            level = .caution
        } else {
            level = .danger
        }

        if
            let humidityPercent,
            humidityPercent >= 65,
            temperatureCelsius >= 25 - mildShift
        {
            if level == .caution {
                level = .danger
            } else if level == .danger {
                level = .stop
            }
        }
        return alert(for: level)
    }

    private static func alert(for level: WalkAlertLevel) -> WalkAlert {
        switch level {
        case .numb:
            WalkAlert(
                level: level,
                label: "じんじん",
                rangeLabel: "0℃以下",
                advice: "足先が凍えるほどの寒さ。お散歩は短時間にして、肉球の保護や防寒を。"
            )
        case .sting:
            WalkAlert(
                level: level,
                label: "ひりひり",
                rangeLabel: "1〜7℃",
                advice: "かなり冷え込みます。ワンちゃんの様子を見ながら短めのお散歩を。"
            )
        case .chilly:
            WalkAlert(
                level: level,
                label: "ひんやり",
                rangeLabel: "8〜15℃",
                advice: "ひんやり快適。シニアや子犬には防寒があると安心です。"
            )
        case .comfortable:
            WalkAlert(
                level: level,
                label: "快適",
                rangeLabel: "16〜24℃",
                advice: "お散歩しやすい気温です。日なたではこまめに休憩と水分補給を。"
            )
        case .caution:
            WalkAlert(
                level: level,
                label: "暑さ注意",
                rangeLabel: "25〜31℃",
                advice: "熱中症に注意。日なたとアスファルトの熱を避け、短めのお散歩に。"
            )
        case .danger:
            WalkAlert(
                level: level,
                label: "危険",
                rangeLabel: "32〜34℃",
                advice: "熱中症の危険大。日中は避け、早朝・夜の涼しい時間だけにしましょう。"
            )
        case .stop:
            WalkAlert(
                level: level,
                label: "中止",
                rangeLabel: "35℃以上 / 体感38℃以上",
                advice: "お散歩は中止を。室内で涼しく過ごしましょう。"
            )
        }
    }

    private static let stronglyHeatSensitiveBreeds = Set([
        "フレンチブルドッグ",
        "ブルドッグ",
        "パグ",
        "ボストンテリア",
        "ペキニーズ",
        "シーズー",
        "ボクサー",
        "狆",
    ])

    private static let mildlyHeatSensitiveBreeds = Set([
        "キャバリアキングチャールズスパニエル",
        "チワワ",
        "ヨークシャーテリア",
        "シベリアンハスキー",
        "アラスカンマラミュート",
        "サモエド",
        "バーニーズマウンテンドッグ",
        "グレートピレニーズ",
        "ニューファンドランド",
        "セントバーナード",
        "ゴールデンレトリバー",
        "秋田犬",
        "北海道犬",
    ])

    private static let birthdayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
