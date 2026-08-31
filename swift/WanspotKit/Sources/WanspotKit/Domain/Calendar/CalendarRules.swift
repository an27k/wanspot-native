import Foundation

public enum CalendarDateTone: String, Codable, Equatable, Sendable {
    case past
    case saturday
    case sundayOrHoliday = "sunday_or_holiday"
    case weekday
}

public enum CalendarRules {
    public static let tokyoTimeZone =
        TimeZone(identifier: "Asia/Tokyo") ?? TimeZone(secondsFromGMT: 9 * 3600)!
    public static let weekdaySymbols = ["日", "月", "火", "水", "木", "金", "土"]

    public static func month(containing date: Date) -> CalendarMonth {
        let parts = tokyoCalendar.dateComponents([.year, .month], from: date)
        return CalendarMonth(
            year: parts.year ?? 1970,
            month: parts.month ?? 1
        )
    }

    public static func dateKey(_ date: Date) -> String {
        let parts = tokyoCalendar.dateComponents(
            [.year, .month, .day],
            from: date
        )
        return dateKey(
            year: parts.year ?? 0,
            month: parts.month ?? 0,
            day: parts.day ?? 0
        )
    }

    public static func dateKey(
        year: Int,
        month: Int,
        day: Int
    ) -> String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }

    public static func dateComponents(
        for dateKey: String
    ) -> DateComponents? {
        let pieces = dateKey.split(separator: "-", omittingEmptySubsequences: false)
        guard
            pieces.count == 3,
            let year = Int(pieces[0]),
            let month = Int(pieces[1]),
            let day = Int(pieces[2]),
            (1 ... 12).contains(month),
            (1 ... 31).contains(day)
        else {
            return nil
        }
        var components = DateComponents()
        components.calendar = tokyoCalendar
        components.timeZone = tokyoTimeZone
        components.year = year
        components.month = month
        components.day = day
        guard
            let date = tokyoCalendar.date(from: components),
            tokyoCalendar.component(.year, from: date) == year,
            tokyoCalendar.component(.month, from: date) == month,
            tokyoCalendar.component(.day, from: date) == day
        else {
            return nil
        }
        return components
    }

    public static func weekdayIndex(for dateKey: String) -> Int? {
        guard
            let components = dateComponents(for: dateKey),
            let date = tokyoCalendar.date(from: components)
        else {
            return nil
        }
        return tokyoCalendar.component(.weekday, from: date) - 1
    }

    public static func dateTone(
        dateKey: String,
        todayKey: String,
        holidayName: String?
    ) -> CalendarDateTone {
        if dateKey < todayKey {
            return .past
        }
        switch weekdayIndex(for: dateKey) {
        case 0:
            return .sundayOrHoliday
        case 6 where nonEmpty(holidayName) == nil:
            return .saturday
        default:
            return nonEmpty(holidayName) == nil ? .weekday : .sundayOrHoliday
        }
    }

    public static func normalizedHolidayName(
        name: String,
        englishName: String? = nil
    ) -> String {
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let englishName = englishName?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if name == "休日" || englishName == "Citizen's Holiday" {
            return "国民の休日"
        }
        if name == "振替休日" {
            return "振替休日"
        }
        return name
    }

    public static func monthGrid(_ month: CalendarMonth) -> [[Int?]] {
        var first = DateComponents()
        first.calendar = tokyoCalendar
        first.timeZone = tokyoTimeZone
        first.year = month.year
        first.month = month.month
        first.day = 1
        guard
            let firstDate = tokyoCalendar.date(from: first),
            let dayRange = tokyoCalendar.range(of: .day, in: .month, for: firstDate)
        else {
            return []
        }
        let leading = tokyoCalendar.component(.weekday, from: firstDate) - 1
        var cells = Array<Int?>(repeating: nil, count: leading)
        cells.append(contentsOf: dayRange.map(Optional.some))
        while !cells.count.isMultiple(of: 7) {
            cells.append(nil)
        }
        return stride(from: 0, to: cells.count, by: 7).map {
            Array(cells[$0 ..< min($0 + 7, cells.count)])
        }
    }

    public static func eventsByDay(
        _ events: [CalendarEvent]
    ) -> [String: [CalendarEvent]] {
        var result: [String: [CalendarEvent]] = [:]
        for event in events {
            var seenDays = Set<String>()
            for occurrence in event.occurrences {
                let key = dateKey(occurrence.startsAt)
                guard seenDays.insert(key).inserted else { continue }
                result[key, default: []].append(event)
            }
        }
        return result
    }

    public static func occurrence(
        in event: CalendarEvent,
        on dateKey: String
    ) -> CalendarEventOccurrence? {
        event.occurrences.first { occurrence in
            self.dateKey(occurrence.startsAt) == dateKey
        }
    }

    public static func timeLabel(_ date: Date) -> String {
        let parts = tokyoCalendar.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", parts.hour ?? 0, parts.minute ?? 0)
    }

    public static func dateLabel(_ date: Date) -> String {
        let parts = tokyoCalendar.dateComponents(
            [.month, .day, .weekday],
            from: date
        )
        let weekday = max(1, min(7, parts.weekday ?? 1))
        return "\(parts.month ?? 0)/\(parts.day ?? 0)(\(weekdaySymbols[weekday - 1]))"
    }

    public static func occurrenceLabel(
        _ occurrence: CalendarEventOccurrence
    ) -> String {
        let date = dateLabel(occurrence.startsAt)
        if occurrence.isAllDay {
            return "\(date)（時刻の記載なし）"
        }
        let end = occurrence.endsAt.map { "〜\(timeLabel($0))" } ?? ""
        return "\(date) \(timeLabel(occurrence.startsAt))\(end)"
    }

    /// 「開催日時」に並べる行。サーバが `schedule_lines` を返していれば
    /// そのまま使い（連続した日付・同じ時刻の回がまとまっている）、
    /// 無い／空なら従来どおり `occurrences` を1件ずつ組み立てる。
    public static func scheduleLines(
        for event: CalendarEvent
    ) -> [String] {
        if !event.scheduleLines.isEmpty {
            return event.scheduleLines
        }
        return event.occurrences.map(occurrenceLabel)
    }

    public static func displayPrefecture(
        for event: CalendarEvent
    ) -> String? {
        nonEmpty(event.prefecture?.name)
            ?? prefectureName(in: event.address)
            ?? prefectureName(in: event.venueName)
    }

    public static func prefectureName(in value: String?) -> String? {
        guard let value = nonEmpty(value) else { return nil }
        var match: (name: String, offset: String.Index)?
        for name in prefectureNames {
            guard let range = value.range(of: name) else { continue }
            if match == nil || range.lowerBound < match!.offset {
                match = (name, range.lowerBound)
            }
        }
        return match?.name
    }

    public static func directLinks(
        _ values: [String?],
        listingURL: String?
    ) -> [URL] {
        let listingHost = host(listingURL)
        var seen = Set<String>()
        return values.compactMap { value in
            guard
                let value = nonEmpty(value),
                let url = URL(string: value),
                let scheme = url.scheme?.lowercased(),
                scheme == "http" || scheme == "https",
                host(value) != listingHost || listingHost == nil,
                seen.insert(value).inserted
            else {
                return nil
            }
            return url
        }
    }

    public static func distanceLabel(meters: Double) -> String {
        if meters < 1_000 {
            return "\(Int(meters.rounded()))m"
        }
        return String(
            format: "%.1fkm",
            locale: Locale(identifier: "en_US_POSIX"),
            meters / 1_000
        )
    }

    public static func nearbyKindLabel(_ kind: CalendarNearbyKind) -> String {
        switch kind {
        case .food:
            "ごはん"
        case .play:
            "遊ぶ"
        case .stay:
            "泊まる"
        case .unknown:
            "スポット"
        }
    }

    private static var tokyoCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "ja_JP")
        calendar.timeZone = tokyoTimeZone
        return calendar
    }

    private static func host(_ value: String?) -> String? {
        guard let value = nonEmpty(value), let host = URL(string: value)?.host else {
            return nil
        }
        let lowered = host.lowercased()
        return lowered.hasPrefix("www.") ? String(lowered.dropFirst(4)) : lowered
    }

    private static func nonEmpty(_ value: String?) -> String? {
        let value = value?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return value.isEmpty ? nil : value
    }

    private static let prefectureNames = [
        "北海道",
        "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
        "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
        "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
        "岐阜県", "静岡県", "愛知県", "三重県",
        "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
        "鳥取県", "島根県", "岡山県", "広島県", "山口県",
        "徳島県", "香川県", "愛媛県", "高知県",
        "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
    ]
}
