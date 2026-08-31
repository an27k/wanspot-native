import Foundation

public struct SpotDetailOpeningHours: Equatable, Sendable {
    public let weekdayText: [String]
    public let openNow: Bool?
    public let periods: [OpeningPeriod]

    public init(
        weekdayText: [String] = [],
        openNow: Bool? = nil,
        periods: [OpeningPeriod] = []
    ) {
        self.weekdayText = weekdayText
        self.openNow = openNow
        self.periods = periods
    }
}

extension SpotDetailOpeningHours: Decodable {
    private enum CodingKeys: String, CodingKey {
        case weekdayText = "weekday_text"
        case weekdayTextCamel = "weekdayText"
        case openNow = "open_now"
        case openNowCamel = "openNow"
        case periods
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        weekdayText =
            (try? container.decode([String].self, forKey: .weekdayText))
                ?? (try? container.decode([String].self, forKey: .weekdayTextCamel))
                ?? []
        openNow =
            container.decodeFlexibleBoolIfPresent(forKey: .openNow)
                ?? container.decodeFlexibleBoolIfPresent(forKey: .openNowCamel)
        periods =
            (try? container.decode([OpeningPeriod].self, forKey: .periods))
                ?? []
    }
}

public struct SpotPlaceDetail: Equatable, Sendable {
    public let name: String?
    public let rating: Double?
    public let userRatingsTotal: Int?
    public let priceLevel: Int?
    public let priceLabel: String?
    public let formattedAddress: String?
    public let vicinity: String?
    public let formattedPhoneNumber: String?
    public let openingHours: SpotDetailOpeningHours?
    public let photoReferences: [String]
    public let websiteURL: URL?
    public let googleMapsURL: URL?
    public let reviews: [String]
    public let types: [String]
    public let latitude: Double?
    public let longitude: Double?

    public init(
        name: String? = nil,
        rating: Double? = nil,
        userRatingsTotal: Int? = nil,
        priceLevel: Int? = nil,
        priceLabel: String? = nil,
        formattedAddress: String? = nil,
        vicinity: String? = nil,
        formattedPhoneNumber: String? = nil,
        openingHours: SpotDetailOpeningHours? = nil,
        photoReferences: [String] = [],
        websiteURL: URL? = nil,
        googleMapsURL: URL? = nil,
        reviews: [String] = [],
        types: [String] = [],
        latitude: Double? = nil,
        longitude: Double? = nil
    ) {
        self.name = name
        self.rating = rating
        self.userRatingsTotal = userRatingsTotal
        self.priceLevel = priceLevel
        self.priceLabel = priceLabel
        self.formattedAddress = formattedAddress
        self.vicinity = vicinity
        self.formattedPhoneNumber = formattedPhoneNumber
        self.openingHours = openingHours
        self.photoReferences = photoReferences
        self.websiteURL = websiteURL
        self.googleMapsURL = googleMapsURL
        self.reviews = reviews
        self.types = types
        self.latitude = latitude
        self.longitude = longitude
    }
}

extension SpotPlaceDetail: Decodable {
    private enum CodingKeys: String, CodingKey {
        case name
        case rating
        case userRatingsTotal = "user_ratings_total"
        case userRatingsTotalCamel = "userRatingsTotal"
        case priceLevel = "price_level"
        case priceLevelCamel = "priceLevel"
        case priceLabel = "price_label"
        case priceLabelCamel = "priceLabel"
        case formattedAddress = "formatted_address"
        case formattedAddressCamel = "formattedAddress"
        case vicinity
        case formattedPhoneNumber = "formatted_phone_number"
        case formattedPhoneNumberCamel = "formattedPhoneNumber"
        case openingHours = "opening_hours"
        case openingHoursCamel = "openingHours"
        case photos
        case website
        case url
        case googleMapsURL = "google_maps_url"
        case reviews
        case types
        case geometry
        case latitude = "lat"
        case longitude = "lng"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let geometry = try? container.decode(
            SpotDetailGeometry.self,
            forKey: .geometry
        )

        name = container.decodeTrimmedStringIfPresent(forKey: .name)
        rating = container.decodeFlexibleDoubleIfPresent(forKey: .rating)
        userRatingsTotal =
            container.decodeFlexibleIntIfPresent(forKey: .userRatingsTotal)
                ?? container.decodeFlexibleIntIfPresent(forKey: .userRatingsTotalCamel)
        priceLevel =
            container.decodeFlexibleIntIfPresent(forKey: .priceLevel)
                ?? container.decodeFlexibleIntIfPresent(forKey: .priceLevelCamel)
        priceLabel =
            container.decodeTrimmedStringIfPresent(forKey: .priceLabel)
                ?? container.decodeTrimmedStringIfPresent(forKey: .priceLabelCamel)
        formattedAddress =
            container.decodeTrimmedStringIfPresent(forKey: .formattedAddress)
                ?? container.decodeTrimmedStringIfPresent(forKey: .formattedAddressCamel)
        vicinity = container.decodeTrimmedStringIfPresent(forKey: .vicinity)
        formattedPhoneNumber =
            container.decodeTrimmedStringIfPresent(forKey: .formattedPhoneNumber)
                ?? container.decodeTrimmedStringIfPresent(forKey: .formattedPhoneNumberCamel)
        openingHours =
            (try? container.decode(
                SpotDetailOpeningHours.self,
                forKey: .openingHours
            ))
                ?? (try? container.decode(
                    SpotDetailOpeningHours.self,
                    forKey: .openingHoursCamel
                ))
        photoReferences =
            ((try? container.decode(
                [SpotDetailPhotoReference].self,
                forKey: .photos
            )) ?? [])
            .compactMap(\.value)
            .uniqued()
        websiteURL = container.decodeURLIfPresent(forKey: .website)
        googleMapsURL =
            container.decodeURLIfPresent(forKey: .url)
                ?? container.decodeURLIfPresent(forKey: .googleMapsURL)
        reviews =
            ((try? container.decode(
                [SpotDetailReview].self,
                forKey: .reviews
            )) ?? [])
            .compactMap(\.text)
        types =
            ((try? container.decode([String].self, forKey: .types)) ?? [])
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        latitude =
            geometry?.location?.latitude
                ?? container.decodeFlexibleDoubleIfPresent(forKey: .latitude)
        longitude =
            geometry?.location?.longitude
                ?? container.decodeFlexibleDoubleIfPresent(forKey: .longitude)
    }
}

public struct SpotDetail: Identifiable, Equatable, Sendable {
    public let routeID: String
    public let spotID: String?
    public let placeID: String
    public let name: String
    public let category: String
    public let address: String?
    public let latitude: Double?
    public let longitude: Double?
    public let photoReferences: [String]
    public let rating: Double?
    public let userRatingsTotal: Int?
    public let priceLevel: Int?
    public let priceLabel: String?
    public let openingHours: SpotDetailOpeningHours?
    public let reviews: [String]
    public let formattedPhoneNumber: String?
    public let websiteURL: URL?
    public let googleMapsURL: URL?
    public let instagramID: String?
    public let dogFactHighlights: [String]
    public let petIndoorAllowed: Bool?
    public let petTerraceOnly: Bool?
    public let petFriendlyStatus: String?
    public let petFriendlyVerified: Bool?
    public let petPolicyEvidence: String?
    public let petSizeLimit: String?
    public let petReservationRequired: Bool?
    public let dogInteraction: String?

    public var id: String { spotID ?? routeID }

    public init(
        routeID: String,
        spotID: String? = nil,
        placeID: String,
        name: String,
        category: String,
        address: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        photoReferences: [String] = [],
        rating: Double? = nil,
        userRatingsTotal: Int? = nil,
        priceLevel: Int? = nil,
        priceLabel: String? = nil,
        openingHours: SpotDetailOpeningHours? = nil,
        reviews: [String] = [],
        formattedPhoneNumber: String? = nil,
        websiteURL: URL? = nil,
        googleMapsURL: URL? = nil,
        instagramID: String? = nil,
        dogFactHighlights: [String] = [],
        petIndoorAllowed: Bool? = nil,
        petTerraceOnly: Bool? = nil,
        petFriendlyStatus: String? = nil,
        petFriendlyVerified: Bool? = nil,
        petPolicyEvidence: String? = nil,
        petSizeLimit: String? = nil,
        petReservationRequired: Bool? = nil,
        dogInteraction: String? = nil
    ) {
        self.routeID = routeID
        self.spotID = spotID
        self.placeID = placeID
        self.name = name
        self.category = category
        self.address = address
        self.latitude = latitude
        self.longitude = longitude
        self.photoReferences = photoReferences.uniqued()
        self.rating = rating
        self.userRatingsTotal = userRatingsTotal
        self.priceLevel = priceLevel
        self.priceLabel = priceLabel
        self.openingHours = openingHours
        self.reviews = reviews
        self.formattedPhoneNumber = formattedPhoneNumber
        self.websiteURL = websiteURL
        self.googleMapsURL = googleMapsURL
        self.instagramID = instagramID
        self.dogFactHighlights = dogFactHighlights
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .prefix(3)
            .map(\.self)
        self.petIndoorAllowed = petIndoorAllowed
        self.petTerraceOnly = petTerraceOnly
        self.petFriendlyStatus = petFriendlyStatus
        self.petFriendlyVerified = petFriendlyVerified
        self.petPolicyEvidence = petPolicyEvidence
        self.petSizeLimit = petSizeLimit
        self.petReservationRequired = petReservationRequired
        self.dogInteraction = dogInteraction
    }

    public var coordinate: NearbyCoordinate? {
        guard
            let latitude,
            let longitude,
            latitude.isFinite,
            longitude.isFinite,
            (-90 ... 90).contains(latitude),
            (-180 ... 180).contains(longitude)
        else {
            return nil
        }
        return NearbyCoordinate(latitude: latitude, longitude: longitude)
    }

    public func replacingSpotID(_ spotID: String) -> Self {
        Self(
            routeID: routeID,
            spotID: spotID,
            placeID: placeID,
            name: name,
            category: category,
            address: address,
            latitude: latitude,
            longitude: longitude,
            photoReferences: photoReferences,
            rating: rating,
            userRatingsTotal: userRatingsTotal,
            priceLevel: priceLevel,
            priceLabel: priceLabel,
            openingHours: openingHours,
            reviews: reviews,
            formattedPhoneNumber: formattedPhoneNumber,
            websiteURL: websiteURL,
            googleMapsURL: googleMapsURL,
            instagramID: instagramID,
            dogFactHighlights: dogFactHighlights,
            petIndoorAllowed: petIndoorAllowed,
            petTerraceOnly: petTerraceOnly,
            petFriendlyStatus: petFriendlyStatus,
            petFriendlyVerified: petFriendlyVerified,
            petPolicyEvidence: petPolicyEvidence,
            petSizeLimit: petSizeLimit,
            petReservationRequired: petReservationRequired,
            dogInteraction: dogInteraction
        )
    }
}

private struct SpotDetailGeometry: Decodable {
    struct Location: Decodable {
        let latitude: Double?
        let longitude: Double?

        private enum CodingKeys: String, CodingKey {
            case latitude = "lat"
            case longitude = "lng"
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            latitude = container.decodeFlexibleDoubleIfPresent(forKey: .latitude)
            longitude = container.decodeFlexibleDoubleIfPresent(forKey: .longitude)
        }
    }

    let location: Location?
}

private struct SpotDetailPhotoReference: Decodable {
    let value: String?

    private enum CodingKeys: String, CodingKey {
        case photoReference = "photo_reference"
        case photoReferenceCamel = "photoReference"
        case reference
    }

    init(from decoder: Decoder) throws {
        if
            let container = try? decoder.singleValueContainer(),
            let string = try? container.decode(String.self)
        {
            value = string.nonEmptyTrimmed
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        value =
            container.decodeTrimmedStringIfPresent(forKey: .photoReference)
                ?? container.decodeTrimmedStringIfPresent(forKey: .photoReferenceCamel)
                ?? container.decodeTrimmedStringIfPresent(forKey: .reference)
    }
}

private struct SpotDetailReview: Decodable {
    let text: String?

    private enum CodingKeys: String, CodingKey {
        case text
        case review
    }

    init(from decoder: Decoder) throws {
        if
            let container = try? decoder.singleValueContainer(),
            let string = try? container.decode(String.self)
        {
            text = string.nonEmptyTrimmed
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        text =
            container.decodeTrimmedStringIfPresent(forKey: .text)
                ?? container.decodeTrimmedStringIfPresent(forKey: .review)
    }
}

private extension KeyedDecodingContainer {
    func decodeFlexibleDoubleIfPresent(forKey key: Key) -> Double? {
        if let value = try? decode(Double.self, forKey: key) {
            return value.isFinite ? value : nil
        }
        if let value = try? decode(Int.self, forKey: key) {
            return Double(value)
        }
        if
            let value = try? decode(String.self, forKey: key),
            let number = Double(value.trimmingCharacters(in: .whitespacesAndNewlines)),
            number.isFinite
        {
            return number
        }
        return nil
    }

    func decodeFlexibleIntIfPresent(forKey key: Key) -> Int? {
        if let value = try? decode(Int.self, forKey: key) {
            return value
        }
        if
            let value = decodeFlexibleDoubleIfPresent(forKey: key),
            value >= Double(Int.min),
            value <= Double(Int.max)
        {
            return Int(value.rounded())
        }
        return nil
    }

    func decodeFlexibleBoolIfPresent(forKey key: Key) -> Bool? {
        if let value = try? decode(Bool.self, forKey: key) {
            return value
        }
        if let value = try? decode(Int.self, forKey: key) {
            return value != 0
        }
        if let value = try? decode(String.self, forKey: key) {
            switch value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
            case "true", "1":
                return true
            case "false", "0":
                return false
            default:
                return nil
            }
        }
        return nil
    }

    func decodeTrimmedStringIfPresent(forKey key: Key) -> String? {
        guard let value = try? decode(String.self, forKey: key) else {
            return nil
        }
        return value.nonEmptyTrimmed
    }

    func decodeURLIfPresent(forKey key: Key) -> URL? {
        guard let value = decodeTrimmedStringIfPresent(forKey: key) else {
            return nil
        }
        return URL(string: value)
    }
}

private extension String {
    var nonEmptyTrimmed: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

private extension Sequence where Element == String {
    func uniqued() -> [String] {
        var seen = Set<String>()
        return compactMap { value in
            let value = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty, seen.insert(value).inserted else { return nil }
            return value
        }
    }
}
