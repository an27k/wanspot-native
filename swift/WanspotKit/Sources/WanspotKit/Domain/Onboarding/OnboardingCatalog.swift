import Foundation

public struct WalkAreaCatalogEntry: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let label: String
    public let latitude: Double
    public let longitude: Double

    private enum CodingKeys: String, CodingKey {
        case id
        case label
        case latitude = "lat"
        case longitude = "lng"
    }
}

public enum OnboardingCatalog {
    public static let maximumWalkAreaTags = 8

    public static let dogBreeds: [String] = resource.dogBreeds
    public static let dogBreedQuickPicks: [String] =
        resource.dogBreedQuickPicks
    public static let walkAreas: [WalkAreaCatalogEntry] = resource.walkAreas

    public static func filterDogBreeds(_ query: String) -> [String] {
        let normalizedQuery = normalizeBreedText(query)
        guard !normalizedQuery.isEmpty else { return dogBreeds }
        return dogBreeds.filter {
            breedSearchKey($0).contains(normalizedQuery)
        }
    }

    public static func searchWalkAreas(
        _ query: String,
        limit: Int = 80
    ) -> [WalkAreaCatalogEntry] {
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty, limit > 0 else { return [] }
        return Array(
            walkAreas.lazy.filter { $0.label.contains(query) }.prefix(limit)
        )
    }

    public static func suggestedWalkAreas(
        latitude: Double,
        longitude: Double,
        radiusMeters: Double = 10_000,
        limit: Int = 40
    ) -> [WalkAreaCatalogEntry] {
        guard radiusMeters >= 0, limit > 0 else { return [] }
        return walkAreas
            .map {
                (
                    entry: $0,
                    distance: distanceMeters(
                        latitude,
                        longitude,
                        $0.latitude,
                        $0.longitude
                    )
                )
            }
            .filter { $0.distance <= radiusMeters }
            .sorted { $0.distance < $1.distance }
            .prefix(limit)
            .map(\.entry)
    }

    public static func normalizeWalkAreaTags(_ tags: [String]) -> [String] {
        var seen = Set<String>()
        var result: [String] = []
        for tag in tags {
            let value = tag.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty, seen.insert(value).inserted else { continue }
            result.append(value)
            if result.count == maximumWalkAreaTags {
                break
            }
        }
        return result
    }
}

private struct OnboardingCatalogResource: Decodable {
    let dogBreeds: [String]
    let dogBreedQuickPicks: [String]
    let walkAreas: [WalkAreaCatalogEntry]
}

private extension OnboardingCatalog {
    static let resource: OnboardingCatalogResource = {
        guard
            let url = Bundle.module.url(
                forResource: "onboarding-catalog",
                withExtension: "json"
            ),
            let data = try? Data(contentsOf: url),
            let resource = try? JSONDecoder().decode(
                OnboardingCatalogResource.self,
                from: data
            )
        else {
            assertionFailure("onboarding-catalog.json could not be loaded")
            return OnboardingCatalogResource(
                dogBreeds: [],
                dogBreedQuickPicks: [],
                walkAreas: []
            )
        }
        return resource
    }()
}

private let breedReadings: [String: String] = [
    "秋田犬": "あきたいぬ あきたけん",
    "甲斐犬": "かいけん かいいぬ",
    "紀州犬": "きしゅうけん きしゅういぬ",
    "四国犬": "しこくけん しこくいぬ",
    "柴犬": "しばいぬ しばけん しば",
    "狆": "ちん",
    "土佐犬": "とさけん とさいぬ",
    "日本スピッツ": "にほんすぴっつ にっぽんすぴっつ",
    "日本テリア": "にほんてりあ にっぽんてりあ",
    "北海道犬": "ほっかいどうけん ほっかいどういぬ",
    "ミックス犬": "みっくす ざっしゅ 雑種",
    "その他/不明": "そのた ふめい わからない",
]

private func breedSearchKey(_ breed: String) -> String {
    normalizeBreedText(
        breedReadings[breed].map { "\(breed)\($0)" } ?? breed
    )
}

private func normalizeBreedText(_ value: String) -> String {
    let normalized = value
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
        .precomposedStringWithCompatibilityMapping
    let katakana = String(normalized.unicodeScalars.map { scalar in
        let value = scalar.value
        if (0x3041 ... 0x3096).contains(value),
            let converted = UnicodeScalar(value + 0x60)
        {
            return Character(converted)
        }
        return Character(scalar)
    })
    return katakana.replacingOccurrences(
        of: "[・\\sー－-]",
        with: "",
        options: .regularExpression
    )
}

private func distanceMeters(
    _ latitude1: Double,
    _ longitude1: Double,
    _ latitude2: Double,
    _ longitude2: Double
) -> Double {
    let earthRadius = 6_371_000.0
    let latitudeDelta = (latitude2 - latitude1) * .pi / 180
    let longitudeDelta = (longitude2 - longitude1) * .pi / 180
    let value =
        pow(sin(latitudeDelta / 2), 2)
        + cos(latitude1 * .pi / 180)
            * cos(latitude2 * .pi / 180)
            * pow(sin(longitudeDelta / 2), 2)
    return earthRadius * 2 * atan2(sqrt(value), sqrt(1 - value))
}
