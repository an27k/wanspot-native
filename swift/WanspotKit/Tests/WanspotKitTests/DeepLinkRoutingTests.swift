import Foundation
import XCTest

@testable import WanspotKit

final class DeepLinkRoutingTests: XCTestCase {
    func testHTTPSRoutesMapOnlyTrustedWanspotHosts() throws {
        XCTAssertEqual(
            destination("https://www.wanspot.app/spots/spot-1?ref=share"),
            .spot(id: "spot-1")
        )
        XCTAssertEqual(
            destination("https://wanspot.app/articles/tokyo%20cafe"),
            .article(slug: "tokyo cafe")
        )
        XCTAssertEqual(
            destination("https://www.wanspot.app/events/dog-festival"),
            .calendar(slug: "dog-festival")
        )
        XCTAssertNil(
            destination("https://wanspot.app.example.com/spots/spot-1")
        )
        XCTAssertNil(
            destination("https://example.com/articles/tokyo-cafe")
        )
    }

    func testCustomSchemeSupportsHostAndPathForms() throws {
        XCTAssertEqual(
            destination("wanspot://spots/place_abc%20123"),
            .spot(id: "place_abc 123")
        )
        XCTAssertEqual(
            destination("wanspot:/articles/tokyo-cafe"),
            .article(slug: "tokyo-cafe")
        )
        XCTAssertEqual(
            destination("wanspot://calendar/dog-festival"),
            .calendar(slug: "dog-festival")
        )
        XCTAssertEqual(
            destination("wanspot://mypage/walk-forecast"),
            .walkForecast
        )
        XCTAssertEqual(
            destination("wanspot://settings/notifications"),
            .notificationSettings
        )
    }

    func testMalformedOrAmbiguousRoutesAreRejected() throws {
        XCTAssertNil(destination("https://wanspot.app/spots"))
        XCTAssertNil(destination("https://wanspot.app/spots/one/extra"))
        XCTAssertNil(destination("wanspot://spots/one/extra"))
        XCTAssertNil(destination("wanspot://settings/notifications/extra"))
        XCTAssertNil(destination("wanspot://unknown/value"))
        XCTAssertNil(destination("ftp://wanspot.app/spots/spot-1"))
        XCTAssertNil(destination("wanspot://spots/%2Fprivate"))
        XCTAssertNil(destination("wanspot://spots/%5Cprivate"))
    }

    private func destination(
        _ value: String
    ) -> WanspotDeepLinkDestination? {
        guard let url = URL(string: value) else {
            XCTFail("Invalid test URL: \(value)")
            return nil
        }
        return WanspotDeepLink.destination(for: url)
    }
}
