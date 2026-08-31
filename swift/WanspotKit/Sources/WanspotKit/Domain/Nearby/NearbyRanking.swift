import Foundation

public enum NearbyRanking {
    private static let priorMean = 4.0
    private static let priorWeight = 10.0
    private static let certaintyWeight = 3.0
    private static let distanceWeight = 2.0

    public static func qualityScore(_ spot: PlaceResult) -> Double {
        guard
            let rating = spot.rating,
            rating > 0,
            rating.isFinite
        else {
            return -1
        }

        let count = spot.userRatingsTotal.flatMap { value in
            value > 0 ? Double(value) : nil
        } ?? 0
        if count == 0 {
            return priorMean + (rating - priorMean) * 0.35
        }
        return (count / (count + priorWeight)) * rating
            + (priorWeight / (count + priorWeight)) * priorMean
    }

    public static func petCertaintyScore(_ spot: PlaceResult) -> Double {
        guard spot.petFriendlyVerified == true else { return 0 }
        guard spot.petFriendlyStatus != "not_allowed" else { return 0 }

        if
            NearbyFilter.isDogRunCategory(spot.extendedCategory),
            spot.petFriendlyStatus != "leashed_only"
        {
            return 1
        }
        if spot.petIndoorAllowed == true {
            return 1
        }
        if spot.petFriendlyStatus == "allowed" {
            return 0.85
        }
        if spot.petTerraceOnly == true {
            return 0.7
        }
        if spot.petFriendlyStatus == "leashed_only" {
            return 0.6
        }
        return 0.2
    }

    public static func situationFactor(
        _ spot: PlaceResult,
        situation: NearbyWalkSituation?,
        now: Date = Date()
    ) -> Double {
        guard let situation else { return 1 }
        var factor = 1.0

        if situation.rainy {
            if spot.petIndoorAllowed == true {
                factor *= 1
            } else if
                spot.petTerraceOnly == true
                || spot.petFriendlyStatus == "outdoor_only"
            {
                factor *= 0.15
            } else {
                factor *= 0.6
            }
        }

        switch situation.heatLevel {
        case .danger, .stop:
            let severe = situation.heatLevel == .stop
            if
                spot.petIndoorAllowed == true
                || spot.extendedCategory == "dog_run_indoor"
            {
                factor *= 1
            } else if NearbyFilter.isDogRunCategory(spot.extendedCategory) {
                factor *= severe ? 0.2 : 0.4
            } else if
                spot.petTerraceOnly == true
                || spot.petFriendlyStatus == "outdoor_only"
            {
                factor *= severe ? 0.15 : 0.3
            } else {
                factor *= 0.6
            }

        case .caution:
            if
                spot.petIndoorAllowed == true
                || spot.extendedCategory == "dog_run_indoor"
            {
                factor *= 1
            } else if
                spot.petTerraceOnly == true
                || spot.petFriendlyStatus == "outdoor_only"
            {
                factor *= 0.7
            } else if NearbyFilter.isDogRunCategory(spot.extendedCategory) {
                factor *= 0.8
            }

        default:
            break
        }

        if
            BusinessHours.openStateFromPeriods(
                spot.openingHours?.periods,
                now: now
            ).status == .closed
        {
            factor *= 0.35
        }

        let size = situation.dogSize?.uppercased()
        if
            (size == "L" || size == "XL"),
            let limit = spot.petSizeLimit,
            limit.range(
                of: "大型|中型|小型|kg|体重|サイズ",
                options: .regularExpression
            ) != nil
        {
            factor *= 0.3
        }
        return factor
    }

    public static func overallScore(
        _ spot: PlaceResult,
        origin: NearbyCoordinate?,
        situation: NearbyWalkSituation? = nil,
        now: Date = Date()
    ) -> Double {
        let certainty =
            petCertaintyScore(spot)
            * situationFactor(spot, situation: situation, now: now)
        let quality = qualityScore(spot)
        let distanceTerm: Double
        if let origin {
            let distance = NearbyGeometry.distanceMeters(
                from: origin,
                to: NearbyCoordinate(
                    latitude: spot.latitude,
                    longitude: spot.longitude
                )
            )
            let decay = situation?.travel == .driving ? 6_000.0 : 1_200.0
            distanceTerm = exp(-distance / decay)
        } else {
            distanceTerm = 0
        }
        return certaintyWeight * certainty
            + quality
            + distanceWeight * distanceTerm
    }

    public static func shouldExcludeForOwner(_ spot: PlaceResult) -> Bool {
        spot.petFriendlyStatus == "not_allowed"
            || spot.dogInteraction == "meet_dogs"
    }

    public static func sort(
        _ spots: [PlaceResult],
        origin: NearbyCoordinate?,
        situation: NearbyWalkSituation? = nil,
        now: Date = Date()
    ) -> [PlaceResult] {
        spots
            .enumerated()
            .filter { !shouldExcludeForOwner($0.element) }
            .map { index, spot in
                RankedSpot(
                    index: index,
                    spot: spot,
                    score: overallScore(
                        spot,
                        origin: origin,
                        situation: situation,
                        now: now
                    ),
                    distance: origin.map {
                        NearbyGeometry.distanceMeters(
                            from: $0,
                            to: NearbyCoordinate(
                                latitude: spot.latitude,
                                longitude: spot.longitude
                            )
                        )
                    }
                )
            }
            .sorted { left, right in
                if left.score != right.score {
                    return left.score > right.score
                }
                if
                    let leftDistance = left.distance,
                    let rightDistance = right.distance,
                    leftDistance != rightDistance
                {
                    return leftDistance < rightDistance
                }
                return left.index < right.index
            }
            .map(\.spot)
    }

    public static func dogRunPriorityScore(_ spot: PlaceResult) -> Int {
        let text = "\(spot.name) \(spot.address)"
        var score = 0
        if matches(#"(屋内|室内|インドア|indoor)"#, text) {
            score += 3
        }
        if matches(
            #"(テーマパーク|リゾート|ガーデン|ヴィレッジ|ランド|フィールド|village|garden|resort|theme ?park)"#,
            text
        ) {
            score += 2
        }
        if matches(
            #"(市営|区営|町営|村営|県営|都立|市立|区立|都営|国営|府営|道営)"#,
            text
        ) {
            score -= 3
        }
        if spot.name.contains("公園") {
            score -= 2
        }
        let types = spot.types ?? []
        if types.contains("park"), !types.contains("dog_park") {
            score -= 1
        }
        return score
    }

    public static func sortDogRunsByPriority(
        _ spots: [PlaceResult]
    ) -> [PlaceResult] {
        spots.enumerated().sorted { left, right in
            let leftScore = dogRunPriorityScore(left.element)
            let rightScore = dogRunPriorityScore(right.element)
            return leftScore == rightScore
                ? left.offset < right.offset
                : leftScore > rightScore
        }.map(\.element)
    }

    private static func matches(_ pattern: String, _ value: String) -> Bool {
        value.range(
            of: pattern,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }
}

private struct RankedSpot {
    let index: Int
    let spot: PlaceResult
    let score: Double
    let distance: Double?
}
