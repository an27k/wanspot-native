import Foundation

public struct AISummaryRequest: Encodable, Equatable, Sendable {
    public struct UserContext: Encodable, Equatable, Sendable {
        public let walkAreaTags: [String]
        public let latitude: Double?
        public let longitude: Double?

        public init(
            walkAreaTags: [String],
            latitude: Double?,
            longitude: Double?
        ) {
            self.walkAreaTags = walkAreaTags
            self.latitude = latitude
            self.longitude = longitude
        }

        private enum CodingKeys: String, CodingKey {
            case walkAreaTags
            case latitude = "lat"
            case longitude = "lng"
        }
    }

    public let placeID: String
    public let spotID: String?
    public let name: String
    public let category: String
    public let rating: Double?
    public let address: String?
    public let reviews: [String]?
    public let dogSize: String?
    public let dogBreed: String?
    public let dogName: String?
    public let userContext: UserContext?

    public init(
        placeID: String,
        spotID: String? = nil,
        name: String,
        category: String,
        rating: Double? = nil,
        address: String? = nil,
        reviews: [String]? = nil,
        dogSize: String? = nil,
        dogBreed: String? = nil,
        dogName: String? = nil,
        userContext: UserContext? = nil
    ) {
        self.placeID = placeID
        self.spotID = spotID
        self.name = name
        self.category = category
        self.rating = rating
        self.address = address
        self.reviews = reviews
        self.dogSize = dogSize
        self.dogBreed = dogBreed
        self.dogName = dogName
        self.userContext = userContext
    }

    private enum CodingKeys: String, CodingKey {
        case placeID = "place_id"
        case spotID = "spot_id"
        case name
        case category
        case rating
        case address
        case reviews
        case dogSize
        case dogBreed
        case dogName
        case userContext
    }
}

public struct WanspotRating: Decodable, Equatable, Sendable {
    public let average: Double
    public let count: Int

    private enum CodingKeys: String, CodingKey {
        case average = "avg"
        case count
    }
}

public enum AISummarySearchState: String, Decodable, Equatable, Sendable {
    case done
    case pending
}

public enum AISummaryEmptyReason: String, Equatable, Sendable {
    case noInformation = "no_information"
    case busy

    init(serverValue: String?) {
        self = serverValue == Self.noInformation.rawValue ? .noInformation : .busy
    }
}

public struct AISummary: Equatable, Sendable {
    public let keywords: [String]
    public let summary: String
    public let personalNote: String?
    public let wanspotRating: WanspotRating?
    public let searchState: AISummarySearchState?
}

public enum AISummaryOutcome: Equatable, Sendable {
    case summary(AISummary)
    case empty(AISummaryEmptyReason)
}

struct AISummaryWireResponse: Decodable, Sendable {
    let keywords: [String]?
    let summary: String?
    let personalNote: String?
    let wanspotRating: WanspotRating?
    let searchState: AISummarySearchState?
    let emptyReason: String?
}

public enum VlogMediaType: String, Codable, Equatable, Sendable {
    case image
    case video
}

public struct CloudQualityItem: Encodable, Equatable, Sendable {
    public let mediaID: String
    public let storagePath: String
    public let mediaType: VlogMediaType
    public let rating: Double?

    public init(
        mediaID: String,
        storagePath: String,
        mediaType: VlogMediaType,
        rating: Double? = nil
    ) {
        self.mediaID = mediaID
        self.storagePath = storagePath
        self.mediaType = mediaType
        self.rating = rating
    }

    private enum CodingKeys: String, CodingKey {
        case mediaID = "mediaId"
        case storagePath
        case mediaType
        case rating
    }
}

public struct CloudSetLogPatch: Decodable, Equatable, Sendable {
    public let blurScore: Double?
    public let brightnessScore: Double?
    public let cropFitScore: Double?
    public let emotionScore: Double?
    public let subjectDetected: Bool?
    public let analysisSource: String?
}

public enum CloudQualitySource: String, Decodable, Equatable, Sendable {
    case cloud
    case heuristic
    case rejected
}

public struct CloudQualityResult: Decodable, Equatable, Sendable {
    public let mediaID: String
    public let qualityScore: Double
    public let source: CloudQualitySource
    public let setLog: CloudSetLogPatch?

    private enum CodingKeys: String, CodingKey {
        case mediaID = "mediaId"
        case qualityScore
        case source
        case setLog
    }
}

struct CloudQualityWireResponse: Decodable, Sendable {
    let results: [CloudQualityResult]
}

public enum WalkAlertLevel: String, Codable, Equatable, Sendable {
    case numb
    case sting
    case chilly
    case comfortable
    case caution
    case danger
    case stop
}

public struct WalkLine: Equatable, Sendable {
    public let text: String
    public let conditionID: String
    public let hideWhenLevelAtOrAbove: WalkAlertLevel?

    public init(
        text: String,
        conditionID: String,
        hideWhenLevelAtOrAbove: WalkAlertLevel?
    ) {
        self.text = text
        self.conditionID = conditionID
        self.hideWhenLevelAtOrAbove = hideWhenLevelAtOrAbove
    }
}

struct WalkLineWireResponse: Decodable, Sendable {
    let line: String?
    let conditionID: String?
    let hideWhenLevelAtOrAbove: String?

    private enum CodingKeys: String, CodingKey {
        case line
        case conditionID = "conditionId"
        case hideWhenLevelAtOrAbove
    }
}

public struct VlogRenderResult: Decodable, Equatable, Sendable {
    public let videoURL: URL
    public let edlVersion: String

    private enum CodingKeys: String, CodingKey {
        case videoURL = "videoUrl"
        case edlVersion
    }
}

public enum VlogRenderFailureCode: String, Equatable, Sendable {
    case network
    case server
    case notReady = "not_ready"
}

public struct VlogRenderFailure: Equatable, Sendable {
    public let code: VlogRenderFailureCode
    public let message: String

    public init(code: VlogRenderFailureCode, message: String) {
        self.code = code
        self.message = message
    }
}

public enum VlogRenderOutcome: Equatable, Sendable {
    case success(VlogRenderResult)
    case failure(VlogRenderFailure)
}

public struct AccountDeleteResponse: Decodable, Equatable, Sendable {
    public let success: Bool
    public let alreadyDeleted: Bool?

    public init(success: Bool, alreadyDeleted: Bool? = nil) {
        self.success = success
        self.alreadyDeleted = alreadyDeleted
    }
}

struct ServerErrorResponse: Decodable, Sendable {
    let error: String?
    let message: String?

    init(from decoder: Decoder) throws {
        let root = try JSONValue(from: decoder)
        guard case let .object(object) = root else {
            error = nil
            message = nil
            return
        }
        error = Self.message(from: object["error"])
        message =
            Self.message(from: object["message"])
                ?? Self.message(from: object["detail"])
                ?? Self.message(from: object["msg"])
    }

    private static func message(from value: JSONValue?) -> String? {
        switch value {
        case let .string(value):
            let value = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return value.isEmpty ? nil : String(value.prefix(500))
        case let .object(object):
            return message(from: object["message"])
                ?? message(from: object["detail"])
                ?? message(from: object["description"])
                ?? message(from: object["error"])
        case let .array(values):
            return values.lazy.compactMap { message(from: $0) }.first
        case .bool, .integer, .number, .null, .none:
            return nil
        }
    }
}
