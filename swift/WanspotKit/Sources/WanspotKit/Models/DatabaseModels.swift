import Foundation

public struct UserProfile: Codable, Equatable, Sendable {
    public let id: String
    public let name: String?
    public let parentType: String?
    public let birthday: String?
    public let bio: String?
    public let photoURL: URL?
    public let walkArea: String?
    public let walkAreaTags: [String]?

    public init(
        id: String,
        name: String?,
        parentType: String?,
        birthday: String?,
        bio: String?,
        photoURL: URL?,
        walkArea: String?,
        walkAreaTags: [String]?
    ) {
        self.id = id
        self.name = name
        self.parentType = parentType
        self.birthday = birthday
        self.bio = bio
        self.photoURL = photoURL
        self.walkArea = walkArea
        self.walkAreaTags = walkAreaTags
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case parentType = "parent_type"
        case birthday
        case bio
        case photoURL = "photo_url"
        case walkArea = "walk_area"
        case walkAreaTags = "walk_area_tags"
    }
}

public enum DogGender: String, Codable, Equatable, Sendable {
    case male
    case female
}

public enum DogSize: String, Codable, Equatable, Sendable {
    case extraSmall = "XS"
    case small = "S"
    case medium = "M"
    case large = "L"
    case extraLarge = "XL"
}

public struct DogProfile: Codable, Equatable, Sendable {
    public let id: String
    public let userID: String
    public let name: String
    public let breed: String?
    public let birthday: String?
    public let gender: DogGender?
    public let size: DogSize?
    public let rabiesVaccinatedAt: String?
    public let vaccineVaccinatedAt: String?
    public let photoURL: URL?
    public let rabiesVaccinated: Bool?
    public let vaccineVaccinated: Bool?
    public let walkAreaTags: [String]?
    public let isPrimary: Bool?

    public init(
        id: String,
        userID: String,
        name: String,
        breed: String?,
        birthday: String?,
        gender: DogGender?,
        size: DogSize?,
        rabiesVaccinatedAt: String?,
        vaccineVaccinatedAt: String?,
        photoURL: URL?,
        rabiesVaccinated: Bool?,
        vaccineVaccinated: Bool?,
        walkAreaTags: [String]?,
        isPrimary: Bool?
    ) {
        self.id = id
        self.userID = userID
        self.name = name
        self.breed = breed
        self.birthday = birthday
        self.gender = gender
        self.size = size
        self.rabiesVaccinatedAt = rabiesVaccinatedAt
        self.vaccineVaccinatedAt = vaccineVaccinatedAt
        self.photoURL = photoURL
        self.rabiesVaccinated = rabiesVaccinated
        self.vaccineVaccinated = vaccineVaccinated
        self.walkAreaTags = walkAreaTags
        self.isPrimary = isPrimary
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case name
        case breed
        case birthday
        case gender
        case size
        case rabiesVaccinatedAt = "rabies_vaccinated_at"
        case vaccineVaccinatedAt = "vaccine_vaccinated_at"
        case photoURL = "photo_url"
        case rabiesVaccinated = "rabies_vaccinated"
        case vaccineVaccinated = "vaccine_vaccinated"
        case walkAreaTags = "walk_area_tags"
        case isPrimary = "is_primary"
    }
}

public struct DogPhoto: Codable, Equatable, Sendable {
    public let id: String
    public let userID: String
    public let imageURL: URL
    public let storagePath: String
    public let takenOn: String
    public let createdAt: String

    private enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case imageURL = "image_url"
        case storagePath = "storage_path"
        case takenOn = "taken_on"
        case createdAt = "created_at"
    }
}

public struct SpotLike: Codable, Equatable, Sendable {
    public let spotID: String
    public let createdAt: String?

    public init(spotID: String, createdAt: String?) {
        self.spotID = spotID
        self.createdAt = createdAt
    }

    private enum CodingKeys: String, CodingKey {
        case spotID = "spot_id"
        case createdAt = "created_at"
    }
}

public struct CheckIn: Codable, Equatable, Sendable {
    public let id: String?
    public let spotID: String
    public let createdAt: String?

    public init(id: String?, spotID: String, createdAt: String?) {
        self.id = id
        self.spotID = spotID
        self.createdAt = createdAt
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case spotID = "spot_id"
        case createdAt = "created_at"
    }
}

public enum DailyLogContext: String, Codable, Equatable, Sendable {
    case walk
    case meal
    case nap
    case home
    case outing
    case event
}

public enum DailyLogMood: String, Codable, Equatable, Sendable {
    case happy
    case excited
    case relaxed
    case sleepy
    case yummy
}

public enum VisitSource: String, Codable, Equatable, Sendable {
    case detailButton = "detail_button"
    case review
    case checkin
    case other
}

public struct Visit: Codable, Equatable, Sendable {
    public let id: String
    public let userID: String
    public let spotID: String?
    public let visitedAt: String
    public let comment: String?
    public let rating: Int?
    public let context: DailyLogContext?
    public let mood: DailyLogMood?
    public let source: VisitSource?
    public let isSoftDeleted: Bool
    public let createdAt: String

    private enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case spotID = "spot_id"
        case visitedAt = "visited_at"
        case comment
        case rating
        case context
        case mood
        case source
        case isSoftDeleted = "soft_deleted"
        case createdAt = "created_at"
    }
}

public enum FieldPatch<Value: Sendable>: Sendable {
    case unchanged
    case set(Value)
    case clear
}

public struct VisitPatch: Sendable {
    public var comment: FieldPatch<String>
    public var rating: FieldPatch<Int>
    public var visitedAt: FieldPatch<String>
    public var spotID: FieldPatch<String>

    public init(
        comment: FieldPatch<String> = .unchanged,
        rating: FieldPatch<Int> = .unchanged,
        visitedAt: FieldPatch<String> = .unchanged,
        spotID: FieldPatch<String> = .unchanged
    ) {
        self.comment = comment
        self.rating = rating
        self.visitedAt = visitedAt
        self.spotID = spotID
    }
}

public enum MemoryMediaType: String, Codable, Equatable, Sendable {
    case image
    case video
}

public struct Memory: Codable, Equatable, Sendable {
    public let id: String
    public let userID: String
    public let visitID: String
    public let spotID: String?
    public let mediaPath: String
    public let mediaType: MemoryMediaType
    public let thumbnailPath: String?
    public let isSoftDeleted: Bool
    public let createdAt: String

    private enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case visitID = "visit_id"
        case spotID = "spot_id"
        case mediaPath = "media_url"
        case mediaType = "media_type"
        case thumbnailPath = "thumbnail_url"
        case isSoftDeleted = "soft_deleted"
        case createdAt = "created_at"
    }
}

public enum UserEventType: String, Codable, Equatable, Sendable {
    case visit
    case like
    case unlike
    case review
    case spotView = "spot_view"
    case search
    case aiPlanGenerate = "ai_plan_generate"
    case aiPlanAdopted = "ai_plan_adopted"
    case vlogGenerate = "vlog_generate"
    case share
    case appOpen = "app_open"
    case mapView = "map_view"
    case areaSearch = "area_search"
    case eventView = "event_view"
    case loginPrompt = "login_prompt"
}

public struct UserEvent: Encodable, Equatable, Sendable {
    public let eventType: UserEventType
    public let anonymousID: String
    public let properties: [String: JSONValue]
    public let userID: String?
    public let spotID: String?
    public let latitude: Double?
    public let longitude: Double?
    public let dogBreed: String?
    public let dogSize: DogSize?
    public let dogID: String?
    public let dogAgeMonths: Int?
    public let platform: String?
    public let appVersion: String?
    public let sessionID: String?

    public init(
        eventType: UserEventType,
        anonymousID: String,
        properties: [String: JSONValue] = [:],
        userID: String? = nil,
        spotID: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        dogBreed: String? = nil,
        dogSize: DogSize? = nil,
        dogID: String? = nil,
        dogAgeMonths: Int? = nil,
        platform: String? = nil,
        appVersion: String? = nil,
        sessionID: String? = nil
    ) {
        self.eventType = eventType
        self.anonymousID = anonymousID
        var properties = properties
        properties["anonymous_id"] = .string(anonymousID)
        properties["is_guest"] = .bool(userID == nil)
        self.properties = properties
        self.userID = userID
        self.spotID = spotID
        self.latitude = latitude
        self.longitude = longitude
        self.dogBreed = dogBreed
        self.dogSize = dogSize
        self.dogID = dogID
        self.dogAgeMonths = dogAgeMonths
        self.platform = platform
        self.appVersion = appVersion
        self.sessionID = sessionID
    }

    private enum CodingKeys: String, CodingKey {
        case eventType = "event_type"
        case anonymousID = "anonymous_id"
        case properties = "props"
        case userID = "user_id"
        case spotID = "spot_id"
        case latitude = "lat"
        case longitude = "lng"
        case dogBreed = "dog_breed"
        case dogSize = "dog_size"
        case dogID = "dog_id"
        case dogAgeMonths = "dog_age_months"
        case platform
        case appVersion = "app_version"
        case sessionID = "session_id"
    }
}
