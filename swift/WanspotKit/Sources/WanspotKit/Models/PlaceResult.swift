import Foundation

public struct PlaceOpeningHours: Codable, Equatable, Sendable {
    public let periods: [OpeningPeriod]?

    public init(periods: [OpeningPeriod]?) {
        self.periods = periods
    }
}

public struct PlaceResult: Codable, Equatable, Identifiable, Sendable {
    public let spotID: String?
    public let placeID: String
    public let name: String
    public let category: String
    public let latitude: Double
    public let longitude: Double
    public let address: String
    public let photoReference: String?
    public let rating: Double?
    public let userRatingsTotal: Int?
    public let priceLevel: Int?
    public let priceLabel: String?
    public let types: [String]?
    public let vicinity: String?
    public let petIndoorAllowed: Bool?
    public let extendedCategory: String?
    public let petPolicyEvidence: String?
    public let openingHours: PlaceOpeningHours?
    public let petTerraceOnly: Bool?
    public let petFriendlyStatus: String?
    public let petFriendlyNotes: String?
    public let petFriendlyVerified: Bool?
    public let dogInteraction: String?
    public let petSizeLimit: String?
    public let petReservationRequired: Bool?

    public var id: String { placeID }

    public init(
        placeID: String,
        name: String,
        category: String,
        latitude: Double,
        longitude: Double,
        address: String,
        photoReference: String? = nil,
        rating: Double? = nil,
        userRatingsTotal: Int? = nil,
        priceLevel: Int? = nil,
        priceLabel: String? = nil,
        types: [String]? = nil,
        vicinity: String? = nil,
        petIndoorAllowed: Bool? = nil,
        extendedCategory: String? = nil,
        petPolicyEvidence: String? = nil,
        openingHours: PlaceOpeningHours? = nil,
        petTerraceOnly: Bool? = nil,
        petFriendlyStatus: String? = nil,
        petFriendlyNotes: String? = nil,
        petFriendlyVerified: Bool? = nil,
        dogInteraction: String? = nil,
        petSizeLimit: String? = nil,
        petReservationRequired: Bool? = nil,
        spotID: String? = nil
    ) {
        self.spotID = spotID
        self.placeID = placeID
        self.name = name
        self.category = category
        self.latitude = latitude
        self.longitude = longitude
        self.address = address
        self.photoReference = photoReference
        self.rating = rating
        self.userRatingsTotal = userRatingsTotal
        self.priceLevel = priceLevel
        self.priceLabel = priceLabel
        self.types = types
        self.vicinity = vicinity
        self.petIndoorAllowed = petIndoorAllowed
        self.extendedCategory = extendedCategory
        self.petPolicyEvidence = petPolicyEvidence
        self.openingHours = openingHours
        self.petTerraceOnly = petTerraceOnly
        self.petFriendlyStatus = petFriendlyStatus
        self.petFriendlyNotes = petFriendlyNotes
        self.petFriendlyVerified = petFriendlyVerified
        self.dogInteraction = dogInteraction
        self.petSizeLimit = petSizeLimit
        self.petReservationRequired = petReservationRequired
    }

    private enum CodingKeys: String, CodingKey {
        case spotID = "id"
        case placeID = "place_id"
        case name
        case category
        case latitude = "lat"
        case longitude = "lng"
        case address
        case photoReference = "photo_ref"
        case rating
        case userRatingsTotal = "user_ratings_total"
        case priceLevel = "price_level"
        case priceLabel = "price_label"
        case types
        case vicinity
        case petIndoorAllowed = "pet_indoor_allowed"
        case extendedCategory = "extended_category"
        case petPolicyEvidence = "pet_policy_evidence"
        case openingHours = "opening_hours"
        case petTerraceOnly = "pet_terrace_only"
        case petFriendlyStatus = "pet_friendly_status"
        case petFriendlyNotes = "pet_friendly_notes"
        case petFriendlyVerified = "pet_friendly_verified"
        case dogInteraction = "dog_interaction"
        case petSizeLimit = "pet_size_limit"
        case petReservationRequired = "pet_reservation_required"
    }
}

public extension PlaceResult {
    var coordinate: NearbyCoordinate {
        NearbyCoordinate(latitude: latitude, longitude: longitude)
    }

    func replacingCategory(_ value: String) -> PlaceResult {
        PlaceResult(
            placeID: placeID,
            name: name,
            category: value,
            latitude: latitude,
            longitude: longitude,
            address: address,
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
            spotID: spotID
        )
    }
}
