import Foundation

public enum ArticleSegmentLevel: String, Codable, CaseIterable, Sendable {
    case municipality
    case walkArea = "walk_area"
    case prefecture
    case region
    case national
}

public struct ArticleSummary: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let title: String
    public let summary: String
    public let slug: String
    public let category: String
    public let theme: String?
    public let keywords: [String]
    public let imageURLString: String?
    public let createdAt: Date?
    public let publishedAt: Date?
    public let targetPrefectures: [String]
    public let targetMunicipalities: [String]
    public let targetWalkAreaTags: [String]
    public let dogSizeTags: [String]
    public let topicTags: [String]
    public let segmentLevel: ArticleSegmentLevel?
    public let linkedSpotReferences: [String]
    public let linkedEventReferences: [String]

    public init(
        id: String,
        title: String,
        summary: String,
        slug: String,
        category: String = "general",
        theme: String? = nil,
        keywords: [String] = [],
        imageURLString: String? = nil,
        createdAt: Date? = nil,
        publishedAt: Date? = nil,
        targetPrefectures: [String] = [],
        targetMunicipalities: [String] = [],
        targetWalkAreaTags: [String] = [],
        dogSizeTags: [String] = [],
        topicTags: [String] = [],
        segmentLevel: ArticleSegmentLevel? = nil,
        linkedSpotReferences: [String] = [],
        linkedEventReferences: [String] = []
    ) {
        self.id = id
        self.title = title
        self.summary = summary
        self.slug = slug
        self.category = category
        self.theme = theme
        self.keywords = keywords
        self.imageURLString = imageURLString
        self.createdAt = createdAt
        self.publishedAt = publishedAt
        self.targetPrefectures = targetPrefectures
        self.targetMunicipalities = targetMunicipalities
        self.targetWalkAreaTags = targetWalkAreaTags
        self.dogSizeTags = dogSizeTags
        self.topicTags = topicTags
        self.segmentLevel = segmentLevel
        self.linkedSpotReferences = linkedSpotReferences
        self.linkedEventReferences = linkedEventReferences
    }

    public var imageURL: URL? {
        Self.httpURL(imageURLString)
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case title
        case summary
        case slug
        case category
        case theme
        case keywords
        case imageURLString = "image_url"
        case createdAt = "created_at"
        case publishedAt = "published_at"
        case targetPrefectures = "target_prefectures"
        case targetMunicipalities = "target_municipalities"
        case targetWalkAreaTags = "target_walk_area_tags"
        case dogSizeTags = "dog_size_tags"
        case topicTags = "topic_tags"
        case segmentLevel = "segment_level"
        case linkedSpotReferences = "linked_spot_refs"
        case linkedEventReferences = "linked_event_refs"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.articleRequiredString(forKey: .id)
        title = try container.articleRequiredString(forKey: .title)
        summary = container.articleTrimmedString(forKey: .summary) ?? ""
        slug = try container.articleRequiredString(forKey: .slug)
        category = container.articleTrimmedString(forKey: .category) ?? "general"
        theme = container.articleTrimmedString(forKey: .theme)
        keywords = container.articleStringArray(forKey: .keywords)
        imageURLString = container.articleTrimmedString(forKey: .imageURLString)
        createdAt = container.articleWireDate(forKey: .createdAt)
        publishedAt = container.articleWireDate(forKey: .publishedAt)
        targetPrefectures = container.articleStringArray(
            forKey: .targetPrefectures
        )
        targetMunicipalities = container.articleStringArray(
            forKey: .targetMunicipalities
        )
        targetWalkAreaTags = container.articleStringArray(
            forKey: .targetWalkAreaTags
        )
        dogSizeTags = container.articleStringArray(forKey: .dogSizeTags)
        topicTags = container.articleStringArray(forKey: .topicTags)
        segmentLevel = try? container.decodeIfPresent(
            ArticleSegmentLevel.self,
            forKey: .segmentLevel
        )
        linkedSpotReferences = container.articleStringArray(
            forKey: .linkedSpotReferences
        )
        linkedEventReferences = container.articleStringArray(
            forKey: .linkedEventReferences
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

public enum ArticleBlock: Decodable, Equatable, Sendable {
    case text(content: String)
    case heading(content: String)
    case image(urlString: String, caption: String?)
    case spot(spotID: String, spotName: String, description: String)

    public var spotReference: String? {
        guard case let .spot(spotID, _, _) = self else { return nil }
        return spotID
    }

    public var imageURL: URL? {
        guard
            case let .image(value, _) = self,
            let url = URL(string: value),
            let scheme = url.scheme?.lowercased(),
            scheme == "http" || scheme == "https"
        else {
            return nil
        }
        return url
    }

    private enum CodingKeys: String, CodingKey {
        case type
        case content
        case text
        case url
        case caption
        case spotID = "spot_id"
        case spotIDCamel = "spotId"
        case spotName = "spot_name"
        case spotNameCamel = "spotName"
        case description
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.articleRequiredString(forKey: .type)
            .lowercased()
        switch type {
        case "text", "paragraph":
            let content =
                container.articleTrimmedString(forKey: .content)
                    ?? container.articleTrimmedString(forKey: .text)
            guard let content else {
                throw Self.invalidBlock(container, key: .content)
            }
            self = .text(content: content)
        case "heading":
            let content =
                container.articleTrimmedString(forKey: .content)
                    ?? container.articleTrimmedString(forKey: .text)
            guard let content else {
                throw Self.invalidBlock(container, key: .content)
            }
            self = .heading(content: content)
        case "image":
            guard let url = container.articleTrimmedString(forKey: .url) else {
                throw Self.invalidBlock(container, key: .url)
            }
            self = .image(
                urlString: url,
                caption: container.articleTrimmedString(forKey: .caption)
            )
        case "spot":
            let spotID =
                container.articleTrimmedString(forKey: .spotID)
                    ?? container.articleTrimmedString(forKey: .spotIDCamel)
            guard let spotID else {
                throw Self.invalidBlock(container, key: .spotID)
            }
            self = .spot(
                spotID: spotID,
                spotName:
                    container.articleTrimmedString(forKey: .spotName)
                        ?? container.articleTrimmedString(forKey: .spotNameCamel)
                        ?? "",
                description:
                    container.articleTrimmedString(forKey: .description) ?? ""
            )
        default:
            throw Self.invalidBlock(container, key: .type)
        }
    }

    private static func invalidBlock(
        _ container: KeyedDecodingContainer<CodingKeys>,
        key: CodingKeys
    ) -> DecodingError {
        DecodingError.dataCorruptedError(
            forKey: key,
            in: container,
            debugDescription: "Unsupported or incomplete article block."
        )
    }
}

public struct ArticleSpotLink: Decodable, Equatable, Sendable {
    public let spotName: String
    public let spotID: String?
    public let description: String

    public init(spotName: String, spotID: String?, description: String) {
        self.spotName = spotName
        self.spotID = spotID
        self.description = description
    }

    private enum CodingKeys: String, CodingKey {
        case spotName = "spot_name"
        case spotNameCamel = "spotName"
        case spotID = "spot_id"
        case spotIDCamel = "spotId"
        case description
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        spotName =
            container.articleTrimmedString(forKey: .spotName)
                ?? container.articleTrimmedString(forKey: .spotNameCamel)
                ?? ""
        spotID =
            container.articleTrimmedString(forKey: .spotID)
                ?? container.articleTrimmedString(forKey: .spotIDCamel)
        description =
            container.articleTrimmedString(forKey: .description) ?? ""
    }
}

public struct ArticleDetail: Decodable, Equatable, Identifiable, Sendable {
    public let id: String
    public let title: String
    public let slug: String
    public let body: String
    public let summary: String
    public let keywords: [String]
    public let blocks: [ArticleBlock]
    public let spotLinks: [ArticleSpotLink]
    public let category: String
    public let imageURLString: String?

    public init(
        id: String,
        title: String,
        slug: String,
        body: String,
        summary: String,
        keywords: [String],
        blocks: [ArticleBlock],
        spotLinks: [ArticleSpotLink],
        category: String,
        imageURLString: String?
    ) {
        self.id = id
        self.title = title
        self.slug = slug
        self.body = body
        self.summary = summary
        self.keywords = keywords
        self.blocks = blocks
        self.spotLinks = spotLinks
        self.category = category
        self.imageURLString = imageURLString
    }

    public var renderedBlocks: [ArticleBlock] {
        if !blocks.isEmpty {
            return blocks
        }
        let content = body.trimmingCharacters(in: .whitespacesAndNewlines)
        return content.isEmpty ? [] : [.text(content: content)]
    }

    public var linkedSpotReferences: [String] {
        var seen = Set<String>()
        return (
            renderedBlocks.compactMap(\.spotReference)
                + spotLinks.compactMap(\.spotID)
        ).filter { seen.insert($0).inserted }
    }

    public var imageURL: URL? {
        guard
            let imageURLString,
            let url = URL(string: imageURLString),
            let scheme = url.scheme?.lowercased(),
            scheme == "http" || scheme == "https"
        else {
            return nil
        }
        return url
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case title
        case slug
        case body
        case summary
        case keywords
        case blocks
        case spotLinks = "spot_links"
        case category
        case imageURLString = "image_url"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.articleRequiredString(forKey: .id)
        title = try container.articleRequiredString(forKey: .title)
        slug = try container.articleRequiredString(forKey: .slug)
        body = container.articleTrimmedString(forKey: .body) ?? ""
        summary = container.articleTrimmedString(forKey: .summary) ?? ""
        keywords = container.articleStringArray(forKey: .keywords)
        blocks = container.articleLossyArray(
            ArticleBlock.self,
            forKey: .blocks
        )
        spotLinks = container.articleLossyArray(
            ArticleSpotLink.self,
            forKey: .spotLinks
        )
        category = container.articleTrimmedString(forKey: .category) ?? "general"
        imageURLString = container.articleTrimmedString(forKey: .imageURLString)
    }
}

public struct ArticlesResponse: Decodable, Equatable, Sendable {
    public let articles: [ArticleSummary]

    public init(articles: [ArticleSummary]) {
        self.articles = articles
    }

    private enum CodingKeys: String, CodingKey {
        case articles
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        articles = container.articleLossyArray(
            ArticleSummary.self,
            forKey: .articles
        )
    }
}

public struct ArticleDetailResponse: Decodable, Equatable, Sendable {
    public let article: ArticleDetail?

    public init(article: ArticleDetail?) {
        self.article = article
    }

    private enum CodingKeys: String, CodingKey {
        case article
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        article = try? container.decodeIfPresent(
            ArticleDetail.self,
            forKey: .article
        )
    }
}

public struct ArticleLinkedSpot: Equatable, Sendable {
    public let row: PublicSpot
    public let enrichment: BatchPlaceDetail?
    public let photoURL: URL?

    public init(
        row: PublicSpot,
        enrichment: BatchPlaceDetail?,
        photoURL: URL?
    ) {
        self.row = row
        self.enrichment = enrichment
        self.photoURL = photoURL
    }

    public var displayName: String {
        row.name?.trimmingCharacters(in: .whitespacesAndNewlines)
            .nilIfEmpty ?? "スポット"
    }

    public var displayCategory: String {
        row.category?.trimmingCharacters(in: .whitespacesAndNewlines)
            .nilIfEmpty ?? "スポット"
    }

    public var displayAddress: String {
        enrichment?.formattedAddress?.nilIfEmpty
            ?? enrichment?.vicinity?.nilIfEmpty
            ?? row.bestAddress?.nilIfEmpty
            ?? "—"
    }

    public var routeID: String? {
        row.id?.nilIfEmpty
            ?? row.placeID.map(SpotDetailNavigationState.placeRouteID(for:))
    }
}

private struct ArticleLossyArray<Element: Decodable>: Decodable {
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

private enum ArticleWireDate {
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

private extension KeyedDecodingContainer {
    func articleRequiredString(forKey key: Key) throws -> String {
        guard let value = articleTrimmedString(forKey: key) else {
            throw DecodingError.dataCorruptedError(
                forKey: key,
                in: self,
                debugDescription: "A non-empty string is required."
            )
        }
        return value
    }

    func articleTrimmedString(forKey key: Key) -> String? {
        guard let value = try? decode(String.self, forKey: key) else {
            return nil
        }
        return value.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    }

    func articleStringArray(forKey key: Key) -> [String] {
        let values = (try? decode([String].self, forKey: key)) ?? []
        var seen = Set<String>()
        return values.compactMap { raw in
            let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty, seen.insert(value).inserted else { return nil }
            return value
        }
    }

    func articleWireDate(forKey key: Key) -> Date? {
        if let date = try? decode(Date.self, forKey: key) {
            return date
        }
        guard let value = articleTrimmedString(forKey: key) else { return nil }
        return ArticleWireDate.parse(value)
    }

    func articleLossyArray<Element: Decodable>(
        _ type: Element.Type,
        forKey key: Key
    ) -> [Element] {
        (try? decode(ArticleLossyArray<Element>.self, forKey: key))?.values ?? []
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
