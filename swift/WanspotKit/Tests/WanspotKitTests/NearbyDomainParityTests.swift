import Foundation
import XCTest

@testable import WanspotKit

final class NearbyDomainParityTests: XCTestCase {
    func testRankingMatchesTypeScript() throws {
        let fixture = try loadFixture()

        for testCase in fixture.ranking {
            let origin = testCase.origin?.nearbyCoordinate
            let now = try parseDate(testCase.now)
            let actual = NearbyRanking.sort(
                testCase.spots,
                origin: origin,
                situation: testCase.situation,
                now: now
            )
            XCTAssertEqual(
                actual.map(\.placeID),
                testCase.expected.placeIDs,
                testCase.id
            )

            for (placeID, expectedScore) in testCase.expected.scores {
                let spot = try XCTUnwrap(
                    testCase.spots.first { $0.placeID == placeID },
                    "\(testCase.id): \(placeID)"
                )
                XCTAssertEqual(
                    NearbyRanking.overallScore(
                        spot,
                        origin: origin,
                        situation: testCase.situation,
                        now: now
                    ),
                    expectedScore,
                    accuracy: 0.000_000_1,
                    "\(testCase.id): \(placeID)"
                )
            }
        }
    }

    func testConditionFilteringMatchesTypeScript() throws {
        let fixture = try loadFixture()

        for testCase in fixture.conditions {
            let actual = NearbyFilter.applyConditions(
                testCase.spots,
                conditions: testCase.conditions,
                likedPlaceIDs: Set(testCase.likedPlaceIDs),
                genre: testCase.genre
            )
            XCTAssertEqual(
                actual.map(\.placeID),
                testCase.expected,
                testCase.id
            )
        }
    }

    func testGenreFilteringMatchesTypeScript() throws {
        let fixture = try loadFixture()

        for testCase in fixture.genres {
            let actual = testCase.spots.filter {
                NearbyFilter.matchesGenre($0, genre: testCase.genre)
            }
            XCTAssertEqual(
                actual.map(\.placeID),
                testCase.expected,
                testCase.id
            )
        }
    }

    func testDisplayGenreFollowsActiveFilterForCrossGenreSpot() {
        let spot = PlaceResult(
            placeID: "cafe-restaurant",
            name: "カフェレストラン",
            category: "レストラン",
            latitude: 35.6812,
            longitude: 139.7671,
            address: "東京都",
            types: ["cafe", "restaurant"]
        )

        XCTAssertTrue(NearbyFilter.matchesGenre(spot, genre: .cafe))
        XCTAssertTrue(NearbyFilter.matchesGenre(spot, genre: .restaurant))
        XCTAssertEqual(NearbyFilter.inferredGenre(for: spot), .restaurant)
        XCTAssertEqual(
            NearbyFilter.displayGenre(for: spot, selectedGenre: .cafe),
            .cafe
        )
        XCTAssertEqual(
            NearbyFilter.displayGenre(for: spot, selectedGenre: .restaurant),
            .restaurant
        )
        XCTAssertEqual(
            NearbyFilter.displayGenre(for: spot, selectedGenre: nil),
            .restaurant
        )
        XCTAssertEqual(
            NearbyFilter.displayGenre(for: spot, selectedGenre: .park),
            .restaurant
        )
    }

    func testDeduplicationAndCoordinateSpreadMatchTypeScript() throws {
        let fixture = try loadFixture()

        for testCase in fixture.coordinates {
            let deduplicated = NearbyGeometry.deduplicate(testCase.spots)
            XCTAssertEqual(
                deduplicated.map(\.placeID),
                testCase.expectedDeduplicatedPlaceIDs,
                testCase.id
            )

            let actual = NearbyGeometry.spreadOverlapping(deduplicated)
            XCTAssertEqual(actual.count, testCase.expectedSpread.count)
            for expected in testCase.expectedSpread {
                let item = try XCTUnwrap(
                    actual.first { $0.spot.placeID == expected.placeID },
                    "\(testCase.id): \(expected.placeID)"
                )
                XCTAssertEqual(
                    item.displayCoordinate.latitude,
                    expected.displayLatitude,
                    accuracy: 0.000_000_000_1,
                    "\(testCase.id): latitude"
                )
                XCTAssertEqual(
                    item.displayCoordinate.longitude,
                    expected.displayLongitude,
                    accuracy: 0.000_000_000_1,
                    "\(testCase.id): longitude"
                )
            }
        }
    }

    func testDistancesMatchTypeScript() throws {
        let fixture = try loadFixture()

        for testCase in fixture.distances {
            XCTAssertEqual(
                NearbyGeometry.distanceMeters(
                    from: testCase.origin.nearbyCoordinate,
                    to: testCase.point.nearbyCoordinate
                ),
                testCase.expectedMeters,
                accuracy: 0.000_001,
                testCase.id
            )
        }
    }

    func testWalkAlertJudgmentMatchesTypeScript() throws {
        let fixture = try loadFixture()

        for testCase in fixture.weather.alerts {
            let actual = WeatherJudgment.walkAlert(
                temperatureCelsius: testCase.temperatureCelsius,
                humidityPercent: testCase.humidityPercent,
                feelsLikeCelsius: testCase.feelsLikeCelsius,
                heatSensitivity: testCase.heatSensitivity,
                ageMonths: testCase.ageMonths
            )
            XCTAssertEqual(actual.level, testCase.expected, testCase.id)
        }
    }

    private func loadFixture() throws -> NearbyDomainFixture {
        let url = try XCTUnwrap(
            Bundle.module.url(
                forResource: "nearby-domain",
                withExtension: "json"
            )
        )
        return try JSONDecoder().decode(
            NearbyDomainFixture.self,
            from: Data(contentsOf: url)
        )
    }

    private func parseDate(_ value: String) throws -> Date {
        try XCTUnwrap(ISO8601DateFormatter().date(from: value), value)
    }
}

private struct NearbyDomainFixture: Decodable {
    let ranking: [RankingCase]
    let conditions: [ConditionCase]
    let genres: [GenreCase]
    let coordinates: [CoordinateCase]
    let distances: [DistanceCase]
    let weather: WeatherCases
}

private struct FixtureCoordinate: Decodable {
    let latitude: Double
    let longitude: Double

    var nearbyCoordinate: NearbyCoordinate {
        NearbyCoordinate(latitude: latitude, longitude: longitude)
    }

    private enum CodingKeys: String, CodingKey {
        case latitude = "lat"
        case longitude = "lng"
    }
}

private struct RankingCase: Decodable {
    struct Expected: Decodable {
        let placeIDs: [String]
        let scores: [String: Double]

        private enum CodingKeys: String, CodingKey {
            case placeIDs = "placeIds"
            case scores
        }
    }

    let id: String
    let spots: [PlaceResult]
    let origin: FixtureCoordinate?
    let situation: NearbyWalkSituation?
    let now: String
    let expected: Expected
}

private struct ConditionCase: Decodable {
    let id: String
    let spots: [PlaceResult]
    let conditions: NearbyConditionFilter
    let likedPlaceIDs: [String]
    let genre: NearbyGenre?
    let expected: [String]

    private enum CodingKeys: String, CodingKey {
        case id
        case spots
        case conditions
        case likedPlaceIDs = "likedPlaceIds"
        case genre
        case expected
    }
}

private struct GenreCase: Decodable {
    let id: String
    let genre: NearbyGenre
    let spots: [PlaceResult]
    let expected: [String]
}

private struct CoordinateCase: Decodable {
    let id: String
    let spots: [PlaceResult]
    let expectedDeduplicatedPlaceIDs: [String]
    let expectedSpread: [SpreadExpectation]

    private enum CodingKeys: String, CodingKey {
        case id
        case spots
        case expectedDeduplicatedPlaceIDs = "expectedDeduplicatedPlaceIds"
        case expectedSpread
    }
}

private struct SpreadExpectation: Decodable {
    let placeID: String
    let displayLatitude: Double
    let displayLongitude: Double

    private enum CodingKeys: String, CodingKey {
        case placeID = "placeId"
        case displayLatitude = "displayLat"
        case displayLongitude = "displayLng"
    }
}

private struct DistanceCase: Decodable {
    let id: String
    let origin: FixtureCoordinate
    let point: FixtureCoordinate
    let expectedMeters: Double
}

private struct WeatherCases: Decodable {
    let alerts: [WeatherAlertCase]
}

private struct WeatherAlertCase: Decodable {
    let id: String
    let temperatureCelsius: Double
    let humidityPercent: Double?
    let feelsLikeCelsius: Double?
    let heatSensitivity: Int?
    let ageMonths: Int?
    let expected: WalkAlertLevel

    private enum CodingKeys: String, CodingKey {
        case id
        case temperatureCelsius = "tempC"
        case humidityPercent = "humidityPct"
        case feelsLikeCelsius = "feelsLikeC"
        case heatSensitivity
        case ageMonths
        case expected
    }
}
