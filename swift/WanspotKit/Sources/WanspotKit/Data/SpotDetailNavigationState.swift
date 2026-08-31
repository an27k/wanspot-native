import Foundation

public actor SpotDetailNavigationState {
    public static let placeRoutePrefix = "place_"
    public static let legacyPlaceRoutePrefix = "place:"
    public static let handoffLifetime: TimeInterval = 60
    public static let handoffMismatchGrace: TimeInterval = 8
    public static let stashLifetime: TimeInterval = 15 * 60

    private struct Handoff: Sendable {
        let routeID: String
        let place: PlaceResult
        let storedAt: Date
    }

    private struct Stash: Codable, Sendable {
        let spotID: String
        let place: PlaceResult
        let storedAt: Date
    }

    private var placesByRouteID: [String: PlaceResult] = [:]
    private var uuidByPlaceID: [String: String] = [:]
    private var handoff: Handoff?
    private let userDefaults: UserDefaults
    private let stashKey: String

    public init(
        userDefaults: UserDefaults = .standard,
        stashKey: String = "spot_detail_place_stash_v1"
    ) {
        self.userDefaults = userDefaults
        self.stashKey = stashKey
    }

    public func setPlace(routeID: String, place: PlaceResult) {
        placesByRouteID[routeID] = place
        placesByRouteID[Self.placeRouteID(for: place.placeID)] = place
        placesByRouteID["place:\(place.placeID)"] = place
    }

    public func place(for routeID: String) -> PlaceResult? {
        placesByRouteID[routeID]
    }

    public func takePlace(for routeID: String) -> PlaceResult? {
        placesByRouteID.removeValue(forKey: routeID)
    }

    public func setSpotUUID(_ uuid: String, for placeID: String) {
        guard !placeID.isEmpty, !uuid.isEmpty else { return }
        uuidByPlaceID[placeID] = uuid
    }

    public func spotUUID(for placeID: String) -> String? {
        uuidByPlaceID[placeID]
    }

    public func setHandoff(
        routeID: String,
        place: PlaceResult,
        now: Date = Date()
    ) {
        handoff = Handoff(routeID: routeID, place: place, storedAt: now)
    }

    public func peekHandoff(
        routeID: String,
        now: Date = Date()
    ) -> PlaceResult? {
        guard let handoff else { return nil }
        let age = now.timeIntervalSince(handoff.storedAt)
        if age > Self.handoffLifetime {
            self.handoff = nil
            return nil
        }
        if handoff.routeID == routeID {
            return handoff.place
        }
        if
            let placeID = Self.placeID(from: routeID),
            handoff.place.placeID == placeID
        {
            return handoff.place
        }
        return age < Self.handoffMismatchGrace ? handoff.place : nil
    }

    public func takeHandoff(
        routeID: String,
        now: Date = Date()
    ) -> PlaceResult? {
        let place = peekHandoff(routeID: routeID, now: now)
        if place != nil {
            handoff = nil
        }
        return place
    }

    public func stash(
        spotID: String,
        place: PlaceResult,
        now: Date = Date()
    ) {
        let stash = Stash(spotID: spotID, place: place, storedAt: now)
        guard let data = try? JSONEncoder().encode(stash) else { return }
        userDefaults.set(data, forKey: stashKey)
    }

    public func readStash(
        spotID: String,
        now: Date = Date()
    ) -> PlaceResult? {
        guard
            let data = userDefaults.data(forKey: stashKey),
            let stash = try? JSONDecoder().decode(Stash.self, from: data),
            stash.spotID == spotID,
            !stash.place.placeID.isEmpty,
            !stash.place.name.isEmpty,
            now.timeIntervalSince(stash.storedAt) <= Self.stashLifetime
        else {
            return nil
        }
        return stash.place
    }

    public func clearStash() {
        userDefaults.removeObject(forKey: stashKey)
    }

    public static func placeRouteID(for placeID: String) -> String {
        "\(placeRoutePrefix)\(placeID)"
    }

    public static func placeID(from routeID: String) -> String? {
        for prefix in [placeRoutePrefix, legacyPlaceRoutePrefix]
        where routeID.hasPrefix(prefix) {
            let value = routeID
                .dropFirst(prefix.count)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return value.isEmpty ? nil : value
        }
        return nil
    }

    public static func isPendingPlaceRouteID(_ routeID: String) -> Bool {
        placeID(from: routeID) != nil
    }
}
