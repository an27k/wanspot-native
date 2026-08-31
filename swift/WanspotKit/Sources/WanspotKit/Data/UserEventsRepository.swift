import Supabase

public struct SupabaseUserEventsRepository: Sendable {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func record(_ event: UserEvent) async throws {
        try await client
            .from("user_events")
            .insert(event)
            .execute()
    }
}
