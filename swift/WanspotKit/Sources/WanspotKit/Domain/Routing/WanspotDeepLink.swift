import Foundation

public enum WanspotDeepLinkDestination: Equatable, Sendable {
    case spot(id: String)
    case article(slug: String)
    case calendar(slug: String)
    case walkForecast
    case notificationSettings
}

public enum WanspotDeepLink {
    public static func destination(
        for url: URL
    ) -> WanspotDeepLinkDestination? {
        let scheme = url.scheme?.lowercased()
        let path = url.pathComponents.filter { $0 != "/" }

        if scheme == "http" || scheme == "https" {
            guard
                isWanspotHost(url.host),
                path.count == 2,
                let value = routeComponent(path[1])
            else {
                return nil
            }
            return destination(kind: path[0], value: value)
        }

        guard scheme == "wanspot" else { return nil }
        let host = url.host?.lowercased()

        if host == "mypage", path == ["walk-forecast"] {
            return .walkForecast
        }
        if host == "settings", path == ["notifications"] {
            return .notificationSettings
        }
        if
            let host,
            path.count == 1,
            let value = routeComponent(path[0])
        {
            return destination(kind: host, value: value)
        }
        guard
            host == nil,
            path.count == 2,
            let value = routeComponent(path[1])
        else {
            return nil
        }
        return destination(kind: path[0], value: value)
    }

    private static func destination(
        kind: String,
        value: String
    ) -> WanspotDeepLinkDestination? {
        switch kind.lowercased() {
        case "spots":
            .spot(id: value)
        case "articles":
            .article(slug: value)
        case "events", "calendar":
            .calendar(slug: value)
        default:
            nil
        }
    }

    private static func isWanspotHost(_ host: String?) -> Bool {
        switch host?.lowercased() {
        case "wanspot.app", "www.wanspot.app":
            true
        default:
            false
        }
    }

    private static func routeComponent(_ raw: String) -> String? {
        let value = (raw.removingPercentEncoding ?? raw)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard
            !value.isEmpty,
            value.utf8.count <= 512,
            !value.contains("/"),
            !value.contains("\\"),
            value.unicodeScalars.allSatisfy({
                !CharacterSet.controlCharacters.contains($0)
            })
        else {
            return nil
        }
        return value
    }
}
