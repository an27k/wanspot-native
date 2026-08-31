import Foundation
import Supabase

public enum SupabaseClientFactory {
    public static let oauthRedirectURL =
        URL(string: "wanspot://auth/callback")!

    public static func make(configuration: AppConfiguration) -> SupabaseClient {
        SupabaseClient(
            supabaseURL: configuration.supabaseURL,
            supabaseKey: configuration.supabaseKey,
            options: SupabaseClientOptions(
                auth: .init(
                    redirectToURL: oauthRedirectURL,
                    flowType: .pkce
                )
            )
        )
    }

    public static func makeWanspotAPIClient(
        configuration: AppConfiguration,
        supabaseClient: SupabaseClient,
        transport: any HTTPTransport = URLSessionHTTPTransport()
    ) -> WanspotAPIClient {
        WanspotAPIClient(
            configuration: configuration,
            transport: transport,
            accessTokenProvider: {
                try? await supabaseClient.auth.session.accessToken
            }
        )
    }
}
