import Foundation
import XCTest

@testable import WanspotKit

final class SpotDetailNavigationStateTests: XCTestCase {
    func testPlaceIsStoredUnderAllCompatibilityKeys() async {
        let state = SpotDetailNavigationState()
        let place = makePlace()

        await state.setPlace(routeID: "route-1", place: place)
        let direct = await state.place(for: "route-1")
        let canonical = await state.place(for: "place_place-1")
        let legacy = await state.place(for: "place:place-1")

        XCTAssertEqual(direct, place)
        XCTAssertEqual(canonical, place)
        XCTAssertEqual(legacy, place)
    }

    func testHandoffSupportsRouteMismatchGraceAndExpires() async {
        let state = SpotDetailNavigationState()
        let place = makePlace()
        let storedAt = Date(timeIntervalSince1970: 1_000)
        await state.setHandoff(
            routeID: "uuid-route",
            place: place,
            now: storedAt
        )
        let duringGrace = await state.peekHandoff(
            routeID: "different-route",
            now: storedAt.addingTimeInterval(7)
        )
        let afterGrace = await state.peekHandoff(
            routeID: "different-route",
            now: storedAt.addingTimeInterval(9)
        )
        let expired = await state.peekHandoff(
            routeID: "uuid-route",
            now: storedAt.addingTimeInterval(61)
        )

        XCTAssertEqual(duringGrace, place)
        XCTAssertNil(afterGrace)
        XCTAssertNil(expired)
    }

    func testStashRequiresMatchingIDAndExpires() async throws {
        let suiteName = "SpotDetailNavigationStateTests-\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer {
            UserDefaults.standard.removePersistentDomain(forName: suiteName)
        }

        let state = SpotDetailNavigationState(
            userDefaults: defaults,
            stashKey: "stash"
        )
        let place = makePlace()
        let storedAt = Date(timeIntervalSince1970: 1_000)
        await state.stash(
            spotID: "spot-1",
            place: place,
            now: storedAt
        )
        let wrongID = await state.readStash(
            spotID: "other",
            now: storedAt.addingTimeInterval(1)
        )
        let fresh = await state.readStash(
            spotID: "spot-1",
            now: storedAt.addingTimeInterval(14 * 60)
        )
        let expired = await state.readStash(
            spotID: "spot-1",
            now: storedAt.addingTimeInterval(16 * 60)
        )

        XCTAssertNil(wrongID)
        XCTAssertEqual(fresh, place)
        XCTAssertNil(expired)
    }

    private func makePlace() -> PlaceResult {
        PlaceResult(
            placeID: "place-1",
            name: "ワンカフェ",
            category: "カフェ",
            latitude: 35.68,
            longitude: 139.76,
            address: "東京都"
        )
    }
}
