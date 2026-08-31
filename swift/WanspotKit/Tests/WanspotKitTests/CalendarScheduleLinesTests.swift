import Foundation
import XCTest

@testable import WanspotKit

/// `schedule_lines`（サーバがまとめ済みの開催日時の表示行）のデコードと、
/// 欠落時に `occurrences` へ落ちるフォールバックの検証。
final class CalendarScheduleLinesTests: XCTestCase {
    private func decodeEvent(
        scheduleLinesJSON: String?
    ) throws -> CalendarEvent {
        let scheduleLines = scheduleLinesJSON.map {
            "\"schedule_lines\": \($0),"
        } ?? ""
        let json = """
        {
          "id": "event-1",
          "title": "鼻ぺちゃ展",
          "slug": "hanapecha",
          \(scheduleLines)
          "last_entry_text": "16:30",
          "occurrences": [
            {
              "id": "occurrence-1",
              "event_id": "event-1",
              "starts_at": "2026-08-23T10:00:00+09:00",
              "ends_at": "2026-08-23T17:00:00+09:00",
              "is_all_day": false
            },
            {
              "id": "occurrence-2",
              "event_id": "event-1",
              "starts_at": "2026-08-24T10:00:00+09:00",
              "ends_at": "2026-08-24T17:00:00+09:00",
              "is_all_day": false
            }
          ]
        }
        """
        return try JSONDecoder().decode(
            CalendarEvent.self,
            from: Data(json.utf8)
        )
    }

    func testDecodesScheduleLines() throws {
        let event = try decodeEvent(
            scheduleLinesJSON: """
            ["8/23(日)〜8/30(日) 10:00〜17:00", "8/31(月) 10:00〜15:00"]
            """
        )

        XCTAssertEqual(
            event.scheduleLines,
            ["8/23(日)〜8/30(日) 10:00〜17:00", "8/31(月) 10:00〜15:00"]
        )
        // occurrences は従来どおり残る（日ごとの処理をする画面が使う）
        XCTAssertEqual(event.occurrences.count, 2)
    }

    func testMissingKeyYieldsEmptyLinesAndKeepsOtherFields() throws {
        let event = try decodeEvent(scheduleLinesJSON: nil)

        XCTAssertTrue(event.scheduleLines.isEmpty)
        XCTAssertEqual(event.title, "鼻ぺちゃ展")
        XCTAssertEqual(event.lastEntryText, "16:30")
        XCTAssertEqual(event.occurrences.count, 2)
    }

    func testNullYieldsEmptyLines() throws {
        let event = try decodeEvent(scheduleLinesJSON: "null")

        XCTAssertTrue(event.scheduleLines.isEmpty)
        XCTAssertEqual(event.occurrences.count, 2)
    }

    func testEmptyArrayYieldsEmptyLines() throws {
        let event = try decodeEvent(scheduleLinesJSON: "[]")

        XCTAssertTrue(event.scheduleLines.isEmpty)
        XCTAssertEqual(event.occurrences.count, 2)
    }

    func testBrokenElementsYieldEmptyLinesAndKeepOtherFields() throws {
        let event = try decodeEvent(
            scheduleLinesJSON: """
            ["8/23(日) 10:00〜17:00", 42, {"date": "8/24"}]
            """
        )

        XCTAssertTrue(event.scheduleLines.isEmpty)
        XCTAssertEqual(event.title, "鼻ぺちゃ展")
        XCTAssertEqual(event.lastEntryText, "16:30")
        XCTAssertEqual(event.occurrences.count, 2)
    }

    func testWrongTypeYieldsEmptyLines() throws {
        let event = try decodeEvent(scheduleLinesJSON: "\"8/23(日)\"")

        XCTAssertTrue(event.scheduleLines.isEmpty)
        XCTAssertEqual(event.occurrences.count, 2)
    }

    func testBlankAndDuplicateLinesAreDropped() throws {
        let event = try decodeEvent(
            scheduleLinesJSON: """
            ["  8/23(日) 10:00〜17:00 ", "", "   ", "8/23(日) 10:00〜17:00"]
            """
        )

        XCTAssertEqual(event.scheduleLines, ["8/23(日) 10:00〜17:00"])
    }

    func testStashRoundTripKeepsScheduleLines() throws {
        let event = try decodeEvent(
            scheduleLinesJSON: """
            ["8/23(日)〜8/30(日) 10:00〜17:00"]
            """
        )
        let data = try JSONEncoder().encode(event)
        let restored = try JSONDecoder().decode(
            CalendarEvent.self,
            from: data
        )

        XCTAssertEqual(restored.scheduleLines, event.scheduleLines)
    }

    // MARK: - フォールバック分岐

    func testRulesUseScheduleLinesWhenPresent() throws {
        let event = try decodeEvent(
            scheduleLinesJSON: """
            ["8/23(日)〜8/24(月) 10:00〜17:00"]
            """
        )

        XCTAssertEqual(
            CalendarRules.scheduleLines(for: event),
            ["8/23(日)〜8/24(月) 10:00〜17:00"]
        )
    }

    func testRulesFallBackToOccurrencesWhenLinesMissing() throws {
        let event = try decodeEvent(scheduleLinesJSON: nil)

        XCTAssertEqual(
            CalendarRules.scheduleLines(for: event),
            event.occurrences.map(CalendarRules.occurrenceLabel)
        )
        XCTAssertEqual(
            CalendarRules.scheduleLines(for: event),
            ["8/23(日) 10:00〜17:00", "8/24(月) 10:00〜17:00"]
        )
    }

    func testRulesFallBackWhenLinesAreEmptyArray() throws {
        let event = try decodeEvent(scheduleLinesJSON: "[]")

        XCTAssertEqual(CalendarRules.scheduleLines(for: event).count, 2)
    }

    func testRulesReturnEmptyWhenNothingToShow() {
        let event = CalendarEvent(
            id: "event-2",
            title: "日程未定",
            slug: "tbd"
        )

        XCTAssertTrue(CalendarRules.scheduleLines(for: event).isEmpty)
    }
}
