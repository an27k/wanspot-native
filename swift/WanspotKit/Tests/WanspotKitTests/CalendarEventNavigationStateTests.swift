import Foundation
import XCTest

@testable import WanspotKit

final class CalendarEventNavigationStateTests: XCTestCase {
    func testFindsLoadedEventByID() async {
        let state = CalendarEventNavigationState(
            userDefaults: UserDefaults(
                suiteName: "test.calendar-nav.byid"
            ) ?? .standard,
            stashKey: "test_calendar_event_stash_byid"
        )
        let event = CalendarEvent(
            id: "event-1",
            title: "わんこ縁日",
            slug: "wanko-ennichi"
        )
        await state.set(event)

        let foundByID = await state.event(withID: "event-1")
        XCTAssertEqual(foundByID?.slug, "wanko-ennichi")

        let trimmed = await state.event(withID: "  event-1  ")
        XCTAssertEqual(trimmed?.id, "event-1")

        let missing = await state.event(withID: "event-2")
        XCTAssertNil(missing)

        let empty = await state.event(withID: "   ")
        XCTAssertNil(empty)

        await state.clear()
    }
}
