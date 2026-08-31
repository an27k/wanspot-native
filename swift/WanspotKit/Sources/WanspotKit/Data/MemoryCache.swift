import Foundation

public enum CacheLookup<Value: Sendable>: Sendable {
    case missing
    case hit(Value)
}

public struct CacheFetchResult<Value: Sendable>: Sendable {
    public let value: Value
    public let isFromCache: Bool

    public init(value: Value, isFromCache: Bool) {
        self.value = value
        self.isFromCache = isFromCache
    }
}

public enum MemoryCacheError: Error, Equatable, Sendable {
    case keyTypeMismatch(String)
}

public enum CacheTTL {
    public static let location: TimeInterval = 3 * 60
    public static let nearbySpots: TimeInterval = 12 * 60
    public static let userLists: TimeInterval = 5 * 60
    public static let walkTags: TimeInterval = 30 * 60
    public static let todayPhoto: TimeInterval = 60 * 60
    public static let album: TimeInterval = 10 * 60
    public static let weather: TimeInterval = 10 * 60
    public static let geo: TimeInterval = 30 * 60
    public static let calendarMonth: TimeInterval = 30 * 60
    public static let calendarEvent: TimeInterval = 30 * 60
    public static let calendarNearby: TimeInterval = 10 * 60
    public static let articles: TimeInterval = 10 * 60
    public static let articleDetail: TimeInterval = 10 * 60
    public static let suggestedTags: TimeInterval = 15 * 60
    public static let spotLikes: TimeInterval = 5 * 60
    public static let recommendations: TimeInterval = 12 * 60
    public static let dogProfile: TimeInterval = 10 * 60
    public static let aiSummary: TimeInterval = 30 * 60
}

public actor MemoryCache {
    private protocol AnyValueBox: Sendable {}

    private struct ValueBox<Value: Sendable>: AnyValueBox {
        let value: Value
    }

    private struct Entry: Sendable {
        let box: any AnyValueBox
        let fetchedAt: Date
    }

    private protocol AnyTaskBox: Sendable {}

    private struct TaskBox<Value: Sendable>: AnyTaskBox {
        let task: Task<Value, Error>
    }

    private var entries: [String: Entry] = [:]
    private var inFlight: [String: any AnyTaskBox] = [:]

    public init() {}

    public func lookup<Value: Sendable>(
        _ key: String,
        as valueType: Value.Type = Value.self
    ) -> CacheLookup<Value> {
        guard
            let entry = entries[key],
            let box = entry.box as? ValueBox<Value>
        else {
            return .missing
        }
        return .hit(box.value)
    }

    public func isFresh(
        _ key: String,
        ttl: TimeInterval,
        now: Date = Date()
    ) -> Bool {
        guard let entry = entries[key] else { return false }
        return now.timeIntervalSince(entry.fetchedAt) < ttl
    }

    public func write<Value: Sendable>(
        _ value: Value,
        for key: String,
        fetchedAt: Date = Date()
    ) {
        entries[key] = Entry(
            box: ValueBox(value: value),
            fetchedAt: fetchedAt
        )
    }

    public func invalidate(_ key: String) {
        entries.removeValue(forKey: key)
    }

    public func invalidate(prefix: String) {
        entries.keys
            .filter { $0.hasPrefix(prefix) }
            .forEach { entries.removeValue(forKey: $0) }
    }

    public func removeAll() {
        entries.removeAll()
    }

    public func fetch<Value: Sendable>(
        _ key: String,
        ttl: TimeInterval,
        force: Bool = false,
        now: Date = Date(),
        operation: @escaping @Sendable () async throws -> Value
    ) async throws -> CacheFetchResult<Value> {
        if !force, isFresh(key, ttl: ttl, now: now) {
            switch lookup(key, as: Value.self) {
            case let .hit(value):
                return CacheFetchResult(value: value, isFromCache: true)
            case .missing:
                throw MemoryCacheError.keyTypeMismatch(key)
            }
        }

        if let pending = inFlight[key] {
            guard let typed = pending as? TaskBox<Value> else {
                throw MemoryCacheError.keyTypeMismatch(key)
            }
            return CacheFetchResult(
                value: try await typed.task.value,
                isFromCache: false
            )
        }

        let task = Task<Value, Error> {
            try await operation()
        }
        inFlight[key] = TaskBox(task: task)

        do {
            let value = try await task.value
            entries[key] = Entry(
                box: ValueBox(value: value),
                fetchedAt: now
            )
            inFlight.removeValue(forKey: key)
            return CacheFetchResult(value: value, isFromCache: false)
        } catch {
            inFlight.removeValue(forKey: key)
            throw error
        }
    }
}

public func geoBucket(
    latitude: Double,
    longitude: Double,
    decimals: Int = 3
) -> String {
    let decimals = max(0, decimals)
    return String(
        format: "%.*f,%.*f",
        locale: Locale(identifier: "en_US_POSIX"),
        decimals,
        latitude,
        decimals,
        longitude
    )
}
