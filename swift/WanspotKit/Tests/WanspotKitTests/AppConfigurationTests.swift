import XCTest

@testable import WanspotKit

final class AppConfigurationTests: XCTestCase {
    func testResolvesExpoCompatibleEnvironmentAndProductionDefaults() throws {
        let configuration = try AppConfiguration.resolve(
            environment: [
                "EXPO_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
                "EXPO_PUBLIC_SUPABASE_ANON_KEY": "publishable-key",
            ]
        )

        XCTAssertEqual(
            configuration.supabaseURL.absoluteString,
            "https://example.supabase.co"
        )
        XCTAssertEqual(configuration.supabaseKey, "publishable-key")
        XCTAssertEqual(
            configuration.wanspotAPIURL.absoluteString,
            "https://www.wanspot.app"
        )
        XCTAssertEqual(
            configuration.wanspotSiteURL.absoluteString,
            "https://www.wanspot.app"
        )
        XCTAssertFalse(configuration.adsEnabled)
    }

    func testEnvironmentOverridesInfoPlistAndParsesAdsFlag() throws {
        let configuration = try AppConfiguration.resolve(
            environment: [
                "SUPABASE_URL": "https://environment.supabase.co",
                "SUPABASE_PUBLISHABLE_KEY": "environment-key",
                "EXPO_PUBLIC_ADS_ENABLED": "1",
            ],
            infoDictionary: [
                "WANSPOT_SUPABASE_URL": "https://plist.supabase.co",
                "WANSPOT_SUPABASE_KEY": "plist-key",
                "WANSPOT_ADS_ENABLED": "false",
            ]
        )

        XCTAssertEqual(
            configuration.supabaseURL.absoluteString,
            "https://environment.supabase.co"
        )
        XCTAssertEqual(configuration.supabaseKey, "environment-key")
        XCTAssertTrue(configuration.adsEnabled)
    }

    func testUnexpandedBuildVariablesAreTreatedAsMissing() {
        XCTAssertThrowsError(
            try AppConfiguration.resolve(
                environment: [:],
                infoDictionary: [
                    "WANSPOT_SUPABASE_URL": "$(WANSPOT_SUPABASE_URL)",
                    "WANSPOT_SUPABASE_KEY": "$(WANSPOT_SUPABASE_KEY)",
                ]
            )
        ) { error in
            XCTAssertEqual(
                error as? AppConfigurationError,
                .missingValue("Supabase URL")
            )
        }
    }
}
