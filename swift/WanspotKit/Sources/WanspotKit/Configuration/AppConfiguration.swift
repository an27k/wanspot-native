import Foundation

public enum AppConfigurationError: Error, Equatable, LocalizedError, Sendable {
    case missingValue(String)
    case invalidURL(name: String, value: String)

    public var errorDescription: String? {
        switch self {
        case let .missingValue(name):
            "\(name) が設定されていません。"
        case let .invalidURL(name, value):
            "\(name) が有効な HTTP(S) URL ではありません: \(value)"
        }
    }
}

public struct AppConfiguration: Equatable, Sendable {
    public let supabaseURL: URL
    public let supabaseKey: String
    public let wanspotAPIURL: URL
    public let wanspotSiteURL: URL
    public let amplitudeAPIKey: String?
    public let googleMapsAPIKey: String?
    public let googleWebClientID: String?
    public let adsEnabled: Bool
    public let admobAppID: String?
    public let admobNativeAdUnitID: String?
    public let admobVideoNativeAdUnitID: String?

    public static func load(
        bundle: Bundle = .main,
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) throws -> Self {
        try resolve(
            environment: environment,
            infoDictionary: bundle.infoDictionary ?? [:]
        )
    }

    public static func resolve(
        environment: [String: String],
        infoDictionary: [String: Any] = [:]
    ) throws -> Self {
        let supabaseURLText = firstNonEmpty(
            environment["EXPO_PUBLIC_SUPABASE_URL"],
            environment["NEXT_PUBLIC_SUPABASE_URL"],
            environment["SUPABASE_URL"],
            infoDictionary["WANSPOT_SUPABASE_URL"] as? String
        )
        guard let supabaseURLText else {
            throw AppConfigurationError.missingValue("Supabase URL")
        }

        let supabaseKey = firstNonEmpty(
            environment["EXPO_PUBLIC_SUPABASE_ANON_KEY"],
            environment["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
            environment["SUPABASE_ANON_KEY"],
            environment["SUPABASE_PUBLISHABLE_KEY"],
            infoDictionary["WANSPOT_SUPABASE_KEY"] as? String
        )
        guard let supabaseKey else {
            throw AppConfigurationError.missingValue("Supabase publishable key")
        }

        let productionOrigin = "https://www.wanspot.app"
        let apiURLText = firstNonEmpty(
            environment["EXPO_PUBLIC_WANSPOT_API_URL"],
            environment["NEXT_PUBLIC_APP_URL"],
            environment["NEXT_PUBLIC_WANSPOT_API_URL"],
            environment["WANSPOT_API_URL"],
            infoDictionary["WANSPOT_API_URL"] as? String,
            productionOrigin
        )!
        let siteURLText = firstNonEmpty(
            environment["EXPO_PUBLIC_WANSPOT_SITE_URL"],
            environment["NEXT_PUBLIC_APP_URL"],
            environment["WANSPOT_SITE_URL"],
            infoDictionary["WANSPOT_SITE_URL"] as? String,
            productionOrigin
        )!

        return Self(
            supabaseURL: try httpURL(supabaseURLText, name: "Supabase URL"),
            supabaseKey: supabaseKey,
            wanspotAPIURL: try httpURL(apiURLText, name: "Wanspot API URL"),
            wanspotSiteURL: try httpURL(siteURLText, name: "Wanspot site URL"),
            amplitudeAPIKey: firstNonEmpty(
                environment["EXPO_PUBLIC_AMPLITUDE_API_KEY"],
                environment["AMPLITUDE_API_KEY"],
                infoDictionary["WANSPOT_AMPLITUDE_API_KEY"] as? String
            ),
            googleMapsAPIKey: firstNonEmpty(
                environment["EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"],
                environment["GOOGLE_MAPS_API_KEY"],
                infoDictionary["WANSPOT_GOOGLE_MAPS_API_KEY"] as? String
            ),
            googleWebClientID: firstNonEmpty(
                environment["EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"],
                environment["GOOGLE_WEB_CLIENT_ID"],
                infoDictionary["WANSPOT_GOOGLE_WEB_CLIENT_ID"] as? String
            ),
            adsEnabled: boolValue(
                firstNonEmpty(
                    environment["EXPO_PUBLIC_ADS_ENABLED"],
                    environment["WANSPOT_ADS_ENABLED"],
                    infoDictionary["WANSPOT_ADS_ENABLED"] as? String
                )
            ),
            admobAppID: firstNonEmpty(
                environment["EXPO_PUBLIC_ADMOB_IOS_APP_ID"],
                environment["ADMOB_IOS_APP_ID"],
                infoDictionary["WANSPOT_ADMOB_APP_ID"] as? String
            ),
            admobNativeAdUnitID: firstNonEmpty(
                environment["EXPO_PUBLIC_ADMOB_IOS_NATIVE_AD_UNIT_ID"],
                environment["ADMOB_IOS_NATIVE_AD_UNIT_ID"],
                infoDictionary["WANSPOT_ADMOB_NATIVE_AD_UNIT_ID"] as? String
            ),
            admobVideoNativeAdUnitID: firstNonEmpty(
                environment["EXPO_PUBLIC_ADMOB_IOS_VIDEO_NATIVE_AD_UNIT_ID"],
                environment["ADMOB_IOS_VIDEO_NATIVE_AD_UNIT_ID"],
                infoDictionary["WANSPOT_ADMOB_VIDEO_NATIVE_AD_UNIT_ID"] as? String
            )
        )
    }

    private init(
        supabaseURL: URL,
        supabaseKey: String,
        wanspotAPIURL: URL,
        wanspotSiteURL: URL,
        amplitudeAPIKey: String?,
        googleMapsAPIKey: String?,
        googleWebClientID: String?,
        adsEnabled: Bool,
        admobAppID: String?,
        admobNativeAdUnitID: String?,
        admobVideoNativeAdUnitID: String?
    ) {
        self.supabaseURL = supabaseURL
        self.supabaseKey = supabaseKey
        self.wanspotAPIURL = wanspotAPIURL
        self.wanspotSiteURL = wanspotSiteURL
        self.amplitudeAPIKey = amplitudeAPIKey
        self.googleMapsAPIKey = googleMapsAPIKey
        self.googleWebClientID = googleWebClientID
        self.adsEnabled = adsEnabled
        self.admobAppID = admobAppID
        self.admobNativeAdUnitID = admobNativeAdUnitID
        self.admobVideoNativeAdUnitID = admobVideoNativeAdUnitID
    }
}

private func firstNonEmpty(_ candidates: String?...) -> String? {
    candidates.lazy.compactMap { candidate in
        guard let candidate else { return nil }
        let value = candidate.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, !value.hasPrefix("$(") else { return nil }
        return value
    }.first
}

private func httpURL(_ value: String, name: String) throws -> URL {
    guard
        let url = URL(string: value),
        let scheme = url.scheme?.lowercased(),
        scheme == "https" || scheme == "http",
        url.host != nil
    else {
        throw AppConfigurationError.invalidURL(name: name, value: value)
    }
    return url
}

private func boolValue(_ value: String?) -> Bool {
    guard let value else { return false }
    return value == "1" || value.lowercased() == "true"
}
