import Foundation

public struct SpotShareContent: Equatable, Sendable {
    public let text: String
    public let url: URL?

    public init(text: String, url: URL?) {
        self.text = text
        self.url = url
    }
}

public enum SpotSharing {
    public static func text(
        name: String,
        highlights: [String]
    ) -> String {
        let name = nonEmpty(name) ?? "スポット"
        var seen = Set<String>()
        let highlights = highlights.compactMap { highlight -> String? in
            guard
                let value = nonEmpty(highlight),
                seen.insert(value).inserted,
                seen.count <= 3
            else {
                return nil
            }
            return value
        }
        if !highlights.isEmpty {
            return "\(name)｜\(highlights.joined(separator: "・")) #wanspot"
        }
        return "\(name)｜ワンちゃんと行けるスポット見つけた🐾 #wanspot"
    }

    public static func publicURL(
        siteURL: URL,
        spotID: String?
    ) -> URL? {
        guard let spotID = nonEmpty(spotID), SpotIdentifier.isUUID(spotID) else {
            return nil
        }
        guard var components = URLComponents(
            url: siteURL,
            resolvingAgainstBaseURL: false
        ) else {
            return nil
        }
        let basePath = components.path.hasSuffix("/")
            ? String(components.path.dropLast())
            : components.path
        components.path = "\(basePath)/spots/\(spotID.lowercased())"
        components.query = nil
        components.fragment = nil
        return components.url
    }

    public static func googleMapsURL(
        name: String,
        placeID: String?,
        latitude: Double? = nil,
        longitude: Double? = nil
    ) -> URL? {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "www.google.com"
        components.path = "/maps/search/"

        var queryItems = [
            URLQueryItem(name: "api", value: "1"),
        ]
        if let placeID = nonEmpty(placeID) {
            queryItems.append(
                URLQueryItem(name: "query", value: nonEmpty(name) ?? placeID)
            )
            queryItems.append(
                URLQueryItem(name: "query_place_id", value: placeID)
            )
        } else if
            let latitude,
            let longitude,
            latitude.isFinite,
            longitude.isFinite
        {
            queryItems.append(
                URLQueryItem(
                    name: "query",
                    value: "\(latitude),\(longitude)"
                )
            )
        } else if let name = nonEmpty(name) {
            queryItems.append(URLQueryItem(name: "query", value: name))
        } else {
            return nil
        }
        components.queryItems = queryItems
        return components.url
    }

    public static func instagramURL(
        instagramID: String?,
        spotName: String
    ) -> URL? {
        if var value = nonEmpty(instagramID) {
            if
                let url = URL(string: value),
                url.scheme?.lowercased() == "https",
                let host = url.host?.lowercased(),
                host == "instagram.com" || host.hasSuffix(".instagram.com")
            {
                return url
            }

            value = value.trimmingCharacters(in: CharacterSet(charactersIn: "@/"))
            if !value.isEmpty, !value.contains("/") {
                var components = URLComponents()
                components.scheme = "https"
                components.host = "www.instagram.com"
                components.path = "/\(value)/"
                if let url = components.url {
                    return url
                }
            }
        }

        guard let spotName = nonEmpty(spotName) else { return nil }
        var components = URLComponents()
        components.scheme = "https"
        components.host = "www.google.com"
        components.path = "/search"
        components.queryItems = [
            URLQueryItem(name: "q", value: "\(spotName) Instagram"),
        ]
        return components.url
    }

    public static func content(
        for detail: SpotDetail,
        siteURL: URL
    ) -> SpotShareContent {
        SpotShareContent(
            text: text(
                name: detail.name,
                highlights: detail.dogFactHighlights
            ),
            url:
                publicURL(siteURL: siteURL, spotID: detail.spotID)
                    ?? detail.googleMapsURL
                    ?? googleMapsURL(
                        name: detail.name,
                        placeID: detail.placeID,
                        latitude: detail.latitude,
                        longitude: detail.longitude
                    )
        )
    }

    public static func routeID(from url: URL) -> String? {
        guard case let .spot(id) = WanspotDeepLink.destination(for: url) else {
            return nil
        }
        return id
    }

    private static func nonEmpty(_ value: String?) -> String? {
        let value = value?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return value.isEmpty ? nil : value
    }
}
