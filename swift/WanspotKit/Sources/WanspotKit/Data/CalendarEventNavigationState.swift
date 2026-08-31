import Foundation

public actor CalendarEventNavigationState {
    public static let handoffLifetime: TimeInterval = 60
    public static let stashLifetime: TimeInterval = 15 * 60

    private struct Handoff: Sendable {
        let slug: String
        let event: CalendarEvent
        let storedAt: Date
    }

    private struct Stash: Codable, Sendable {
        let slug: String
        let event: CalendarEvent
        let storedAt: Date
    }

    private var eventsBySlug: [String: CalendarEvent] = [:]
    private var handoff: Handoff?
    private let defaults: UserDefaults
    private let stashKey: String

    public init(
        userDefaults: UserDefaults = .standard,
        stashKey: String = "calendar_event_stash_v1"
    ) {
        defaults = userDefaults
        self.stashKey = stashKey
    }

    public func set(_ event: CalendarEvent) {
        eventsBySlug[event.slug] = event
    }

    public func event(for slug: String) -> CalendarEvent? {
        eventsBySlug[normalized(slug)]
    }

    // チャットのイベントカードは eventId しか持たないため、既に読み込み済みの
    // イベントを id で引けるようにする（slug が引けたら通常経路に乗せる）
    public func event(withID id: String) -> CalendarEvent? {
        let id = normalized(id)
        guard !id.isEmpty else { return nil }
        return eventsBySlug.values.first { $0.id == id }
    }

    public func stash(
        _ event: CalendarEvent,
        now: Date = Date()
    ) {
        let slug = normalized(event.slug)
        guard !slug.isEmpty else { return }
        eventsBySlug[slug] = event
        handoff = Handoff(slug: slug, event: event, storedAt: now)
        let stash = Stash(slug: slug, event: event, storedAt: now)
        guard let data = try? JSONEncoder().encode(stash) else { return }
        defaults.set(data, forKey: stashKey)
    }

    public func resolve(
        slug: String,
        now: Date = Date()
    ) -> CalendarEvent? {
        let slug = normalized(slug)
        guard !slug.isEmpty else { return nil }

        if let handoff {
            if now.timeIntervalSince(handoff.storedAt) > Self.handoffLifetime {
                self.handoff = nil
            } else if handoff.slug == slug {
                self.handoff = nil
                return handoff.event
            }
        }
        if let event = eventsBySlug[slug] {
            return event
        }
        guard
            let data = defaults.data(forKey: stashKey),
            let stash = try? JSONDecoder().decode(Stash.self, from: data),
            stash.slug == slug,
            stash.event.slug == slug,
            now.timeIntervalSince(stash.storedAt) <= Self.stashLifetime
        else {
            return nil
        }
        eventsBySlug[slug] = stash.event
        return stash.event
    }

    public func clear() {
        eventsBySlug.removeAll()
        handoff = nil
        defaults.removeObject(forKey: stashKey)
    }

    private func normalized(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
