import Foundation

public struct NearbyLoadResult: Equatable, Sendable {
    public let spots: [PlaceResult]
    public let radiusMeters: Int

    public init(spots: [PlaceResult], radiusMeters: Int) {
        self.spots = spots
        self.radiusMeters = radiusMeters
    }
}

public enum NearbyRepositoryError: Error, Equatable, LocalizedError, Sendable {
    case unavailable
    case server(String)

    public var errorDescription: String? {
        switch self {
        case .unavailable:
            "うまく読み込めませんでした。通信環境を確認して、もう一度お試しください。"
        case let .server(message):
            message
        }
    }
}

public struct NearbyRepository: Sendable {
    public static let minimumSpotCount = 5
    public static let radiusSteps = [3_000, 5_000]
    public static let urgentRadiusSteps = [3_000, 5_000, 15_000, 20_000]

    private let client: WanspotAPIClient
    private let cache: MemoryCache

    public init(
        client: WanspotAPIClient,
        cache: MemoryCache = MemoryCache()
    ) {
        self.client = client
        self.cache = cache
    }

    public func fetchNearbyWithExpansion(
        center: NearbyCoordinate,
        genre: NearbyGenre?,
        minimumSpotCount: Int = Self.minimumSpotCount,
        force: Bool = false
    ) async throws -> NearbyLoadResult {
        let steps = genre == .veterinaryCare
            ? Self.urgentRadiusSteps
            : Self.radiusSteps
        var last = NearbyLoadResult(
            spots: [],
            radiusMeters: steps.last ?? 5_000
        )

        for radius in steps {
            let spots: [PlaceResult]
            if let genre {
                spots = try await fetchGenre(
                    genre,
                    center: center,
                    radiusMeters: radius,
                    force: force
                )
            } else {
                spots = try await fetchAllGenres(
                    center: center,
                    radiusMeters: radius,
                    force: force
                )
            }
            last = NearbyLoadResult(spots: spots, radiusMeters: radius)
            if spots.count >= minimumSpotCount {
                return last
            }
        }
        return last
    }

    public func search(
        query: String,
        center: NearbyCoordinate?,
        force: Bool = false
    ) async throws -> SpotSearchResponse {
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            return SpotSearchResponse(spots: [], searchCenter: nil)
        }
        let locationKey = center.map {
            geoBucket(
                latitude: $0.latitude,
                longitude: $0.longitude
            )
        } ?? "none"
        let key = "nearby:search:v1:\(query.lowercased()):\(locationKey)"
        let result: CacheFetchResult<SpotSearchResponse> =
            try await cache.fetch(
                key,
                ttl: CacheTTL.nearbySpots,
                force: force
            ) {
                try await client.searchSpots(
                    query: query,
                    latitude: center?.latitude,
                    longitude: center?.longitude
                )
            }
        return result.value
    }

    public func autocomplete(
        query: String,
        bias: NearbyCoordinate?
    ) async throws -> [PlacePrediction] {
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard query.count >= 2 else { return [] }
        let locationKey = bias.map {
            geoBucket(
                latitude: $0.latitude,
                longitude: $0.longitude,
                decimals: 2
            )
        } ?? "none"
        let key =
            "nearby:autocomplete:v1:\(query.lowercased()):\(locationKey)"
        let result: CacheFetchResult<[PlacePrediction]> =
            try await cache.fetch(
                key,
                ttl: 5 * 60
            ) {
                try await client.autocompletePlaces(
                    query: query,
                    latitude: bias?.latitude,
                    longitude: bias?.longitude
                )
            }
        return result.value
    }

    public func resolve(placeID: String) async throws -> ResolvedPlace {
        let key = "nearby:resolve:v1:\(placeID)"
        let result: CacheFetchResult<ResolvedPlace> = try await cache.fetch(
            key,
            ttl: 24 * 60 * 60
        ) {
            try await client.resolvePlace(placeID: placeID)
        }
        return result.value
    }

    public func invalidateNearby() async {
        await cache.invalidate(prefix: "nearby:spots:")
        await cache.invalidate(prefix: "nearby:search:")
    }

    private func fetchAllGenres(
        center: NearbyCoordinate,
        radiusMeters: Int,
        force: Bool
    ) async throws -> [PlaceResult] {
        let outcomes = await withTaskGroup(
            of: IndexedGenreOutcome.self,
            returning: [IndexedGenreOutcome].self
        ) { group in
            for (index, genre) in NearbyGenre.allCases.enumerated() {
                group.addTask {
                    do {
                        return IndexedGenreOutcome(
                            index: index,
                            spots: try await fetchGenre(
                                genre,
                                center: center,
                                radiusMeters: radiusMeters,
                                force: force
                            ),
                            failed: false
                        )
                    } catch {
                        return IndexedGenreOutcome(
                            index: index,
                            spots: [],
                            failed: true
                        )
                    }
                }
            }
            var values: [IndexedGenreOutcome] = []
            for await value in group {
                values.append(value)
            }
            return values.sorted { $0.index < $1.index }
        }

        guard outcomes.contains(where: { !$0.failed }) else {
            throw NearbyRepositoryError.unavailable
        }
        var seen = Set<String>()
        return outcomes.flatMap(\.spots).filter {
            !$0.placeID.isEmpty && seen.insert($0.placeID).inserted
        }
    }

    private func fetchGenre(
        _ genre: NearbyGenre,
        center: NearbyCoordinate,
        radiusMeters: Int,
        force: Bool
    ) async throws -> [PlaceResult] {
        let raw: [PlaceResult]
        if genre == .dogRun {
            raw = try await fetchDogRuns(
                center: center,
                radiusMeters: radiusMeters,
                force: force
            )
        } else {
            raw = try await cachedNearby(
                center: center,
                radiusMeters: radiusMeters,
                genre: genre,
                force: force
            )
        }

        return raw.filter { spot in
            !spot.placeID.isEmpty
                && NearbyGeometry.isWithinRadius(
                    spot.coordinate,
                    of: center,
                    radiusMeters: Double(radiusMeters)
                )
                && NearbyFilter.matchesGenre(spot, genre: genre)
        }
    }

    private func fetchDogRuns(
        center: NearbyCoordinate,
        radiusMeters: Int,
        force: Bool
    ) async throws -> [PlaceResult] {
        async let primary = optionalSearch(
            query: "ドッグラン",
            center: center,
            force: force
        )
        async let database = optionalNearby(
            center: center,
            radiusMeters: radiusMeters,
            genre: .dogRun,
            force: force
        )
        let (searchResponse, databaseSpots) = await (primary, database)
        guard searchResponse != nil || databaseSpots != nil else {
            throw NearbyRepositoryError.unavailable
        }

        var seen = Set<String>()
        var merged = (searchResponse?.spots ?? []) + (databaseSpots ?? [])
        merged = merged.filter {
            !$0.placeID.isEmpty
                && seen.insert($0.placeID).inserted
                && NearbyFilter.matchesGenre($0, genre: .dogRun)
                && NearbyGeometry.isWithinRadius(
                    $0.coordinate,
                    of: center,
                    radiusMeters: Double(radiusMeters)
                )
        }

        if merged.count < Self.minimumSpotCount {
            let supplemental = await optionalSearch(
                query: "屋内ドッグラン",
                center: center,
                force: force
            )
            for spot in supplemental?.spots ?? [] where
                !spot.placeID.isEmpty
                && !seen.contains(spot.placeID)
                && NearbyFilter.matchesGenre(spot, genre: .dogRun)
                && NearbyGeometry.isWithinRadius(
                    spot.coordinate,
                    of: center,
                    radiusMeters: Double(radiusMeters)
                )
            {
                seen.insert(spot.placeID)
                merged.append(spot)
            }
        }

        return NearbyRanking.sortDogRunsByPriority(
            merged.map { $0.replacingCategory("ドッグラン") }
        )
    }

    private func cachedNearby(
        center: NearbyCoordinate,
        radiusMeters: Int,
        genre: NearbyGenre,
        force: Bool
    ) async throws -> [PlaceResult] {
        let key =
            "nearby:spots:v2:\(genre.rawValue):\(geoBucket(latitude: center.latitude, longitude: center.longitude)):\(radiusMeters)"
        let result: CacheFetchResult<NearbySpotsResponse> =
            try await cache.fetch(
                key,
                ttl: CacheTTL.nearbySpots,
                force: force
            ) {
                try await client.fetchNearbySpots(
                    latitude: center.latitude,
                    longitude: center.longitude,
                    radiusMeters: radiusMeters,
                    type: genre
                )
            }
        if let error = result.value.error, !error.isEmpty {
            throw NearbyRepositoryError.server(error)
        }
        return result.value.spots
    }

    private func optionalNearby(
        center: NearbyCoordinate,
        radiusMeters: Int,
        genre: NearbyGenre,
        force: Bool
    ) async -> [PlaceResult]? {
        try? await cachedNearby(
            center: center,
            radiusMeters: radiusMeters,
            genre: genre,
            force: force
        )
    }

    private func optionalSearch(
        query: String,
        center: NearbyCoordinate,
        force: Bool
    ) async -> SpotSearchResponse? {
        try? await search(query: query, center: center, force: force)
    }
}

private struct IndexedGenreOutcome: Sendable {
    let index: Int
    let spots: [PlaceResult]
    let failed: Bool
}
