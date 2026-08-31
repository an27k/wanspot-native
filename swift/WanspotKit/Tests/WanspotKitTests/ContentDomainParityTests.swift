import Foundation
import XCTest

@testable import WanspotKit

final class ContentDomainParityTests: XCTestCase {
    func testArticleThemeParsingMatchesTypeScript() throws {
        let fixture = try loadFixture()
        for testCase in fixture.articles.themes {
            XCTAssertEqual(
                ArticleRules.parseTheme(testCase.theme),
                testCase.expected,
                testCase.id
            )
        }
    }

    func testArticleMonthAndEventOrderingMatchesTypeScript() throws {
        let fixture = try loadFixture()
        for testCase in fixture.articles.monthKeys {
            XCTAssertEqual(
                ArticleRules.eventRoundupMonthKey(
                    title: testCase.title,
                    slug: testCase.slug,
                    theme: testCase.theme
                ),
                testCase.expected,
                testCase.id
            )
        }

        let summaries = fixture.articles.eventOrder.articles.map {
            ArticleSummary(
                id: $0.id,
                title: $0.title,
                summary: "",
                slug: $0.slug,
                theme: $0.theme
            )
        }
        XCTAssertEqual(
            ArticleRules.eventRoundupOrder(summaries).map(\.id),
            fixture.articles.eventOrder.expectedIDs
        )
    }

    func testAvailableGenreOrderMatchesTypeScript() throws {
        let fixture = try loadFixture()
        let summaries = fixture.articles.availableGenreOrder.themes.enumerated()
            .map { index, theme in
                ArticleSummary(
                    id: "\(index)",
                    title: theme,
                    summary: "",
                    slug: "article-\(index)",
                    theme: theme
                )
            }
        XCTAssertEqual(
            ArticleRules.availableGenres(in: summaries),
            fixture.articles.availableGenreOrder.expected
        )
    }

    func testRelatedArticlesMatchExactSpotReferencesInPublishedOrder() {
        let spotID = "11111111-1111-4111-8111-111111111111"
        let placeID = "test-place-id"
        let articles = [
            ArticleSummary(
                id: "older-id-match",
                title: "UUIDで掲載",
                summary: "",
                slug: "older-id-match",
                publishedAt: Date(timeIntervalSince1970: 100),
                linkedSpotReferences: [spotID]
            ),
            ArticleSummary(
                id: "newer-place-match",
                title: "Place IDで掲載",
                summary: "",
                slug: "newer-place-match",
                publishedAt: Date(timeIntervalSince1970: 200),
                linkedSpotReferences: ["  \(placeID)  "]
            ),
            ArticleSummary(
                id: "name-only",
                title: "test-place-idを本文で紹介",
                summary: placeID,
                slug: "name-only",
                publishedAt: Date(timeIntervalSince1970: 300),
                linkedSpotReferences: []
            ),
        ]

        XCTAssertEqual(
            ArticleRules.relatedArticles(
                in: articles,
                spotID: spotID,
                placeID: placeID,
                limit: 2
            ).map(\.id),
            ["newer-place-match", "older-id-match"]
        )
        XCTAssertTrue(
            ArticleRules.relatedArticles(
                in: articles,
                spotID: nil,
                placeID: "",
                limit: 2
            ).isEmpty
        )
    }

    func testRelatedArticlesMatchExactEventReferencesInPublishedOrder() {
        let eventID = "11111111-1111-4111-8111-111111111111"
        let articles = [
            ArticleSummary(
                id: "older-event-match",
                title: "以前の掲載記事",
                summary: "",
                slug: "older-event-match",
                publishedAt: Date(timeIntervalSince1970: 100),
                linkedEventReferences: [eventID]
            ),
            ArticleSummary(
                id: "newer-event-match",
                title: "新しい掲載記事",
                summary: "",
                slug: "newer-event-match",
                publishedAt: Date(timeIntervalSince1970: 200),
                linkedEventReferences: ["  \(eventID)  "]
            ),
            ArticleSummary(
                id: "title-only",
                title: eventID,
                summary: eventID,
                slug: "title-only",
                publishedAt: Date(timeIntervalSince1970: 300)
            ),
            ArticleSummary(
                id: "roundup-fallback",
                title: "2026年8月のイベント",
                summary: "",
                slug: "events-2026-08-kanto",
                category: "event",
                publishedAt: Date(timeIntervalSince1970: 400),
                targetPrefectures: ["東京都"]
            ),
        ]

        XCTAssertEqual(
            ArticleRules.relatedArticles(
                in: articles,
                eventID: eventID,
                limit: 2
            ).map(\.id),
            ["newer-event-match", "older-event-match"]
        )
        XCTAssertEqual(
            ArticleRules.relatedArticles(
                in: articles,
                eventID: "event-without-explicit-reference",
                eventMonth: "2026-08",
                prefecture: "東京都",
                limit: 2
            ).map(\.id),
            ["roundup-fallback"]
        )
        XCTAssertTrue(
            ArticleRules.relatedArticles(
                in: articles,
                eventID: " ",
                limit: 2
            ).isEmpty
        )
    }

    func testArticleRankingIncludesWalkAreaCatalogProximity() throws {
        let catalog = try XCTUnwrap(
            OnboardingCatalog.walkAreas.first { $0.label == "渋谷区" }
        )
        let near = ArticleSummary(
            id: "near",
            title: "近い記事",
            summary: "",
            slug: "near",
            segmentLevel: .region,
            linkedSpotReferences: ["near-spot"]
        )
        let far = ArticleSummary(
            id: "far",
            title: "遠い記事",
            summary: "",
            slug: "far",
            segmentLevel: .region,
            linkedSpotReferences: ["far-spot"]
        )
        let spots = [
            "near-spot": ArticleRankingSpot(
                id: "near-spot",
                placeID: nil,
                latitude: catalog.latitude,
                longitude: catalog.longitude,
                municipality: nil,
                prefecture: nil
            ),
            "far-spot": ArticleRankingSpot(
                id: "far-spot",
                placeID: nil,
                latitude: 26.2124,
                longitude: 127.6811,
                municipality: nil,
                prefecture: nil
            ),
        ]

        XCTAssertEqual(
            ArticleRules.rank(
                [far, near],
                spotsByReference: spots,
                context: ArticleRankingContext(
                    walkAreaTags: ["渋谷区"],
                    userSeed: "fixture",
                    now: Date(timeIntervalSince1970: 1_776_211_200)
                )
            ).map(\.id),
            ["near", "far"]
        )
    }

    func testJSTDateAndOccurrenceLabelsMatchTypeScript() throws {
        let fixture = try loadFixture()
        for testCase in fixture.calendar.dates {
            let date = try parseDate(testCase.iso)
            XCTAssertEqual(
                CalendarRules.dateKey(date),
                testCase.expectedDateKey,
                testCase.id
            )
            XCTAssertEqual(
                CalendarRules.timeLabel(date),
                testCase.expectedTimeLabel,
                testCase.id
            )
        }
        for testCase in fixture.calendar.occurrences {
            XCTAssertEqual(
                CalendarRules.occurrenceLabel(testCase.occurrence),
                testCase.expected,
                testCase.id
            )
        }
    }

    func testCalendarToneHolidayAndPrefectureRulesMatchTypeScript() throws {
        let fixture = try loadFixture()
        for testCase in fixture.calendar.tones {
            XCTAssertEqual(
                CalendarRules.dateTone(
                    dateKey: testCase.dateKey,
                    todayKey: testCase.todayKey,
                    holidayName: testCase.holidayName
                ),
                testCase.expected,
                testCase.id
            )
        }
        for testCase in fixture.calendar.holidayFormats {
            XCTAssertEqual(
                CalendarRules.normalizedHolidayName(
                    name: testCase.entry.name,
                    englishName: testCase.entry.englishName
                ),
                testCase.expected,
                testCase.id
            )
        }
        XCTAssertEqual(
            JapanHolidays.name(for: fixture.calendar.knownHoliday.dateKey),
            fixture.calendar.knownHoliday.expected
        )
        for testCase in fixture.calendar.prefectures {
            XCTAssertEqual(
                CalendarRules.prefectureName(in: testCase.address),
                testCase.expectedFromAddress,
                "\(testCase.id): address"
            )
            let event = CalendarEvent(
                id: testCase.id,
                title: testCase.id,
                slug: testCase.id,
                venueName: testCase.venueName,
                address: testCase.address
            )
            XCTAssertEqual(
                CalendarRules.displayPrefecture(for: event),
                testCase.expectedResolved,
                "\(testCase.id): resolved"
            )
        }
    }

    func testMonthGridMatchesTypeScript() throws {
        let fixture = try loadFixture()
        for testCase in fixture.calendar.monthGrids {
            XCTAssertEqual(
                CalendarRules.monthGrid(
                    CalendarMonth(year: testCase.year, month: testCase.month)
                ),
                testCase.expected,
                testCase.id
            )
        }
    }

    private func loadFixture() throws -> ContentDomainFixture {
        let url = try XCTUnwrap(
            Bundle.module.url(
                forResource: "content-domain",
                withExtension: "json"
            )
        )
        return try JSONDecoder().decode(
            ContentDomainFixture.self,
            from: Data(contentsOf: url)
        )
    }

    private func parseDate(_ value: String) throws -> Date {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [
            .withInternetDateTime,
            .withFractionalSeconds,
        ]
        if let date = formatter.date(from: value) {
            return date
        }
        formatter.formatOptions = [.withInternetDateTime]
        return try XCTUnwrap(formatter.date(from: value), value)
    }
}

private struct ContentDomainFixture: Decodable {
    let articles: ArticleCases
    let calendar: CalendarCases
}

private struct ArticleCases: Decodable {
    let themes: [ThemeCase]
    let monthKeys: [MonthKeyCase]
    let eventOrder: EventOrderCase
    let availableGenreOrder: AvailableGenreCase
}

private struct ThemeCase: Decodable {
    let id: String
    let theme: String?
    let expected: ArticleThemeInfo
}

private struct MonthKeyCase: Decodable {
    let id: String
    let title: String?
    let slug: String?
    let theme: String?
    let expected: String?
}

private struct EventOrderCase: Decodable {
    struct Article: Decodable {
        let id: String
        let title: String
        let slug: String
        let theme: String?
    }

    let articles: [Article]
    let expectedIDs: [String]

    private enum CodingKeys: String, CodingKey {
        case articles
        case expectedIDs = "expectedIds"
    }
}

private struct AvailableGenreCase: Decodable {
    let themes: [String]
    let expected: [ArticleGenre]
}

private struct CalendarCases: Decodable {
    let dates: [DateCase]
    let occurrences: [OccurrenceCase]
    let tones: [ToneCase]
    let holidayFormats: [HolidayFormatCase]
    let knownHoliday: KnownHolidayCase
    let prefectures: [PrefectureCase]
    let monthGrids: [MonthGridCase]
}

private struct DateCase: Decodable {
    let id: String
    let iso: String
    let expectedDateKey: String
    let expectedTimeLabel: String
}

private struct OccurrenceCase: Decodable {
    let id: String
    let occurrence: CalendarEventOccurrence
    let expected: String
}

private struct ToneCase: Decodable {
    let id: String
    let dateKey: String
    let todayKey: String
    let holidayName: String?
    let expected: CalendarDateTone
}

private struct HolidayFormatCase: Decodable {
    struct Entry: Decodable {
        let name: String
        let englishName: String?

        private enum CodingKeys: String, CodingKey {
            case name
            case englishName = "name_en"
        }
    }

    let id: String
    let entry: Entry
    let expected: String
}

private struct KnownHolidayCase: Decodable {
    let dateKey: String
    let expected: String?
}

private struct PrefectureCase: Decodable {
    let id: String
    let address: String?
    let venueName: String?
    let expectedFromAddress: String?
    let expectedResolved: String?
}

private struct MonthGridCase: Decodable {
    let id: String
    let year: Int
    let month: Int
    let expected: [[Int?]]
}
