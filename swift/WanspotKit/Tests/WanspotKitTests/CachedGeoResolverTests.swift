import XCTest

@testable import WanspotKit

final class CachedGeoResolverTests: XCTestCase {
    func testPrefectureUsesRoundedCoordinateCacheKey() async {
        let calls = GeoCallCounter()
        let resolver = CachedGeoResolver { _, _ in
            await calls.increment()
            return ReverseGeocodeResult(
                region: "東京都",
                subregion: nil,
                city: "千代田区",
                district: nil
            )
        }

        let first = await resolver.prefecture(
            latitude: 35.6812,
            longitude: 139.7671
        )
        let second = await resolver.prefecture(
            latitude: 35.6814,
            longitude: 139.7674
        )
        let invocationCount = await calls.value

        XCTAssertEqual(first, "東京都")
        XCTAssertEqual(second, "東京都")
        XCTAssertEqual(invocationCount, 1)
    }

    func testFallbacksMatchReactNativeBehavior() async {
        enum Failure: Error {
            case unavailable
        }
        let resolver = CachedGeoResolver { _, _ in
            throw Failure.unavailable
        }

        let prefecture = await resolver.prefecture(
            latitude: 0,
            longitude: 0
        )
        let pair = await resolver.prefectureAndMunicipality(
            latitude: 0,
            longitude: 0
        )

        XCTAssertEqual(prefecture, "東京")
        XCTAssertNil(pair.prefecture)
        XCTAssertNil(pair.municipality)
    }
}

private actor GeoCallCounter {
    private(set) var value = 0

    func increment() {
        value += 1
    }
}
