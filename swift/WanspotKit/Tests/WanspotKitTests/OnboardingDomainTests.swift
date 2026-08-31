import XCTest

@testable import WanspotKit

final class OnboardingDomainTests: XCTestCase {
    func testGeneratedCatalogAndBreedSearchMatchTypeScript() {
        XCTAssertEqual(OnboardingCatalog.dogBreeds.count, 112)
        XCTAssertEqual(OnboardingCatalog.dogBreedQuickPicks.count, 12)
        XCTAssertTrue(OnboardingCatalog.walkAreas.count > 200)
        XCTAssertEqual(
            OnboardingCatalog.filterDogBreeds("しば"),
            ["柴犬"]
        )
        XCTAssertEqual(
            OnboardingCatalog.filterDogBreeds("ﾁﾜﾜ"),
            ["チワワ"]
        )
        XCTAssertTrue(
            OnboardingCatalog.filterDogBreeds("雑種").contains("ミックス犬")
        )
    }

    func testWalkAreaSearchSuggestionAndNormalization() {
        XCTAssertTrue(
            OnboardingCatalog.searchWalkAreas("横浜").allSatisfy {
                $0.label.contains("横浜")
            }
        )
        let nearby = OnboardingCatalog.suggestedWalkAreas(
            latitude: 35.694,
            longitude: 139.754,
            radiusMeters: 1_000,
            limit: 3
        )
        XCTAssertEqual(nearby.first?.label, "千代田区")
        XCTAssertEqual(
            OnboardingCatalog.normalizeWalkAreaTags([
                " 世田谷区 ",
                "世田谷区",
                "",
                "渋谷区",
            ]),
            ["世田谷区", "渋谷区"]
        )
    }

    func testOnboardingCopyHelpers() {
        XCTAssertEqual(
            OnboardingDomain.defaultBio(
                dogName: "モカ",
                breed: "トイプードル"
            ),
            "モカ（トイプードル）と一緒に新しいスポットを探しています！"
        )
        XCTAssertEqual(OnboardingDomain.dogLabel(nil), "うちの子")
        XCTAssertEqual(OnboardingDomain.dogLabel(" モカ "), "モカちゃん")
    }
}
