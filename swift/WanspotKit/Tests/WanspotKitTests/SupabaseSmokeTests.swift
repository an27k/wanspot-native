import XCTest

@testable import WanspotKit

final class SupabaseSmokeTests: XCTestCase {
    func testReadsAuthenticatedUserRow() async throws {
        let environment = ProcessInfo.processInfo.environment
        guard
            let email = nonEmpty(environment["WANSPOT_SUPABASE_TEST_EMAIL"]),
            let password = nonEmpty(environment["WANSPOT_SUPABASE_TEST_PASSWORD"]),
            nonEmpty(environment["SUPABASE_URL"]) != nil,
            (
                nonEmpty(environment["SUPABASE_PUBLISHABLE_KEY"])
                    ?? nonEmpty(environment["SUPABASE_ANON_KEY"])
            ) != nil
        else {
            throw XCTSkip(
                "Supabase smoke credentials are not configured. "
                    + "Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, "
                    + "WANSPOT_SUPABASE_TEST_EMAIL, and WANSPOT_SUPABASE_TEST_PASSWORD."
            )
        }

        let configuration = try AppConfiguration.resolve(environment: environment)
        let client = SupabaseClientFactory.make(configuration: configuration)

        do {
            try await client.auth.signIn(email: email, password: password)
            let userID = try await client.auth.session.user.id.uuidString.lowercased()
            let profile = try await SupabaseProfileRepository(client: client)
                .fetchUserProfile(userID: userID)
            XCTAssertEqual(
                profile?.id.lowercased(),
                userID,
                "users RLS should expose the signed-in user's row"
            )

            _ = try await SupabaseProfileRepository(client: client)
                .fetchPrimaryDog(userID: userID)
            _ = try await SupabaseVisitsRepository(client: client)
                .fetchVisits(userID: userID)
            _ = try await SupabaseSpotActivityRepository(client: client)
                .fetchLikes(userID: userID)
            _ = try await SupabaseSpotActivityRepository(client: client)
                .fetchCheckIns(userID: userID)
            _ = try await SupabaseDogPhotosRepository(client: client)
                .fetchAlbumPhotos(userID: userID)
            try await client.auth.signOut()
        } catch {
            try? await client.auth.signOut()
            throw error
        }
    }
}

private func nonEmpty(_ value: String?) -> String? {
    guard let value else { return nil }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
}
