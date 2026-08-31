import Foundation
import XCTest

@testable import WanspotKit

final class SettingsPlatformDomainTests: XCTestCase {
    func testDogProfileFormNormalizesOptionalValues() throws {
        let dog = DogProfile(
            id: "dog-1",
            userID: "user-1",
            name: " モカ ",
            breed: " ",
            birthday: "2022-04-01",
            gender: .female,
            size: .small,
            rabiesVaccinatedAt: nil,
            vaccineVaccinatedAt: nil,
            photoURL: nil,
            rabiesVaccinated: false,
            vaccineVaccinated: false,
            walkAreaTags: [],
            isPrimary: true
        )
        let submission = try DogProfileForm(profile: dog).validated(
            now: date("2026-08-19T00:00:00Z")
        )

        XCTAssertEqual(submission.name, "モカ")
        XCTAssertNil(submission.breed)
        XCTAssertEqual(submission.birthday, "2022-04-01")
        XCTAssertEqual(submission.gender, .female)
        XCTAssertEqual(submission.size, .small)
    }

    func testDogProfileFormRejectsBlankNameAndFutureBirthday() {
        XCTAssertThrowsError(
            try DogProfileForm(
                name: " ",
                breed: "",
                birthday: nil,
                gender: nil,
                size: nil
            ).validated()
        ) { error in
            XCTAssertEqual(
                error as? DogProfileFormValidationError,
                .nameRequired
            )
        }

        XCTAssertThrowsError(
            try DogProfileForm(
                name: "モカ",
                breed: "",
                birthday: "2026-08-20",
                gender: nil,
                size: nil
            ).validated(now: date("2026-08-19T00:00:00Z"))
        ) { error in
            XCTAssertEqual(
                error as? DogProfileFormValidationError,
                .futureBirthday
            )
        }
    }

    func testMorningNotificationScheduleNormalizesAndFindsNextFire() {
        let normalized = MorningWalkNotificationSchedule(
            hour: 99,
            minute: -2
        )
        XCTAssertEqual(normalized.hour, 23)
        XCTAssertEqual(normalized.minute, 0)
        XCTAssertEqual(
            normalized.destination.url.absoluteString,
            "wanspot://mypage/walk-forecast"
        )

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let schedule = MorningWalkNotificationSchedule(hour: 5)
        XCTAssertEqual(
            schedule.nextFireDate(
                after: date("2026-08-19T04:30:00Z"),
                calendar: calendar
            ),
            date("2026-08-19T05:00:00Z")
        )
        XCTAssertEqual(
            schedule.nextFireDate(
                after: date("2026-08-19T05:30:00Z"),
                calendar: calendar
            ),
            date("2026-08-20T05:00:00Z")
        )
    }

    func testAdsRequireFlagAndProviderBoundary() throws {
        let configuration = try AppConfiguration.resolve(
            environment: [
                "SUPABASE_URL": "https://example.supabase.co",
                "SUPABASE_PUBLISHABLE_KEY": "key",
                "WANSPOT_ADS_ENABLED": "true",
            ]
        )

        XCTAssertFalse(
            FeatureConfiguration.resolve(
                appConfiguration: configuration,
                adsProviderAvailable: false
            ).adsEnabled
        )
        XCTAssertTrue(
            FeatureConfiguration.resolve(
                appConfiguration: configuration,
                adsProviderAvailable: true
            ).adsEnabled
        )
    }

    func testVisitedMappingUsesNewestCanonicalOrLegacyRecord() throws {
        let visit = try JSONDecoder().decode(
            Visit.self,
            from: Data(
                """
                {
                  "id": "visit-1",
                  "user_id": "user-1",
                  "spot_id": "11111111-1111-4111-8111-111111111111",
                  "visited_at": "2026-08-18T10:00:00Z",
                  "comment": null,
                  "rating": null,
                  "context": null,
                  "mood": null,
                  "source": "detail_button",
                  "soft_deleted": false,
                  "created_at": "2026-08-18T10:00:00Z"
                }
                """.utf8
            )
        )
        let checkIn = CheckIn(
            id: "check-1",
            spotID: "11111111-1111-4111-8111-111111111111",
            createdAt: "2026-08-19T10:00:00Z"
        )

        let records = UserSpotHistoryMapping.visitedRecords(
            visits: [visit],
            checkIns: [checkIn]
        )

        XCTAssertEqual(records.count, 1)
        XCTAssertEqual(records.first?.id, "check-in:check-1")
        XCTAssertEqual(records.first?.occurredAt, "2026-08-19T10:00:00Z")
    }

    func testHistoryResolutionPreservesOrderAndUnavailableRows() throws {
        let records = [
            UserSpotHistoryRecord(
                id: "liked:missing",
                spotID: "missing",
                occurredAt: "2026-08-19T10:00:00Z",
                kind: .liked
            ),
            UserSpotHistoryRecord(
                id: "liked:spot-1",
                spotID: "spot-1",
                occurredAt: "2026-08-18T10:00:00Z",
                kind: .liked
            ),
        ]
        let spot = try JSONDecoder().decode(
            PublicSpot.self,
            from: Data(
                """
                {
                  "id": "spot-1",
                  "place_id": "place-1",
                  "name": "ワンカフェ",
                  "category": "カフェ",
                  "address": "DB住所",
                  "lat": 35.0,
                  "lng": 139.0,
                  "rating": 3.0,
                  "photo_ref": "db-photo"
                }
                """.utf8
            )
        )
        let detail = BatchPlaceDetail(
            photoReference: "places-photo",
            rating: 4.5,
            userRatingsTotal: 120,
            priceLevel: 2,
            priceLabel: "¥¥",
            formattedAddress: "Google住所",
            vicinity: nil
        )

        let resolved = UserSpotHistoryMapping.resolve(
            records: records,
            spots: [spot],
            detailsByPlaceID: ["place-1": detail]
        )

        XCTAssertEqual(resolved.map(\.spotID), ["missing", "spot-1"])
        XCTAssertFalse(resolved[0].isAvailable)
        XCTAssertEqual(resolved[1].address, "Google住所")
        XCTAssertEqual(resolved[1].photoReference, "places-photo")
        XCTAssertEqual(resolved[1].rating, 4.5)
    }

    func testHistoryResolutionAcceptsLegacyPlaceIDReference() throws {
        let record = UserSpotHistoryRecord(
            id: "check-in:legacy",
            spotID: "ChIJ-legacy-place",
            occurredAt: "2026-08-19T10:00:00Z",
            kind: .visited
        )
        let spot = try JSONDecoder().decode(
            PublicSpot.self,
            from: Data(
                """
                {
                  "id": "11111111-1111-4111-8111-111111111111",
                  "place_id": "ChIJ-legacy-place",
                  "name": "レガシースポット",
                  "category": "公園",
                  "lat": 35.0,
                  "lng": 139.0
                }
                """.utf8
            )
        )

        let resolved = UserSpotHistoryMapping.resolve(
            records: [record],
            spots: [spot],
            detailsByPlaceID: [:]
        )

        XCTAssertEqual(resolved.first?.spotID, "ChIJ-legacy-place")
        XCTAssertEqual(resolved.first?.placeID, "ChIJ-legacy-place")
        XCTAssertEqual(resolved.first?.name, "レガシースポット")
        XCTAssertEqual(resolved.first?.isAvailable, true)
    }

    private func date(_ value: String) -> Date {
        ISO8601DateFormatter().date(from: value)!
    }
}
