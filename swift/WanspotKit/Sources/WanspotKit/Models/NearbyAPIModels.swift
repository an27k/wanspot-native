import Foundation

public struct NearbySpotsResponse: Decodable, Equatable, Sendable {
    public let spots: [PlaceResult]
    public let error: String?

    public init(spots: [PlaceResult], error: String? = nil) {
        self.spots = spots
        self.error = error
    }
}

public struct SpotSearchCenter: Codable, Equatable, Sendable {
    public let latitude: Double
    public let longitude: Double
    public let source: String

    public init(latitude: Double, longitude: Double, source: String) {
        self.latitude = latitude
        self.longitude = longitude
        self.source = source
    }

    public var coordinate: NearbyCoordinate {
        NearbyCoordinate(latitude: latitude, longitude: longitude)
    }

    private enum CodingKeys: String, CodingKey {
        case latitude = "lat"
        case longitude = "lng"
        case source
    }
}

public struct SpotSearchResponse: Decodable, Equatable, Sendable {
    public let spots: [PlaceResult]
    public let searchCenter: SpotSearchCenter?

    public init(
        spots: [PlaceResult],
        searchCenter: SpotSearchCenter?
    ) {
        self.spots = spots
        self.searchCenter = searchCenter
    }

    private enum CodingKeys: String, CodingKey {
        case spots
        case searchCenter = "search_center"
    }
}

public struct PlacePrediction: Codable, Equatable, Identifiable, Sendable {
    public let placeID: String
    public let description: String
    public let mainText: String
    public let secondaryText: String

    public var id: String { placeID }

    public init(
        placeID: String,
        description: String,
        mainText: String,
        secondaryText: String
    ) {
        self.placeID = placeID
        self.description = description
        self.mainText = mainText
        self.secondaryText = secondaryText
    }

    private enum CodingKeys: String, CodingKey {
        case placeID = "place_id"
        case description
        case mainText = "main_text"
        case secondaryText = "secondary_text"
    }
}

public struct PlaceAutocompleteResponse: Decodable, Equatable, Sendable {
    public let predictions: [PlacePrediction]

    public init(predictions: [PlacePrediction]) {
        self.predictions = predictions
    }
}

public struct ResolvedPlace: Codable, Equatable, Sendable {
    public let latitude: Double
    public let longitude: Double
    public let name: String

    public init(latitude: Double, longitude: Double, name: String) {
        self.latitude = latitude
        self.longitude = longitude
        self.name = name
    }

    public var coordinate: NearbyCoordinate {
        NearbyCoordinate(latitude: latitude, longitude: longitude)
    }

    private enum CodingKeys: String, CodingKey {
        case latitude = "lat"
        case longitude = "lng"
        case name
    }
}

public struct EnsureSpotResponse: Decodable, Equatable, Sendable {
    public struct Spot: Decodable, Equatable, Sendable {
        public let id: String?
        public let placeID: String?
        public let name: String?
        public let category: String?
        public let address: String?

        private enum CodingKeys: String, CodingKey {
            case id
            case placeID = "place_id"
            case name
            case category
            case address
        }
    }

    public let id: String?
    public let spot: Spot?

    public init(id: String?, spot: Spot?) {
        self.id = id
        self.spot = spot
    }

    public var resolvedID: String? {
        id ?? spot?.id
    }
}

public enum SpotColumnSet: String, Codable, Equatable, Sendable {
    case list
    case card
    case geo
    case minimal
}

public struct PublicSpot: Codable, Equatable, Sendable {
    public let id: String?
    public let placeID: String?
    public let name: String?
    public let category: String?
    public let address: String?
    public let formattedAddress: String?
    public let vicinity: String?
    public let latitude: Double?
    public let longitude: Double?
    public let rating: Double?
    public let userRatingsTotal: Int?
    public let priceLevel: Int?
    public let priceLabel: String?
    public let photoReference: String?
    /// 詳細ギャラリー用。無い・空なら `photoReference` だけを使う。
    public let photoReferences: [String]?
    public let types: [String]?
    public let municipality: String?
    public let prefecture: String?
    public let distanceMeters: Double?
    public let petIndoorAllowed: Bool?
    public let petTerraceOnly: Bool?
    public let petFriendlyStatus: String?
    public let petFriendlyNotes: String?
    public let petFriendlyVerified: Bool?
    public let petSizeLimit: String?
    public let petReservationRequired: Bool?
    public let dogInteraction: String?
    public let extendedCategory: String?
    public let petPolicyEvidence: String?
    public let openingHours: PlaceOpeningHours?
    public let instagramID: String?
    public let instagramLookupDue: Bool?
    public let dogFactHighlights: [String]?

    public var bestAddress: String? {
        address ?? formattedAddress ?? vicinity
    }

    public var placeResult: PlaceResult? {
        guard
            let placeID,
            let latitude,
            let longitude
        else {
            return nil
        }
        return PlaceResult(
            placeID: placeID,
            name: name ?? "",
            category: category ?? "",
            latitude: latitude,
            longitude: longitude,
            address: bestAddress ?? "",
            photoReference: photoReference,
            rating: rating,
            userRatingsTotal: userRatingsTotal,
            priceLevel: priceLevel,
            priceLabel: priceLabel,
            types: types,
            vicinity: vicinity,
            petIndoorAllowed: petIndoorAllowed,
            extendedCategory: extendedCategory,
            petPolicyEvidence: petPolicyEvidence,
            openingHours: openingHours,
            petTerraceOnly: petTerraceOnly,
            petFriendlyStatus: petFriendlyStatus,
            petFriendlyNotes: petFriendlyNotes,
            petFriendlyVerified: petFriendlyVerified,
            dogInteraction: dogInteraction,
            petSizeLimit: petSizeLimit,
            petReservationRequired: petReservationRequired,
            spotID: id
        )
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case placeID = "place_id"
        case name
        case category
        case address
        case formattedAddress = "formatted_address"
        case vicinity
        case latitude = "lat"
        case longitude = "lng"
        case rating
        case userRatingsTotal = "user_ratings_total"
        case priceLevel = "price_level"
        case priceLabel = "price_label"
        case photoReference = "photo_ref"
        case photoReferences = "photo_refs"
        case types
        case municipality
        case prefecture
        case distanceMeters = "distance_m"
        case petIndoorAllowed = "pet_indoor_allowed"
        case petTerraceOnly = "pet_terrace_only"
        case petFriendlyStatus = "pet_friendly_status"
        case petFriendlyNotes = "pet_friendly_notes"
        case petFriendlyVerified = "pet_friendly_verified"
        case petSizeLimit = "pet_size_limit"
        case petReservationRequired = "pet_reservation_required"
        case dogInteraction = "dog_interaction"
        case extendedCategory = "extended_category"
        case petPolicyEvidence = "pet_policy_evidence"
        case openingHours = "opening_hours"
        case instagramID = "instagram_id"
        case instagramLookupDue = "instagram_lookup_due"
        case dogFactHighlights = "dog_fact_highlights"
    }
}

public struct SpotsByIDsResponse: Decodable, Equatable, Sendable {
    public let spots: [PublicSpot]

    public init(spots: [PublicSpot]) {
        self.spots = spots
    }
}

public struct BatchPlaceDetail: Codable, Equatable, Sendable {
    public let photoReference: String?
    public let photoReferences: [String]?
    public let rating: Double?
    public let userRatingsTotal: Int?
    public let priceLevel: Int?
    public let priceLabel: String?
    public let formattedAddress: String?
    public let vicinity: String?

    public init(
        photoReference: String?,
        photoReferences: [String]? = nil,
        rating: Double?,
        userRatingsTotal: Int?,
        priceLevel: Int?,
        priceLabel: String?,
        formattedAddress: String?,
        vicinity: String?
    ) {
        self.photoReference = photoReference
        self.photoReferences = photoReferences
        self.rating = rating
        self.userRatingsTotal = userRatingsTotal
        self.priceLevel = priceLevel
        self.priceLabel = priceLabel
        self.formattedAddress = formattedAddress
        self.vicinity = vicinity
    }

    private enum CodingKeys: String, CodingKey {
        case photoReference = "photo_ref"
        case photoReferences = "photo_refs"
        case rating
        case userRatingsTotal = "user_ratings_total"
        case priceLevel = "price_level"
        case priceLabel = "price_label"
        case formattedAddress = "formatted_address"
        case vicinity
    }
}

public struct BatchDetailsResponse: Decodable, Equatable, Sendable {
    public let details: [String: BatchPlaceDetail]

    public init(details: [String: BatchPlaceDetail]) {
        self.details = details
    }
}

public struct SpotPhoto: Equatable, Sendable {
    public let data: Data
    public let contentType: String

    public init(data: Data, contentType: String) {
        self.data = data
        self.contentType = contentType
    }
}

public enum SpotPhotoWidth: Int, Codable, Equatable, Sendable {
    case card = 400
    case detail = 800
}
