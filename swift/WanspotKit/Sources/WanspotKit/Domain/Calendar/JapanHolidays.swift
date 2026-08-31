import Foundation

public enum JapanHolidays {
    public static func name(for dateKey: String) -> String? {
        table[dateKey]
    }

    public static func inMonth(_ month: CalendarMonth) -> [String: String] {
        let prefix = "\(month.cacheKey)-"
        return table.reduce(into: [:]) { result, entry in
            if entry.key.hasPrefix(prefix) {
                result[entry.key] = entry.value
            }
        }
    }

    private static let table: [String: String] = {
        guard
            let url = Bundle.module.url(
                forResource: "japan-holidays",
                withExtension: "json"
            ),
            let data = try? Data(contentsOf: url),
            let value = try? JSONDecoder().decode(
                [String: String].self,
                from: data
            )
        else {
            return [:]
        }
        return value
    }()
}
