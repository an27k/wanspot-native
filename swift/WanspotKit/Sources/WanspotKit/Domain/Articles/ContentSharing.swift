import Foundation

public struct ContentShareContent: Equatable, Sendable {
    public let text: String
    public let url: URL?

    public init(text: String, url: URL?) {
        self.text = text
        self.url = url
    }
}

public enum ContentSharing {
    public static func article(
        _ article: ArticleDetail,
        siteURL: URL
    ) -> ContentShareContent {
        ContentShareContent(
            text:
                "\(article.title)｜ワンちゃんと行けるスポットまとめ🐾 #wanspot",
            url: publicURL(
                siteURL: siteURL,
                pathComponents: ["articles", article.slug]
            )
        )
    }

    public static func calendarEvent(
        _ event: CalendarEvent,
        siteURL: URL
    ) -> ContentShareContent {
        let detail = [
            event.occurrences.first.map(CalendarRules.occurrenceLabel),
            event.venueName?.trimmingCharacters(in: .whitespacesAndNewlines),
        ].compactMap { value -> String? in
            guard let value, !value.isEmpty else { return nil }
            return value
        }.joined(separator: " / ")
        let text = detail.isEmpty
            ? event.title
            : "\(event.title)（\(detail)）"
        return ContentShareContent(
            text: text,
            url: publicURL(
                siteURL: siteURL,
                pathComponents: ["events", event.slug],
                queryItems: [
                    URLQueryItem(name: "ref", value: "share"),
                    URLQueryItem(
                        name: "ref_from",
                        value: "app_event_detail"
                    ),
                ]
            )
        )
    }

    public static func publicURL(
        siteURL: URL,
        pathComponents: [String],
        queryItems: [URLQueryItem] = []
    ) -> URL? {
        guard var components = URLComponents(
            url: siteURL,
            resolvingAgainstBaseURL: false
        ) else {
            return nil
        }
        var base = components.path
        if base.hasSuffix("/") {
            base.removeLast()
        }
        for component in pathComponents {
            let value = component.trimmingCharacters(
                in: .whitespacesAndNewlines
            )
            guard !value.isEmpty else { return nil }
            base += "/\(value)"
        }
        components.path = base
        components.queryItems = queryItems.isEmpty ? nil : queryItems
        components.fragment = nil
        return components.url
    }
}

public enum ContentImageURL {
    public enum Size: Int, Sendable {
        case thumbnail = 240
        case card = 800
        case hero = 1_600
        case full = 2_400
    }

    public static func resized(_ url: URL?, to size: Size) -> URL? {
        guard let url else { return nil }
        let value = url.absoluteString

        if value.contains("maps.googleapis.com/maps/api/place/photo") {
            return replacingQueryItem(url, name: "maxwidth", value: size.rawValue)
        }
        if value.contains("/api/spots/photo") {
            return replacingQueryItem(url, name: "w", value: size.rawValue)
        }
        if
            url.scheme?.lowercased() == "https",
            url.host?.hasSuffix(".supabase.co") == true,
            url.path.contains("/storage/v1/object/public/")
        {
            guard var components = URLComponents(
                url: url,
                resolvingAgainstBaseURL: false
            ) else {
                return url
            }
            components.path = components.path.replacingOccurrences(
                of: "/storage/v1/object/public/",
                with: "/storage/v1/render/image/public/"
            )
            var items = components.queryItems ?? []
            items.removeAll { $0.name == "width" || $0.name == "quality" }
            items.append(URLQueryItem(name: "width", value: String(size.rawValue)))
            items.append(URLQueryItem(name: "quality", value: "75"))
            components.queryItems = items
            return components.url ?? url
        }
        return url
    }

    private static func replacingQueryItem(
        _ url: URL,
        name: String,
        value: Int
    ) -> URL? {
        guard var components = URLComponents(
            url: url,
            resolvingAgainstBaseURL: false
        ) else {
            return url
        }
        var items = components.queryItems ?? []
        if let index = items.firstIndex(where: { $0.name == name }) {
            items[index] = URLQueryItem(name: name, value: String(value))
        } else {
            items.append(URLQueryItem(name: name, value: String(value)))
        }
        components.queryItems = items
        return components.url ?? url
    }
}
