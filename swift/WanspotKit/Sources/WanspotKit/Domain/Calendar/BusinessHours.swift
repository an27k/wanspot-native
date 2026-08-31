import Foundation

public enum OpenStatus: String, Codable, Equatable, Sendable {
    case open
    case closed
    case unknown
}

public struct OpeningPeriod: Codable, Equatable, Sendable {
    public struct Point: Codable, Equatable, Sendable {
        public let day: Int?
        public let time: String?

        public init(day: Int? = nil, time: String? = nil) {
            self.day = day
            self.time = time
        }
    }

    public let open: Point?
    public let close: Point?

    public init(open: Point? = nil, close: Point? = nil) {
        self.open = open
        self.close = close
    }
}

public struct OpenState: Codable, Equatable, Sendable {
    public let status: OpenStatus
    public let minutesUntilClose: Int?

    public init(status: OpenStatus, minutesUntilClose: Int?) {
        self.status = status
        self.minutesUntilClose = minutesUntilClose
    }
}

public struct HoursSummary: Codable, Equatable, Sendable {
    public let label: String
    public let tone: OpenStatus

    public init(label: String, tone: OpenStatus) {
        self.label = label
        self.tone = tone
    }
}

public enum BusinessHours {
    private static let japaneseWeekdays = [
        "日曜日",
        "月曜日",
        "火曜日",
        "水曜日",
        "木曜日",
        "金曜日",
        "土曜日",
    ]

    public static func getSpotOpenStatus(
        weekdayText: [String]?,
        openNow: Bool? = nil,
        now: Date = Date()
    ) -> OpenStatus {
        if let openNow {
            return openNow ? .open : .closed
        }
        guard let weekdayText, !weekdayText.isEmpty else {
            return .unknown
        }

        let today = japaneseWeekday(for: now)
        guard let todayLine = weekdayText.first(where: {
            $0.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix(today)
        }) else {
            return .unknown
        }
        return parseHoursLine(todayLine, now: now)
    }

    public static func stripLeadingYen(_ label: String?) -> String? {
        guard let label, !label.isEmpty else { return nil }
        let trimmed = label
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(
                of: "^¥+\\s*",
                with: "",
                options: .regularExpression
            )
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    public static func formatPriceDisplay(
        priceLabel: String?,
        priceLevel: Double?
    ) -> String? {
        if let priceLabel, !priceLabel.isEmpty {
            let label = priceLabel.trimmingCharacters(in: .whitespacesAndNewlines)
            if label == "無料" {
                return "無料"
            }
            if !matchesEntirePattern("^¥+$", in: label) {
                let cleaned = stripLeadingYen(label)?.replacingOccurrences(of: ",", with: "") ?? ""
                if cleaned.range(of: "[0-9]", options: .regularExpression) != nil {
                    return cleaned
                        .replacingOccurrences(
                            of: "[–—\\-~～]+",
                            with: "~",
                            options: .regularExpression
                        )
                        .replacingOccurrences(
                            of: "\\s+",
                            with: "",
                            options: .regularExpression
                        )
                }
            }
        }

        guard let priceLevel, priceLevel.isFinite else {
            return nil
        }
        let rounded = floor(priceLevel + 0.5)
        guard rounded >= Double(Int.min), rounded <= Double(Int.max) else {
            return nil
        }
        return [
            0: "無料",
            1: "1000~2000",
            2: "2000~5000",
            3: "5000~10000",
            4: "10000~",
        ][Int(rounded)]
    }

    public static func todayHoursSummary(
        weekdayText: [String]?,
        openNow: Bool? = nil,
        now: Date = Date()
    ) -> HoursSummary? {
        guard let weekdayText, !weekdayText.isEmpty else {
            guard let openNow else { return nil }
            return HoursSummary(
                label: openNow ? "営業中" : "営業時間外",
                tone: openNow ? .open : .closed
            )
        }

        let today = japaneseWeekday(for: now)
        guard let todayLine = weekdayText.first(where: {
            $0.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix(today)
        }) else {
            return nil
        }

        let body = hoursBody(from: todayLine)
        guard !body.isEmpty else { return nil }

        let status = getSpotOpenStatus(
            weekdayText: weekdayText,
            openNow: openNow,
            now: now
        )
        if isClosedText(body) {
            return HoursSummary(label: "本日は休み", tone: .closed)
        }

        if
            status == .open,
            let remaining = minutesUntilClose(body, now: now),
            remaining <= 120
        {
            let hours = remaining / 60
            let minutes = remaining % 60
            let left: String
            if hours > 0 {
                left = "あと\(hours)時間\(minutes > 0 ? "\(minutes)分" : "")"
            } else {
                left = "あと\(minutes)分"
            }
            return HoursSummary(
                label: "本日 \(body)（\(left)）",
                tone: .open
            )
        }

        return HoursSummary(label: "本日 \(body)", tone: status)
    }

    public static func openStateFromPeriods(
        _ periods: [OpeningPeriod]?,
        now: Date = Date()
    ) -> OpenState {
        guard let periods, !periods.isEmpty else {
            return OpenState(status: .unknown, minutesUntilClose: nil)
        }

        if periods.count == 1, periods[0].close == nil {
            return OpenState(status: .open, minutesUntilClose: nil)
        }

        let current = nowInTokyo(now)
        for period in periods {
            guard
                let openDay = period.open?.day,
                let openMinutes = toMinutes(period.open?.time),
                let closeDay = period.close?.day,
                let closeMinutes = toMinutes(period.close?.time)
            else {
                continue
            }

            let start = openDay * 1_440 + openMinutes
            var end = closeDay * 1_440 + closeMinutes
            if end <= start {
                end += 7 * 1_440
            }
            var currentMinutes = current.day * 1_440 + current.minutes
            if currentMinutes < start {
                currentMinutes += 7 * 1_440
            }

            if currentMinutes >= start, currentMinutes < end {
                return OpenState(
                    status: .open,
                    minutesUntilClose: end - currentMinutes
                )
            }
        }

        return OpenState(status: .closed, minutesUntilClose: nil)
    }

    public static func todayRangeFromPeriods(
        _ periods: [OpeningPeriod]?,
        now: Date = Date()
    ) -> String? {
        guard let periods, !periods.isEmpty else { return nil }
        if periods.count == 1, periods[0].close == nil {
            return "24時間"
        }

        let day = nowInTokyo(now).day
        let ranges = periods.compactMap { period -> String? in
            guard period.open?.day == day else { return nil }
            guard
                let opening = formattedTime(period.open?.time),
                let closing = formattedTime(period.close?.time)
            else {
                return nil
            }
            return "\(opening)-\(closing)"
        }
        return ranges.isEmpty ? nil : ranges.joined(separator: "、")
    }

    private static func parseHoursLine(_ line: String, now: Date) -> OpenStatus {
        let body = hoursBody(from: line)
        guard !body.isEmpty else { return .unknown }
        if isClosedText(body) { return .closed }
        if isAllDayText(body) { return .open }

        let chunks = hoursChunks(body)
        guard
            chunks.count >= 2,
            let opening = parseClockToken(chunks[0]),
            let closing = parseClockToken(chunks[chunks.count - 1])
        else {
            return .unknown
        }

        let current = minutesInTokyo(now)
        if closing <= opening {
            return current >= opening || current < closing ? .open : .closed
        }
        return current >= opening && current < closing ? .open : .closed
    }

    private static func parseClockToken(_ raw: String) -> Int? {
        let token = raw.trimmingCharacters(in: .whitespacesAndNewlines)

        if let captures = captures(for: "^(\\d{1,2})時(?:(\\d{1,2})分)?", in: token) {
            guard let hourText = captures[safe: 1] ?? nil, let hour = Int(hourText) else {
                return nil
            }
            let minute = (captures[safe: 2] ?? nil).flatMap(Int.init) ?? 0
            guard (0 ... 24).contains(hour), (0 ..< 60).contains(minute) else {
                return nil
            }
            return hour * 60 + minute
        }

        if let captures = captures(
            for: "^(\\d{1,2}):(\\d{2})\\s*(AM|PM)?$",
            in: token,
            options: .caseInsensitive
        ) {
            guard
                let hourText = captures[safe: 1] ?? nil,
                let minuteText = captures[safe: 2] ?? nil,
                var hour = Int(hourText),
                let minute = Int(minuteText)
            else {
                return nil
            }
            let meridiem = (captures[safe: 3] ?? nil)?.uppercased()
            if meridiem == "PM", hour < 12 {
                hour += 12
            }
            if meridiem == "AM", hour == 12 {
                hour = 0
            }
            guard (0 ... 24).contains(hour), (0 ..< 60).contains(minute) else {
                return nil
            }
            return hour * 60 + minute
        }

        return nil
    }

    private static func minutesUntilClose(_ body: String, now: Date) -> Int? {
        if isAllDayText(body) { return nil }
        let chunks = hoursChunks(body)
        guard
            chunks.count >= 2,
            let closing = parseClockToken(chunks[chunks.count - 1])
        else {
            return nil
        }
        let difference = closing - minutesInTokyo(now)
        return difference > 0 ? difference : nil
    }

    private static func hoursBody(from line: String) -> String {
        line.replacingOccurrences(
            of: "^[^:]+:\\s*",
            with: "",
            options: .regularExpression
        ).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func hoursChunks(_ body: String) -> [String] {
        body.components(separatedBy: CharacterSet(charactersIn: "–—-~～"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private static func isClosedText(_ body: String) -> Bool {
        body.range(
            of: "定休|休業|休み|closed",
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }

    private static func isAllDayText(_ body: String) -> Bool {
        body.range(
            of: "24\\s*時間|24時間|終日",
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }

    private static func toMinutes(_ time: String?) -> Int? {
        guard let time, matchesEntirePattern("[0-9]{4}", in: time) else {
            return nil
        }
        guard
            let hour = Int(time.prefix(2)),
            let minute = Int(time.suffix(2)),
            hour <= 23,
            minute <= 59
        else {
            return nil
        }
        return hour * 60 + minute
    }

    private static func formattedTime(_ time: String?) -> String? {
        guard let minutes = toMinutes(time) else { return nil }
        return "\(minutes / 60):\(String(format: "%02d", minutes % 60))"
    }

    private static func japaneseWeekday(for date: Date) -> String {
        japaneseWeekdays[nowInTokyo(date).day]
    }

    private static func minutesInTokyo(_ date: Date) -> Int {
        nowInTokyo(date).minutes
    }

    private static func nowInTokyo(_ date: Date) -> (day: Int, minutes: Int) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Tokyo")!
        let components = calendar.dateComponents([.weekday, .hour, .minute], from: date)
        let day = max(0, (components.weekday ?? 1) - 1)
        let minutes = (components.hour ?? 0) * 60 + (components.minute ?? 0)
        return (day, minutes)
    }

    private static func captures(
        for pattern: String,
        in value: String,
        options: NSRegularExpression.Options = []
    ) -> [String?]? {
        guard let expression = try? NSRegularExpression(pattern: pattern, options: options) else {
            return nil
        }
        let range = NSRange(value.startIndex ..< value.endIndex, in: value)
        guard let match = expression.firstMatch(in: value, range: range) else {
            return nil
        }
        return (0 ..< match.numberOfRanges).map { index in
            let captureRange = match.range(at: index)
            guard
                captureRange.location != NSNotFound,
                let range = Range(captureRange, in: value)
            else {
                return nil
            }
            return String(value[range])
        }
    }

    private static func matchesEntirePattern(_ pattern: String, in value: String) -> Bool {
        captures(for: "^(?:\(pattern))$", in: value) != nil
    }
}

private extension Collection {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
