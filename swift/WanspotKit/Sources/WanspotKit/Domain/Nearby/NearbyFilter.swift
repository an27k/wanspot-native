import Foundation

public enum NearbyFilter {
    private static let cafeTypes = Set([
        "cafe",
        "bakery",
        "coffee_shop",
    ])
    private static let restaurantTypes = Set([
        "restaurant",
        "meal_takeaway",
        "meal_delivery",
        "bar",
        "food",
    ])
    private static let categoryKeywords: [NearbyGenre: [String]] = [
        .cafe: ["カフェ", "cafe", "コーヒー", "珈琲", "喫茶"],
        .park: ["公園", "パーク", "park", "広場", "緑地"],
        .restaurant: [
            "レストラン",
            "restaurant",
            "食堂",
            "ダイニング",
            "food",
            "飲食",
        ],
        .dogRun: [
            "ドッグラン",
            "ドッグパーク",
            "犬の広場",
            "dog run",
            "dog park",
            "dogrun",
        ],
        .veterinaryCare: [
            "動物病院",
            "獣医",
            "アニマルクリニック",
            "アニマルホスピタル",
            "veterinary",
            "animal hospital",
            "animal clinic",
        ],
        .petHotel: [
            "ペットホテル",
            "pet hotel",
            "pethotel",
            "ペット ホテル",
        ],
    ]

    private static let dogRunPattern =
        #"(ドッ[グク][ 　・]?(ラン|パーク|ガーデン|ヴィレッジ|フィールド|エリア)|ﾄﾞｯｸﾞ?[ ･]?ﾗﾝ|わんこの広場|犬の遊び場|犬の広場|ノーリード広場|ペットラン|dog ?run|dog ?park|dog ?garden|dog ?village|dog ?field|off.?leash)"#
    private static let petHotelPattern =
        #"(ホテル|わんこ ?の ?宿|犬 ?の ?宿|お泊り|おとまり|一時預かり|宿泊|ケンネル|kennel|hotel|pet ?boarding|dog ?boarding|boarding)"#
    private static let groomingOnlyPattern =
        #"(トリミング(サロン|専門|ルーム)?|グルーミング|grooming)"#

    public static func isDogRunCategory(_ value: String?) -> Bool {
        value == "dog_run" || value == "dog_run_indoor"
    }

    public static func matchesCategory(
        _ category: String?,
        genre: NearbyGenre
    ) -> Bool {
        guard let category else { return false }
        let normalized = category.lowercased()
        return categoryKeywords[genre, default: []].contains {
            normalized.contains($0.lowercased())
        }
    }

    public static func inferredGenre(for spot: PlaceResult) -> NearbyGenre {
        if isDogRunCategory(spot.extendedCategory) {
            return .dogRun
        }
        return NearbyGenre.allCases.first {
            matchesCategory(spot.category, genre: $0)
        } ?? .cafe
    }

    public static func displayGenre(
        for spot: PlaceResult,
        selectedGenre: NearbyGenre?
    ) -> NearbyGenre {
        if
            let selectedGenre,
            matchesGenre(spot, genre: selectedGenre)
        {
            return selectedGenre
        }
        return inferredGenre(for: spot)
    }

    public static func matchesGenre(
        _ spot: PlaceResult,
        genre: NearbyGenre
    ) -> Bool {
        if genre == .dogRun, isDogRunCategory(spot.extendedCategory) {
            return true
        }

        let types = Set((spot.types ?? []).map { $0.lowercased() })
        switch genre {
        case .dogRun:
            if types.contains("dog_park") {
                return true
            }
            return regexMatches(
                dogRunPattern,
                value: [
                    spot.name,
                    spot.address,
                    spot.category,
                ].joined(separator: " ")
            )

        case .cafe, .restaurant:
            let hasCafeType = !types.isDisjoint(with: cafeTypes)
            let hasRestaurantType =
                !types.isDisjoint(with: restaurantTypes)
            let categoryIsCafe =
                matchesCategory(spot.category, genre: .cafe)
            let categoryIsRestaurant =
                matchesCategory(spot.category, genre: .restaurant)

            if genre == .cafe {
                if
                    hasRestaurantType,
                    !hasCafeType,
                    !categoryIsCafe
                {
                    return false
                }
                if
                    categoryIsRestaurant,
                    !categoryIsCafe,
                    !hasCafeType
                {
                    return false
                }
                return hasCafeType || categoryIsCafe
            }

            if hasCafeType, !hasRestaurantType, !categoryIsRestaurant {
                return false
            }
            if categoryIsCafe, !categoryIsRestaurant, !hasRestaurantType {
                return false
            }
            return hasRestaurantType || categoryIsRestaurant

        case .park:
            return types.contains("park")
                || matchesCategory(spot.category, genre: genre)

        case .veterinaryCare:
            return types.contains("veterinary_care")
                || matchesCategory(spot.category, genre: genre)

        case .petHotel:
            let groomingOnly = regexMatches(
                groomingOnlyPattern,
                value: spot.name
            )
            guard groomingOnly else { return true }
            return regexMatches(
                petHotelPattern,
                value: "\(spot.name) \(spot.address)"
            )
        }
    }

    public static func petConditionsApply(to genre: NearbyGenre?) -> Bool {
        genre != .veterinaryCare && genre != .petHotel
    }

    public static func applyConditions(
        _ spots: [PlaceResult],
        conditions: NearbyConditionFilter,
        likedPlaceIDs: Set<String>,
        genre: NearbyGenre?
    ) -> [PlaceResult] {
        spots.filter { spot in
            if petConditionsApply(to: genre) {
                if conditions.indoorOnly, !PetPolicy.isIndoorAllowed(spot) {
                    return false
                }
                if conditions.terraceOnly, !PetPolicy.isTerraceAllowed(spot) {
                    return false
                }
            }
            if
                conditions.likedOnly,
                !likedPlaceIDs.contains(spot.placeID)
            {
                return false
            }
            return true
        }
    }

    public static func apply(
        _ spots: [PlaceResult],
        genre: NearbyGenre?,
        conditions: NearbyConditionFilter,
        likedPlaceIDs: Set<String>
    ) -> [PlaceResult] {
        let genreFiltered = genre.map { genre in
            spots.filter { matchesGenre($0, genre: genre) }
        } ?? spots
        return applyConditions(
            genreFiltered,
            conditions: conditions,
            likedPlaceIDs: likedPlaceIDs,
            genre: genre
        )
    }

    private static func regexMatches(
        _ pattern: String,
        value: String
    ) -> Bool {
        value.range(
            of: pattern,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }
}
