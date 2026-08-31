import XCTest

@testable import WanspotKit

final class OnboardingServiceTests: XCTestCase {
    func testLookupFailureProtectsExistingUsersFromOnboarding() async {
        enum LookupFailure: Error {
            case unavailable
        }
        let service = OnboardingService(
            hasDog: { _ in throw LookupFailure.unavailable },
            upsertOwner: { _ in },
            insertDog: { _ in }
        )

        let destination = await service.destinationAfterAuthentication(
            userID: "user-1"
        )

        XCTAssertEqual(destination, .main)
    }

    func testCompleteBuildsOwnerAndDogRows() async throws {
        let writes = OnboardingWrites()
        let service = OnboardingService(
            hasDog: { _ in false },
            upsertOwner: { await writes.setOwner($0) },
            insertDog: { await writes.setDog($0) }
        )
        let draft = OnboardingDogDraft(
            name: " モカ ",
            breed: "トイプードル",
            size: .small,
            birthday: "2023-08-19",
            photoURL: URL(string: "https://example.com/dog.jpg"),
            mixedVaccine: true,
            rabiesVaccine: false,
            mixedVaccineDate: "2026-04-01",
            rabiesVaccineDate: "2026-05-01"
        )

        let result = try await service.complete(
            userID: "user-1",
            email: "owner@example.com",
            draft: draft,
            walkAreaTags: [" 世田谷区 ", "世田谷区", "渋谷区"]
        )
        let owner = await writes.owner
        let dog = await writes.dog

        XCTAssertEqual(result, .created)
        XCTAssertEqual(owner?.name, "owner")
        XCTAssertEqual(owner?.walkAreaTags, ["世田谷区", "渋谷区"])
        XCTAssertEqual(dog?.name, "モカ")
        XCTAssertEqual(dog?.size, .small)
        XCTAssertTrue(dog?.vaccineVaccinated == true)
        XCTAssertFalse(dog?.rabiesVaccinated == true)
        XCTAssertNil(dog?.rabiesVaccinatedAt)
    }

    func testExistingDogSkipsAllWrites() async throws {
        let writes = OnboardingWrites()
        let service = OnboardingService(
            hasDog: { _ in true },
            upsertOwner: { await writes.setOwner($0) },
            insertDog: { await writes.setDog($0) }
        )

        let result = try await service.complete(
            userID: "user-1",
            email: nil,
            draft: OnboardingDogDraft(),
            walkAreaTags: []
        )
        let owner = await writes.owner
        let dog = await writes.dog

        XCTAssertEqual(result, .existingProfile)
        XCTAssertNil(owner)
        XCTAssertNil(dog)
    }
}

private actor OnboardingWrites {
    private(set) var owner: OwnerProfileInput?
    private(set) var dog: DogProfileInput?

    func setOwner(_ owner: OwnerProfileInput) {
        self.owner = owner
    }

    func setDog(_ dog: DogProfileInput) {
        self.dog = dog
    }
}
