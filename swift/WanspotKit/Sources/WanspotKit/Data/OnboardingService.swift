import Foundation

public enum AuthenticatedDestination: Equatable, Sendable {
    case onboarding
    case main
}

public enum OnboardingCompletion: Equatable, Sendable {
    case created
    case existingProfile
}

public struct OnboardingService: Sendable {
    public typealias HasDog =
        @Sendable (_ userID: String) async throws -> Bool
    public typealias UpsertOwner =
        @Sendable (_ input: OwnerProfileInput) async throws -> Void
    public typealias InsertDog =
        @Sendable (_ input: DogProfileInput) async throws -> Void

    private let hasDog: HasDog
    private let upsertOwner: UpsertOwner
    private let insertDog: InsertDog

    public init(profileRepository: SupabaseProfileRepository) {
        hasDog = { userID in
            try await profileRepository.fetchPrimaryDog(userID: userID) != nil
        }
        upsertOwner = { input in
            try await profileRepository.upsertOwner(input)
        }
        insertDog = { input in
            try await profileRepository.insertDog(input)
        }
    }

    public init(
        hasDog: @escaping HasDog,
        upsertOwner: @escaping UpsertOwner,
        insertDog: @escaping InsertDog
    ) {
        self.hasDog = hasDog
        self.upsertOwner = upsertOwner
        self.insertDog = insertDog
    }

    public func destinationAfterAuthentication(
        userID: String
    ) async -> AuthenticatedDestination {
        switch await dogLookupOutcome(userID: userID) {
        case .missing:
            return .onboarding
        case .notRequested, .exists, .failed:
            return .main
        }
    }

    public func dogLookupOutcome(
        userID: String
    ) async -> DogLookupOutcome {
        do {
            return try await hasDog(userID) ? .exists : .missing
        } catch {
            return .failed
        }
    }

    public func complete(
        userID: String,
        email: String?,
        draft: OnboardingDogDraft,
        walkAreaTags: [String]
    ) async throws -> OnboardingCompletion {
        if try await hasDog(userID) {
            return .existingProfile
        }

        let tags = OnboardingCatalog.normalizeWalkAreaTags(walkAreaTags)
        let dogName = draft.name
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let emailPrefix =
            email?.split(separator: "@", maxSplits: 1).first.map(String.init)
            ?? ""
        let ownerName = emailPrefix
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedOwnerName = ownerName.isEmpty ? "ユーザー" : ownerName

        try await upsertOwner(
            OwnerProfileInput(
                id: userID,
                name: resolvedOwnerName,
                parentType: "papa",
                birthday: nil,
                bio: OnboardingDomain.defaultBio(
                    dogName: dogName,
                    breed: draft.breed
                ),
                walkAreaTags: tags
            )
        )
        try await insertDog(
            DogProfileInput(
                userID: userID,
                name: dogName,
                breed: draft.breed.isEmpty ? nil : draft.breed,
                birthday: draft.birthday,
                gender: nil,
                size: draft.size,
                photoURL: draft.photoURL,
                rabiesVaccinated: draft.rabiesVaccine == true,
                vaccineVaccinated: draft.mixedVaccine == true,
                rabiesVaccinatedAt: draft.rabiesVaccine == true
                    ? draft.rabiesVaccineDate
                    : nil,
                vaccineVaccinatedAt: draft.mixedVaccine == true
                    ? draft.mixedVaccineDate
                    : nil,
                walkAreaTags: tags
            )
        )
        return .created
    }
}
