import Foundation
import Observation
import WanspotKit

struct MapSearchAnchor: Equatable, Sendable {
    let coordinate: NearbyCoordinate
    let label: String
}

@MainActor
@Observable
final class MapSearchStore {
    var query = ""
    private(set) var suggestions: [PlacePrediction] = []
    private(set) var currentLocation: NearbyCoordinate?
    private(set) var searchAnchor: MapSearchAnchor?
    private(set) var rawSpots: [PlaceResult] = []
    private(set) var weather: CurrentWeather?
    private(set) var dog: DogProfile?
    private(set) var searchedRadiusMeters: Int?
    private(set) var isLoading = false
    private(set) var isResolving = false
    private(set) var errorMessage: String?
    private(set) var likedPlaceIDs = Set<String>()

    var selectedGenre: NearbyGenre?
    var conditions: NearbyConditionFilter
    var selectedPlaceID: String?

    private var nearbyRepository: NearbyRepository?
    private var weatherRepository: WeatherRepository?
    private var profileRepository: SupabaseProfileRepository?
    private var activityRepository: SupabaseSpotActivityRepository?
    private var apiClient: WanspotAPIClient?
    private var userID: String?
    private var likeSpotIDsByPlaceID: [String: String] = [:]
    private var likesInFlight = Set<String>()
    private var loadGeneration = UUID()
    private var suggestionGeneration = UUID()
    private var isConfigured = false

    private let defaults: UserDefaults
    private static let conditionsKey = "nearby_map_conditions_v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if
            let data = defaults.data(forKey: Self.conditionsKey),
            let saved = try? JSONDecoder().decode(
                NearbyConditionFilter.self,
                from: data
            )
        {
            conditions = saved
        } else {
            conditions = .empty
        }
    }

    var center: NearbyCoordinate? {
        searchAnchor?.coordinate ?? currentLocation
    }

    var isSearchActive: Bool {
        searchAnchor != nil
    }

    var rankingSituation: NearbyWalkSituation {
        let heatLevel = weather.map { weather in
            WeatherJudgment.walkAlert(
                temperatureCelsius: weather.temperatureCelsius,
                heatSensitivity: WeatherJudgment.breedHeatSensitivity(
                    dog?.breed
                ),
                ageMonths: WeatherJudgment.dogAgeMonths(
                    birthday: dog?.birthday
                )
            ).level
        }
        return NearbyWalkSituation(
            rainy: weather?.condition.isRainy == true,
            dogSize: dog?.size?.rawValue,
            heatLevel: heatLevel
        )
    }

    var spots: [PlaceResult] {
        let ranked = NearbyRanking.sort(
            rawSpots,
            origin: center,
            situation: rankingSituation
        )
        let deduplicated = NearbyGeometry.deduplicate(ranked)
        return NearbyFilter.apply(
            deduplicated,
            genre: selectedGenre,
            conditions: conditions,
            likedPlaceIDs: likedPlaceIDs
        )
    }

    var displaySpots: [NearbyDisplaySpot] {
        NearbyGeometry.spreadOverlapping(spots)
    }

    var selectedSpot: PlaceResult? {
        guard let selectedPlaceID else { return nil }
        return spots.first { $0.placeID == selectedPlaceID }
    }

    var searchedRangeHint: String {
        guard let searchedRadiusMeters else { return "" }
        return "半径 約\(Int((Double(searchedRadiusMeters) / 1_000).rounded()))km まで探しました。"
    }

    func configure(
        nearbyRepository: NearbyRepository?,
        weatherRepository: WeatherRepository?,
        profileRepository: SupabaseProfileRepository?,
        activityRepository: SupabaseSpotActivityRepository?,
        apiClient: WanspotAPIClient?,
        userID: String?
    ) {
        self.nearbyRepository = nearbyRepository
        self.weatherRepository = weatherRepository
        self.profileRepository = profileRepository
        self.activityRepository = activityRepository
        self.apiClient = apiClient
        self.userID = userID
        isConfigured = true
        if userID == nil {
            likedPlaceIDs = []
            likeSpotIDsByPlaceID = [:]
            if conditions.likedOnly {
                conditions.likedOnly = false
                persistConditions()
            }
        }
    }

    func loadUserContext() async {
        guard isConfigured, let userID else {
            dog = nil
            likedPlaceIDs = []
            likeSpotIDsByPlaceID = [:]
            return
        }

        async let fetchedDog = optionalDog(userID: userID)
        async let fetchedLikes = optionalLikes(userID: userID)
        let (dog, likes) = await (fetchedDog, fetchedLikes)
        self.dog = dog

        guard
            let likes,
            let apiClient,
            !likes.isEmpty
        else {
            likedPlaceIDs = []
            likeSpotIDsByPlaceID = [:]
            return
        }
        let rows = try? await apiClient.fetchSpotsByIDs(
            ids: likes.map(\.spotID),
            columns: .list
        )
        var mapping: [String: String] = [:]
        for row in rows ?? [] {
            if let placeID = row.placeID, let spotID = row.id {
                mapping[placeID] = spotID
            }
        }
        likeSpotIDsByPlaceID = mapping
        likedPlaceIDs = Set(mapping.keys)
        reconcileSelection()
    }

    func updateCurrentLocation(_ coordinate: NearbyCoordinate) async {
        let changed = currentLocation.map {
            NearbyGeometry.distanceMeters(from: $0, to: coordinate) >= 25
        } ?? true
        currentLocation = coordinate
        guard changed, searchAnchor == nil else { return }
        await reloadNearby()
    }

    func reloadNearby(force: Bool = false) async {
        guard let nearbyRepository, let center else { return }
        let generation = UUID()
        loadGeneration = generation
        isLoading = rawSpots.isEmpty
        errorMessage = nil

        do {
            let result = try await nearbyRepository.fetchNearbyWithExpansion(
                center: center,
                genre: selectedGenre,
                force: force
            )
            guard loadGeneration == generation else { return }
            rawSpots = result.spots
            searchedRadiusMeters = result.radiusMeters
            isLoading = false
            reconcileSelection()
            await loadWeather(at: center, generation: generation)
        } catch {
            guard loadGeneration == generation else { return }
            isLoading = false
            errorMessage = error.localizedDescription
        }
    }

    func setGenre(_ genre: NearbyGenre?) async {
        guard selectedGenre != genre else {
            selectedGenre = nil
            selectedPlaceID = nil
            await reloadNearby()
            return
        }
        selectedGenre = genre
        selectedPlaceID = nil
        await reloadNearby()
    }

    func toggleCondition(_ keyPath: WritableKeyPath<NearbyConditionFilter, Bool>) {
        conditions[keyPath: keyPath].toggle()
        persistConditions()
        reconcileSelection()
    }

    func clearConditions() {
        conditions = .empty
        persistConditions()
        reconcileSelection()
    }

    func refreshSuggestions() async {
        let value = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard value.count >= 2, let nearbyRepository else {
            suggestions = []
            return
        }
        let generation = UUID()
        suggestionGeneration = generation
        do {
            let values = try await nearbyRepository.autocomplete(
                query: value,
                bias: currentLocation
            )
            guard
                suggestionGeneration == generation,
                query.trimmingCharacters(in: .whitespacesAndNewlines) == value
            else {
                return
            }
            suggestions = values
        } catch {
            guard suggestionGeneration == generation else { return }
            suggestions = []
        }
    }

    func clearQuery() {
        query = ""
        suggestions = []
    }

    func selectPrediction(_ prediction: PlacePrediction) async {
        guard let nearbyRepository else { return }
        isResolving = true
        errorMessage = nil
        suggestions = []
        query = prediction.mainText
        do {
            let resolved = try await nearbyRepository.resolve(
                placeID: prediction.placeID
            )
            searchAnchor = MapSearchAnchor(
                coordinate: resolved.coordinate,
                label: prediction.mainText
            )
            selectedPlaceID = nil
            isResolving = false
            await reloadNearby()
        } catch {
            isResolving = false
            errorMessage = error.localizedDescription
        }
    }

    func submitSearch() async {
        if let first = suggestions.first {
            await selectPrediction(first)
            return
        }
        let value = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, let nearbyRepository else { return }
        isResolving = true
        errorMessage = nil
        suggestions = []
        do {
            let response = try await nearbyRepository.search(
                query: value,
                center: currentLocation
            )
            let anchorCoordinate =
                response.searchCenter?.coordinate
                ?? response.spots.first?.coordinate
                ?? currentLocation
            if let anchorCoordinate {
                searchAnchor = MapSearchAnchor(
                    coordinate: anchorCoordinate,
                    label: value
                )
            }
            rawSpots = response.spots
            searchedRadiusMeters = nil
            selectedPlaceID = nil
            isResolving = false
            reconcileSelection()
            if let anchorCoordinate {
                await loadWeather(
                    at: anchorCoordinate,
                    generation: loadGeneration
                )
            }
        } catch {
            isResolving = false
            errorMessage = error.localizedDescription
        }
    }

    func clearSearch() async {
        query = ""
        suggestions = []
        searchAnchor = nil
        selectedPlaceID = nil
        weather = nil
        await reloadNearby()
    }

    func selectSpot(_ placeID: String?) {
        selectedPlaceID = placeID
    }

    func isLiked(_ spot: PlaceResult) -> Bool {
        likedPlaceIDs.contains(spot.placeID)
    }

    func toggleLike(_ spot: PlaceResult) async {
        guard
            let userID,
            let activityRepository,
            let apiClient,
            !likesInFlight.contains(spot.placeID)
        else {
            return
        }

        let willLike = !likedPlaceIDs.contains(spot.placeID)
        likesInFlight.insert(spot.placeID)
        if willLike {
            likedPlaceIDs.insert(spot.placeID)
        } else {
            likedPlaceIDs.remove(spot.placeID)
        }
        defer { likesInFlight.remove(spot.placeID) }

        do {
            let spotID: String
            if let existing = spot.spotID ?? likeSpotIDsByPlaceID[spot.placeID] {
                spotID = existing
            } else {
                let response = try await apiClient.ensureSpot(
                    placeID: spot.placeID
                )
                guard let ensured = response.resolvedID else {
                    throw MapSearchStoreError.missingSpotID
                }
                spotID = ensured
            }
            try await activityRepository.setLike(
                userID: userID,
                spotID: spotID,
                isLiked: willLike
            )
            if willLike {
                likeSpotIDsByPlaceID[spot.placeID] = spotID
            } else {
                likeSpotIDsByPlaceID.removeValue(
                    forKey: spot.placeID
                )
            }
            reconcileSelection()
        } catch {
            if willLike {
                likedPlaceIDs.remove(spot.placeID)
            } else {
                likedPlaceIDs.insert(spot.placeID)
            }
            errorMessage = "いいねを保存できませんでした。もう一度お試しください。"
        }
    }

    func photoURL(
        for spot: PlaceResult,
        width: SpotPhotoWidth = .card
    ) -> URL? {
        try? apiClient?.spotPhotoURL(
            reference: spot.photoReference,
            placeID: spot.placeID,
            width: width
        )
    }

    private func loadWeather(
        at coordinate: NearbyCoordinate,
        generation: UUID
    ) async {
        guard let weatherRepository else { return }
        let value = try? await weatherRepository.currentWeather(
            at: coordinate
        )
        guard loadGeneration == generation || center == coordinate else {
            return
        }
        weather = value
    }

    private func optionalDog(userID: String) async -> DogProfile? {
        try? await profileRepository?.fetchPrimaryDog(userID: userID)
    }

    private func optionalLikes(userID: String) async -> [SpotLike]? {
        try? await activityRepository?.fetchLikes(userID: userID)
    }

    private func persistConditions() {
        guard let data = try? JSONEncoder().encode(conditions) else { return }
        defaults.set(data, forKey: Self.conditionsKey)
    }

    private func reconcileSelection() {
        guard let selectedPlaceID else { return }
        if !spots.contains(where: { $0.placeID == selectedPlaceID }) {
            self.selectedPlaceID = nil
        }
    }
}

private enum MapSearchStoreError: Error {
    case missingSpotID
}
