import Foundation

public struct CalendarMonth: Hashable, Codable, Sendable {
    public let year: Int
    public let month: Int

    public init(year: Int, month: Int) {
        let index = year * 12 + month - 1
        self.year = index / 12
        self.month = index % 12 + 1
    }

    public func adding(months: Int) -> Self {
        Self(year: year, month: month + months)
    }

    public var cacheKey: String {
        String(format: "%04d-%02d", year, month)
    }
}

public struct CalendarTag: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let slug: String
    public let color: String
    public let sortOrder: Int

    public init(
        id: String,
        name: String,
        slug: String = "",
        color: String = "#FB6B53",
        sortOrder: Int = 999
    ) {
        self.id = id
        self.name = name
        self.slug = slug
        self.color = color
        self.sortOrder = sortOrder
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case slug
        case color
        case sortOrder = "sort_order"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.requiredString(forKey: .id)
        name = try container.requiredString(forKey: .name)
        slug = container.trimmedString(forKey: .slug) ?? ""
        color = container.trimmedString(forKey: .color) ?? "#FB6B53"
        sortOrder = container.flexibleInt(forKey: .sortOrder) ?? 999
    }
}

public struct CalendarPrefecture: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let slug: String
    public let sortOrder: Int

    public init(id: String, name: String, slug: String, sortOrder: Int) {
        self.id = id
        self.name = name
        self.slug = slug
        self.sortOrder = sortOrder
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case slug
        case sortOrder = "sort_order"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.requiredString(forKey: .id)
        name = try container.requiredString(forKey: .name)
        slug = container.trimmedString(forKey: .slug) ?? ""
        sortOrder = container.flexibleInt(forKey: .sortOrder) ?? 999
    }
}

public struct CalendarEventOccurrence: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let eventID: String
    public let startsAt: Date
    public let endsAt: Date?
    public let isAllDay: Bool

    public init(
        id: String,
        eventID: String,
        startsAt: Date,
        endsAt: Date? = nil,
        isAllDay: Bool
    ) {
        self.id = id
        self.eventID = eventID
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.isAllDay = isAllDay
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case eventID = "event_id"
        case startsAt = "starts_at"
        case endsAt = "ends_at"
        case isAllDay = "is_all_day"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.requiredString(forKey: .id)
        eventID = container.trimmedString(forKey: .eventID) ?? ""
        startsAt = try container.requiredWireDate(forKey: .startsAt)
        endsAt = container.wireDate(forKey: .endsAt)
        isAllDay = container.flexibleBool(forKey: .isAllDay) ?? false
    }
}

public struct CalendarEvent: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let title: String
    public let slug: String
    public let description: String?
    public let venueName: String?
    public let address: String?
    public let latitude: Double?
    public let longitude: Double?
    public let placeID: String?
    public let priceText: String?
    public let priceLevel: Int?
    public let ticketURLString: String?
    public let officialURLString: String?
    public let relatedURLStrings: [String]
    public let sourceURLString: String?
    public let lastEntryText: String?
    public let aiSummary: String?
    public let hoursText: String?
    public let thumbnailURLString: String?
    public let regionName: String?
    public let stationName: String?
    public let occurrences: [CalendarEventOccurrence]
    /// サーバが「連続した日付」かつ「同じ時刻」の回をまとめて整形済みの表示行。
    /// 古いキャッシュや日付が壊れたイベントでは欠落しうるので、
    /// 空のときは `occurrences` から組み立てる側にフォールバックする。
    public let scheduleLines: [String]
    public let tags: [CalendarTag]
    public let prefecture: CalendarPrefecture?

    public init(
        id: String,
        title: String,
        slug: String,
        description: String? = nil,
        venueName: String? = nil,
        address: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        placeID: String? = nil,
        priceText: String? = nil,
        priceLevel: Int? = nil,
        ticketURLString: String? = nil,
        officialURLString: String? = nil,
        relatedURLStrings: [String] = [],
        sourceURLString: String? = nil,
        lastEntryText: String? = nil,
        aiSummary: String? = nil,
        hoursText: String? = nil,
        thumbnailURLString: String? = nil,
        regionName: String? = nil,
        stationName: String? = nil,
        occurrences: [CalendarEventOccurrence] = [],
        scheduleLines: [String] = [],
        tags: [CalendarTag] = [],
        prefecture: CalendarPrefecture? = nil
    ) {
        self.id = id
        self.title = title
        self.slug = slug
        self.description = description
        self.venueName = venueName
        self.address = address
        self.latitude = latitude
        self.longitude = longitude
        self.placeID = placeID
        self.priceText = priceText
        self.priceLevel = priceLevel
        self.ticketURLString = ticketURLString
        self.officialURLString = officialURLString
        self.relatedURLStrings = relatedURLStrings
        self.sourceURLString = sourceURLString
        self.lastEntryText = lastEntryText
        self.aiSummary = aiSummary
        self.hoursText = hoursText
        self.thumbnailURLString = thumbnailURLString
        self.regionName = regionName
        self.stationName = stationName
        self.occurrences = occurrences
        self.scheduleLines = scheduleLines
        self.tags = tags
        self.prefecture = prefecture
    }

    public var thumbnailURL: URL? {
        Self.httpURL(thumbnailURLString)
    }

    public var ticketURL: URL? {
        Self.httpURL(ticketURLString)
    }

    public var officialURL: URL? {
        Self.httpURL(officialURLString)
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case title
        case slug
        case description
        case venueName = "venue_name"
        case address
        case latitude = "lat"
        case longitude = "lng"
        case placeID = "place_id"
        case priceText = "price_text"
        case priceLevel = "price_level"
        case ticketURLString = "ticket_url"
        case officialURLString = "official_url"
        case relatedURLStrings = "related_urls"
        case sourceURLString = "source_url"
        case lastEntryText = "last_entry_text"
        case aiSummary = "ai_summary"
        case hoursText = "hours_text"
        case thumbnailURLString = "thumbnail_url"
        case regionName = "region_name"
        case stationName = "station_name"
        case occurrences
        case scheduleLines = "schedule_lines"
        case tags
        case prefecture
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.requiredString(forKey: .id)
        title = try container.requiredString(forKey: .title)
        slug = try container.requiredString(forKey: .slug)
        description = container.trimmedString(forKey: .description)
        venueName = container.trimmedString(forKey: .venueName)
        address = container.trimmedString(forKey: .address)
        latitude = container.flexibleDouble(forKey: .latitude)
        longitude = container.flexibleDouble(forKey: .longitude)
        placeID = container.trimmedString(forKey: .placeID)
        priceText = container.trimmedString(forKey: .priceText)
        priceLevel = container.flexibleInt(forKey: .priceLevel)
        ticketURLString = container.trimmedString(forKey: .ticketURLString)
        officialURLString = container.trimmedString(forKey: .officialURLString)
        relatedURLStrings = container.stringArray(forKey: .relatedURLStrings)
        sourceURLString = container.trimmedString(forKey: .sourceURLString)
        lastEntryText = container.trimmedString(forKey: .lastEntryText)
        aiSummary = container.trimmedString(forKey: .aiSummary)
        hoursText = container.trimmedString(forKey: .hoursText)
        thumbnailURLString = container.trimmedString(forKey: .thumbnailURLString)
        regionName = container.trimmedString(forKey: .regionName)
        stationName = container.trimmedString(forKey: .stationName)
        occurrences = container.lossyArray(
            CalendarEventOccurrence.self,
            forKey: .occurrences
        )
        scheduleLines = container.stringArray(forKey: .scheduleLines)
        tags = container.lossyArray(CalendarTag.self, forKey: .tags)
            .sorted { $0.sortOrder < $1.sortOrder }
        prefecture = try? container.decodeIfPresent(
            CalendarPrefecture.self,
            forKey: .prefecture
        )
    }

    private static func httpURL(_ value: String?) -> URL? {
        guard
            let value,
            let url = URL(string: value),
            let scheme = url.scheme?.lowercased(),
            scheme == "http" || scheme == "https"
        else {
            return nil
        }
        return url
    }
}

public struct CalendarMonthMetadata: Codable, Equatable, Sendable {
    public let holidays: [String: String]
    public let inHorizon: Bool?

    public init(holidays: [String: String] = [:], inHorizon: Bool? = nil) {
        self.holidays = holidays
        self.inHorizon = inHorizon
    }

    private enum CodingKeys: String, CodingKey {
        case holidays
        case inHorizon
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        holidays =
            (try? container.decode([String: String].self, forKey: .holidays))
                ?? [:]
        inHorizon = container.flexibleBool(forKey: .inHorizon)
    }
}

public struct CalendarMonthResponse: Decodable, Equatable, Sendable {
    public let events: [CalendarEvent]
    public let metadata: CalendarMonthMetadata
    public let error: String?

    public init(
        events: [CalendarEvent],
        metadata: CalendarMonthMetadata = CalendarMonthMetadata(),
        error: String? = nil
    ) {
        self.events = events
        self.metadata = metadata
        self.error = error
    }

    private enum CodingKeys: String, CodingKey {
        case events
        case metadata = "meta"
        case error
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        events = container.lossyArray(CalendarEvent.self, forKey: .events)
        metadata =
            (try? container.decode(
                CalendarMonthMetadata.self,
                forKey: .metadata
            ))
                ?? CalendarMonthMetadata()
        error = container.trimmedString(forKey: .error)
    }
}

/// 単一イベント取得API `/api/calendar/events/by-slug/[slug]` の応答。
/// `event` は月別API `/api/calendar/events` の `events[]` の1要素と
/// キーが完全一致する（実データで確認済み）ため、`CalendarEvent` のデコーダを
/// そのまま使い回せる。トップレベルだけがオブジェクトなのでその薄い殻を被せる。
public struct CalendarEventResponse: Decodable, Equatable, Sendable {
    public let event: CalendarEvent

    public init(event: CalendarEvent) {
        self.event = event
    }
}

public enum CalendarNearbyKind: String, Codable, CaseIterable, Sendable {
    case food
    case play
    case stay
    case unknown

    public init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer().decode(String.self)
        self = Self(rawValue: value.lowercased()) ?? .unknown
    }
}

public struct CalendarNearbySpot: Codable, Equatable, Identifiable, Sendable {
    public let spotID: String
    public let name: String
    public let category: String?
    public let placeID: String
    public let address: String?
    public let latitude: Double?
    public let longitude: Double?
    public let photoReference: String?
    public let kind: CalendarNearbyKind
    public let distanceMeters: Double
    public let rating: Double?
    public let reviews: Int?
    public let rank: Int

    public var id: String { spotID }

    public init(
        spotID: String,
        name: String,
        category: String? = nil,
        placeID: String,
        address: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        photoReference: String? = nil,
        kind: CalendarNearbyKind,
        distanceMeters: Double,
        rating: Double? = nil,
        reviews: Int? = nil,
        rank: Int
    ) {
        self.spotID = spotID
        self.name = name
        self.category = category
        self.placeID = placeID
        self.address = address
        self.latitude = latitude
        self.longitude = longitude
        self.photoReference = photoReference
        self.kind = kind
        self.distanceMeters = distanceMeters
        self.rating = rating
        self.reviews = reviews
        self.rank = rank
    }

    public var placeResult: PlaceResult? {
        guard let latitude, let longitude else { return nil }
        return PlaceResult(
            placeID: placeID,
            name: name,
            category: category ?? "",
            latitude: latitude,
            longitude: longitude,
            address: address ?? "",
            photoReference: photoReference,
            rating: rating,
            userRatingsTotal: reviews,
            spotID: spotID
        )
    }

    private enum CodingKeys: String, CodingKey {
        case spotID = "spot_id"
        case name
        case category
        case placeID = "place_id"
        case address
        case latitude = "lat"
        case longitude = "lng"
        case photoReference = "photo_ref"
        case kind
        case distanceMeters = "distance_m"
        case rating
        case reviews
        case rank
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        spotID = try container.requiredString(forKey: .spotID)
        name = try container.requiredString(forKey: .name)
        category = container.trimmedString(forKey: .category)
        placeID = try container.requiredString(forKey: .placeID)
        address = container.trimmedString(forKey: .address)
        latitude = container.flexibleDouble(forKey: .latitude)
        longitude = container.flexibleDouble(forKey: .longitude)
        photoReference = container.trimmedString(forKey: .photoReference)
        kind =
            (try? container.decode(CalendarNearbyKind.self, forKey: .kind))
                ?? .unknown
        distanceMeters = container.flexibleDouble(forKey: .distanceMeters) ?? 0
        rating = container.flexibleDouble(forKey: .rating)
        reviews = container.flexibleInt(forKey: .reviews)
        rank = container.flexibleInt(forKey: .rank) ?? 999
    }
}

public struct CalendarNearbyResponse: Decodable, Equatable, Sendable {
    public let spots: [CalendarNearbySpot]

    public init(spots: [CalendarNearbySpot]) {
        self.spots = spots
    }

    private enum CodingKeys: String, CodingKey {
        case spots
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        spots = container.lossyArray(CalendarNearbySpot.self, forKey: .spots)
            .sorted { lhs, rhs in
                if lhs.rank != rhs.rank { return lhs.rank < rhs.rank }
                return lhs.spotID < rhs.spotID
            }
    }
}

private struct LossyArray<Element: Decodable>: Decodable {
    let values: [Element]

    init(from decoder: Decoder) throws {
        var container = try decoder.unkeyedContainer()
        var values: [Element] = []
        while !container.isAtEnd {
            if let value = try? container.decode(Element.self) {
                values.append(value)
            } else {
                _ = try? container.decode(JSONValue.self)
            }
        }
        self.values = values
    }
}

private extension KeyedDecodingContainer {
    func requiredString(forKey key: Key) throws -> String {
        guard let value = trimmedString(forKey: key) else {
            throw DecodingError.dataCorruptedError(
                forKey: key,
                in: self,
                debugDescription: "A non-empty string is required."
            )
        }
        return value
    }

    func trimmedString(forKey key: Key) -> String? {
        guard let value = try? decode(String.self, forKey: key) else {
            return nil
        }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    func stringArray(forKey key: Key) -> [String] {
        let values = (try? decode([String].self, forKey: key)) ?? []
        var seen = Set<String>()
        return values.compactMap { raw in
            let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty, seen.insert(value).inserted else { return nil }
            return value
        }
    }

    func flexibleDouble(forKey key: Key) -> Double? {
        if let value = try? decode(Double.self, forKey: key), value.isFinite {
            return value
        }
        if let value = try? decode(Int.self, forKey: key) {
            return Double(value)
        }
        if
            let value = try? decode(String.self, forKey: key),
            let number = Double(
                value.trimmingCharacters(in: .whitespacesAndNewlines)
            ),
            number.isFinite
        {
            return number
        }
        return nil
    }

    func flexibleInt(forKey key: Key) -> Int? {
        if let value = try? decode(Int.self, forKey: key) {
            return value
        }
        guard
            let value = flexibleDouble(forKey: key),
            value >= Double(Int.min),
            value <= Double(Int.max)
        else {
            return nil
        }
        return Int(value.rounded())
    }

    func flexibleBool(forKey key: Key) -> Bool? {
        if let value = try? decode(Bool.self, forKey: key) {
            return value
        }
        if let value = try? decode(Int.self, forKey: key) {
            return value != 0
        }
        if let value = try? decode(String.self, forKey: key) {
            switch value
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            {
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

    func wireDate(forKey key: Key) -> Date? {
        if let value = try? decode(Date.self, forKey: key) {
            return value
        }
        guard let value = trimmedString(forKey: key) else { return nil }
        return CalendarWireDate.parse(value)
    }

    func requiredWireDate(forKey key: Key) throws -> Date {
        guard let date = wireDate(forKey: key) else {
            throw DecodingError.dataCorruptedError(
                forKey: key,
                in: self,
                debugDescription: "A valid ISO-8601 date is required."
            )
        }
        return date
    }

    func lossyArray<Element: Decodable>(
        _ type: Element.Type,
        forKey key: Key
    ) -> [Element] {
        (try? decode(LossyArray<Element>.self, forKey: key))?.values ?? []
    }
}

private enum CalendarWireDate {
    static func parse(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [
            .withInternetDateTime,
            .withFractionalSeconds,
        ]
        if let date = formatter.date(from: value) {
            return date
        }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }
}
