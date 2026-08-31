import Foundation

public enum NearbyGeometry {
    private static let earthRadiusMeters = 6_371_000.0
    private static let coordinatePrecision = 4
    private static let spreadRadiusMeters = 9.0

    public static func distanceMeters(
        from origin: NearbyCoordinate,
        to destination: NearbyCoordinate
    ) -> Double {
        distanceMeters(
            latitude1: origin.latitude,
            longitude1: origin.longitude,
            latitude2: destination.latitude,
            longitude2: destination.longitude
        )
    }

    public static func distanceMeters(
        latitude1: Double,
        longitude1: Double,
        latitude2: Double,
        longitude2: Double
    ) -> Double {
        let latitudeDelta = degreesToRadians(latitude2 - latitude1)
        let longitudeDelta = degreesToRadians(longitude2 - longitude1)
        let a =
            pow(sin(latitudeDelta / 2), 2)
                + cos(degreesToRadians(latitude1))
                * cos(degreesToRadians(latitude2))
                * pow(sin(longitudeDelta / 2), 2)
        return earthRadiusMeters
            * 2
            * atan2(sqrt(a), sqrt(max(0, 1 - a)))
    }

    public static func isWithinRadius(
        _ point: NearbyCoordinate,
        of origin: NearbyCoordinate,
        radiusMeters: Double
    ) -> Bool {
        distanceMeters(from: origin, to: point) <= radiusMeters
    }

    public static func distanceLabel(_ meters: Double) -> String {
        if meters >= 1_000 {
            return String(
                format: "%.1fkm",
                locale: Locale(identifier: "en_US_POSIX"),
                meters / 1_000
            )
        }
        return "\(Int(meters.rounded()))m"
    }

    public static func deduplicate(_ spots: [PlaceResult]) -> [PlaceResult] {
        var seen = Set<String>()
        return spots.filter { spot in
            let key =
                "\(coordinateKey(latitude: spot.latitude, longitude: spot.longitude))|\(normalizedName(spot.name))"
            return seen.insert(key).inserted
        }
    }

    public static func spreadOverlapping(
        _ spots: [PlaceResult]
    ) -> [NearbyDisplaySpot] {
        guard !spots.isEmpty else { return [] }

        let groups = Dictionary(grouping: spots) {
            coordinateKey(latitude: $0.latitude, longitude: $0.longitude)
        }
        var offsets: [String: (latitude: Double, longitude: Double)] = [:]

        for group in groups.values where group.count >= 2 {
            let sorted = group.sorted {
                $0.placeID.compare($1.placeID) == .orderedAscending
            }
            let step = 2 * Double.pi / Double(sorted.count)
            for (index, spot) in sorted.enumerated() {
                let angle = step * Double(index) - Double.pi / 2
                let latitudeOffset =
                    (spreadRadiusMeters * sin(angle)) / 111_000
                let longitudeScale =
                    111_000
                    * max(cos(degreesToRadians(spot.latitude)), 0.2)
                let longitudeOffset =
                    (spreadRadiusMeters * cos(angle)) / longitudeScale
                offsets[spot.placeID] = (
                    latitude: latitudeOffset,
                    longitude: longitudeOffset
                )
            }
        }

        return spots.map { spot in
            let offset = offsets[spot.placeID] ?? (0, 0)
            return NearbyDisplaySpot(
                spot: spot,
                displayCoordinate: NearbyCoordinate(
                    latitude: spot.latitude + offset.latitude,
                    longitude: spot.longitude + offset.longitude
                )
            )
        }
    }

    private static func coordinateKey(
        latitude: Double,
        longitude: Double
    ) -> String {
        String(
            format: "%.*f,%.*f",
            locale: Locale(identifier: "en_US_POSIX"),
            coordinatePrecision,
            latitude,
            coordinatePrecision,
            longitude
        )
    }

    private static func normalizedName(_ value: String) -> String {
        value
            .components(separatedBy: .whitespacesAndNewlines)
            .joined()
            .lowercased()
    }

    private static func degreesToRadians(_ value: Double) -> Double {
        value * Double.pi / 180
    }
}

public struct NearbyDisplaySpot: Equatable, Identifiable, Sendable {
    public let spot: PlaceResult
    public let displayCoordinate: NearbyCoordinate

    public var id: String { spot.placeID }

    public init(
        spot: PlaceResult,
        displayCoordinate: NearbyCoordinate
    ) {
        self.spot = spot
        self.displayCoordinate = displayCoordinate
    }
}
