import Foundation

public struct NearbyCoordinate: Codable, Equatable, Hashable, Sendable {
    public let latitude: Double
    public let longitude: Double

    public init(latitude: Double, longitude: Double) {
        self.latitude = latitude
        self.longitude = longitude
    }
}

public enum NearbyGenre: String, CaseIterable, Codable, Equatable, Identifiable, Sendable {
    case cafe
    case park
    case restaurant
    case dogRun = "dog_run"
    case veterinaryCare = "veterinary_care"
    case petHotel = "pet_hotel"

    public var id: Self { self }

    public var label: String {
        switch self {
        case .cafe:
            "カフェ"
        case .park:
            "公園"
        case .restaurant:
            "レストラン"
        case .dogRun:
            "ドッグラン"
        case .veterinaryCare:
            "動物病院"
        case .petHotel:
            "ペットホテル"
        }
    }

    public var systemImage: String {
        switch self {
        case .cafe:
            "cup.and.saucer.fill"
        case .park:
            "leaf.fill"
        case .restaurant:
            "fork.knife"
        case .dogRun:
            "pawprint.fill"
        case .veterinaryCare:
            "cross.case.fill"
        case .petHotel:
            "bed.double.fill"
        }
    }
}

public struct NearbyConditionFilter: Codable, Equatable, Sendable {
    public var indoorOnly: Bool
    public var terraceOnly: Bool
    public var likedOnly: Bool

    public init(
        indoorOnly: Bool = false,
        terraceOnly: Bool = false,
        likedOnly: Bool = false
    ) {
        self.indoorOnly = indoorOnly
        self.terraceOnly = terraceOnly
        self.likedOnly = likedOnly
    }

    public var activeCount: Int {
        [indoorOnly, terraceOnly, likedOnly].filter(\.self).count
    }

    public static let empty = NearbyConditionFilter()
}

public enum NearbyTravelMode: String, Codable, Equatable, Sendable {
    case walking
    case driving
}

public struct NearbyWalkSituation: Codable, Equatable, Sendable {
    public let rainy: Bool
    public let dogSize: String?
    public let heatLevel: WalkAlertLevel?
    public let travel: NearbyTravelMode

    public init(
        rainy: Bool = false,
        dogSize: String? = nil,
        heatLevel: WalkAlertLevel? = nil,
        travel: NearbyTravelMode = .walking
    ) {
        self.rainy = rainy
        self.dogSize = dogSize
        self.heatLevel = heatLevel
        self.travel = travel
    }
}
