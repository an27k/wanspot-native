import Foundation
import XCTest

@testable import WanspotKit

final class BusinessHoursParityTests: XCTestCase {
    func testOpenStateFromPeriodsMatchesTypeScript() throws {
        let fixture = try loadFixture()

        for testCase in fixture.openStateFromPeriods {
            let actual = BusinessHours.openStateFromPeriods(
                testCase.periods,
                now: try parseDate(testCase.now)
            )
            XCTAssertEqual(actual, testCase.expected, testCase.id)
        }
    }

    func testTodayRangeFromPeriodsMatchesTypeScript() throws {
        let fixture = try loadFixture()

        for testCase in fixture.todayRangeFromPeriods {
            let actual = BusinessHours.todayRangeFromPeriods(
                testCase.periods,
                now: try parseDate(testCase.now)
            )
            XCTAssertEqual(actual, testCase.expected, testCase.id)
        }
    }

    func testSpotOpenStatusMatchesTypeScript() throws {
        let fixture = try loadFixture()

        for testCase in fixture.getSpotOpenStatus {
            let actual = BusinessHours.getSpotOpenStatus(
                weekdayText: testCase.weekdayText,
                openNow: testCase.openNow,
                now: try parseDate(testCase.now)
            )
            XCTAssertEqual(actual, testCase.expected, testCase.id)
        }
    }

    func testTodayHoursSummaryMatchesTypeScript() throws {
        let fixture = try loadFixture()

        for testCase in fixture.todayHoursSummary {
            let actual = BusinessHours.todayHoursSummary(
                weekdayText: testCase.weekdayText,
                openNow: testCase.openNow,
                now: try parseDate(testCase.now)
            )
            XCTAssertEqual(actual, testCase.expected, testCase.id)
        }
    }

    func testStripLeadingYenMatchesTypeScript() throws {
        let fixture = try loadFixture()

        for testCase in fixture.stripLeadingYen {
            let actual = BusinessHours.stripLeadingYen(testCase.label)
            XCTAssertEqual(actual, testCase.expected, testCase.id)
        }
    }

    func testFormatPriceDisplayMatchesTypeScript() throws {
        let fixture = try loadFixture()

        for testCase in fixture.formatPriceDisplay {
            let actual = BusinessHours.formatPriceDisplay(
                priceLabel: testCase.priceLabel,
                priceLevel: testCase.priceLevel
            )
            XCTAssertEqual(actual, testCase.expected, testCase.id)
        }
    }

    private func loadFixture() throws -> BusinessHoursFixture {
        let url = try XCTUnwrap(
            Bundle.module.url(
                forResource: "business-hours",
                withExtension: "json"
            )
        )
        return try JSONDecoder().decode(
            BusinessHoursFixture.self,
            from: Data(contentsOf: url)
        )
    }

    private func parseDate(_ value: String) throws -> Date {
        let formatter = ISO8601DateFormatter()
        return try XCTUnwrap(formatter.date(from: value), value)
    }
}

private struct BusinessHoursFixture: Decodable {
    let schemaVersion: Int
    let source: String
    let timeZone: String
    let openStateFromPeriods: [OpenStateCase]
    let todayRangeFromPeriods: [RangeCase]
    let getSpotOpenStatus: [WeekdayCase]
    let todayHoursSummary: [SummaryCase]
    let stripLeadingYen: [StripYenCase]
    let formatPriceDisplay: [PriceCase]
}

private struct OpenStateCase: Decodable {
    let id: String
    let periods: [OpeningPeriod]?
    let now: String
    let expected: OpenState
}

private struct RangeCase: Decodable {
    let id: String
    let periods: [OpeningPeriod]?
    let now: String
    let expected: String?
}

private struct WeekdayCase: Decodable {
    let id: String
    let weekdayText: [String]?
    let openNow: Bool?
    let now: String
    let expected: OpenStatus
}

private struct SummaryCase: Decodable {
    let id: String
    let weekdayText: [String]?
    let openNow: Bool?
    let now: String
    let expected: HoursSummary?
}

private struct StripYenCase: Decodable {
    let id: String
    let label: String?
    let expected: String?
}

private struct PriceCase: Decodable {
    let id: String
    let priceLabel: String?
    let priceLevel: Double?
    let expected: String?
}
