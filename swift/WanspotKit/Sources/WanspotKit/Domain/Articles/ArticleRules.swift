import Foundation

public enum ArticleGenre: String, Codable, CaseIterable, Identifiable, Sendable {
    case event
    case cafe
    case park
    case dogRun = "dog_run"
    case restaurant
    case hotel
    case onsen
    case indoor
    case shopping
    case camp

    public var id: Self { self }

    public var label: String {
        switch self {
        case .event:
            "イベント"
        case .cafe:
            "カフェ"
        case .park:
            "公園"
        case .dogRun:
            "ドッグラン"
        case .restaurant:
            "レストラン"
        case .hotel:
            "お泊まり"
        case .onsen:
            "温泉"
        case .indoor:
            "雨の日OK"
        case .shopping:
            "モール"
        case .camp:
            "キャンプ"
        }
    }
}

public struct ArticleThemeInfo: Codable, Equatable, Sendable {
    public let area: String?
    public let genre: ArticleGenre?
    public let genreLabel: String?

    public init(area: String?, genre: ArticleGenre?, genreLabel: String?) {
        self.area = area
        self.genre = genre
        self.genreLabel = genreLabel
    }
}

public struct ArticleRankingSpot: Equatable, Sendable {
    public let id: String
    public let placeID: String?
    public let latitude: Double?
    public let longitude: Double?
    public let municipality: String?
    public let prefecture: String?

    public init(
        id: String,
        placeID: String?,
        latitude: Double?,
        longitude: Double?,
        municipality: String?,
        prefecture: String?
    ) {
        self.id = id
        self.placeID = placeID
        self.latitude = latitude
        self.longitude = longitude
        self.municipality = municipality
        self.prefecture = prefecture
    }

    public init?(_ spot: PublicSpot) {
        guard let id = spot.id?.contentNonEmpty else { return nil }
        self.init(
            id: id,
            placeID: spot.placeID?.contentNonEmpty,
            latitude: spot.latitude,
            longitude: spot.longitude,
            municipality: spot.municipality?.contentNonEmpty,
            prefecture: spot.prefecture?.contentNonEmpty
        )
    }
}

public struct ArticleRankingContext: Sendable {
    public let userLocation: NearbyCoordinate?
    public let userPrefecture: String?
    public let userMunicipality: String?
    public let walkAreaTags: [String]
    public let recentArticleIDs: Set<String>
    public let likedAtBySpotID: [String: Date]
    public let checkedAtBySpotID: [String: Date]
    public let userSeed: String
    public let now: Date

    public init(
        userLocation: NearbyCoordinate? = nil,
        userPrefecture: String? = nil,
        userMunicipality: String? = nil,
        walkAreaTags: [String] = [],
        recentArticleIDs: Set<String> = [],
        likedAtBySpotID: [String: Date] = [:],
        checkedAtBySpotID: [String: Date] = [:],
        userSeed: String = "anon",
        now: Date = Date()
    ) {
        self.userLocation = userLocation
        self.userPrefecture = userPrefecture
        self.userMunicipality = userMunicipality
        self.walkAreaTags = walkAreaTags
        self.recentArticleIDs = recentArticleIDs
        self.likedAtBySpotID = likedAtBySpotID
        self.checkedAtBySpotID = checkedAtBySpotID
        self.userSeed = userSeed
        self.now = now
    }
}

public enum ArticleRules {
    public static func parseTheme(_ theme: String?) -> ArticleThemeInfo {
        guard let theme = theme?.contentNonEmpty else {
            return ArticleThemeInfo(area: nil, genre: nil, genreLabel: nil)
        }
        let areaMatch = firstMatch(#"^【(.+?)】"#, in: theme)
        let area = areaMatch?.captures.first?.contentNonEmpty
        let rest: String
        if let range = areaMatch?.range {
            rest = String(theme[range.upperBound...])
        } else {
            rest = theme
        }

        for genre in ArticleGenre.allCases where matches(genre, in: rest) {
            return ArticleThemeInfo(
                area: area,
                genre: genre,
                genreLabel: genre.label
            )
        }
        return ArticleThemeInfo(area: area, genre: nil, genreLabel: nil)
    }

    public static func availableGenres(
        in articles: [ArticleSummary]
    ) -> [ArticleGenre] {
        let present = Set(articles.compactMap { parseTheme($0.theme).genre })
        return ArticleGenre.allCases.filter(present.contains)
    }

    public static func eventRoundupMonthKey(
        title: String?,
        slug: String?,
        theme: String?
    ) -> String? {
        if
            let slug,
            let match = firstMatch(#"^events-(\d{4}-\d{2})(?:-|$)"#, in: slug),
            let value = match.captures.first
        {
            return value
        }
        if
            let theme,
            let match = firstMatch(#"^(\d{4}-\d{2})\b"#, in: theme),
            let value = match.captures.first
        {
            return value
        }
        if
            let title,
            let match = firstMatch(#"【(\d{4})年(\d{1,2})月"#, in: title),
            match.captures.count >= 2,
            let month = Int(match.captures[1])
        {
            return "\(match.captures[0])-\(String(format: "%02d", month))"
        }
        return nil
    }

    public static func eventRoundupMonthKey(
        _ article: ArticleSummary
    ) -> String? {
        eventRoundupMonthKey(
            title: article.title,
            slug: article.slug,
            theme: article.theme
        )
    }

    public static func eventRoundupOrder(
        _ articles: [ArticleSummary]
    ) -> [ArticleSummary] {
        articles.enumerated().sorted { lhs, rhs in
            let left = eventRoundupMonthKey(lhs.element) ?? "9999-99"
            let right = eventRoundupMonthKey(rhs.element) ?? "9999-99"
            if left != right { return left < right }
            let titleOrder = lhs.element.title.compare(
                rhs.element.title,
                options: [],
                range: nil,
                locale: Locale(identifier: "ja")
            )
            if titleOrder != .orderedSame {
                return titleOrder == .orderedAscending
            }
            return lhs.offset < rhs.offset
        }.map(\.element)
    }

    public static func publishedOrder(
        _ articles: [ArticleSummary]
    ) -> [ArticleSummary] {
        articles.enumerated().sorted { lhs, rhs in
            switch (lhs.element.publishedAt, rhs.element.publishedAt) {
            case let (left?, right?) where left != right:
                return left > right
            case (_?, nil):
                return true
            case (nil, _?):
                return false
            default:
                if lhs.element.createdAt != rhs.element.createdAt {
                    return (lhs.element.createdAt ?? .distantPast)
                        > (rhs.element.createdAt ?? .distantPast)
                }
                return lhs.offset < rhs.offset
            }
        }.map(\.element)
    }

    public static func relatedArticles(
        in articles: [ArticleSummary],
        spotID: String?,
        placeID: String,
        limit: Int = 3
    ) -> [ArticleSummary] {
        guard limit > 0 else { return [] }
        let spotReferences = Set(
            uniqueStrings([spotID ?? "", placeID])
        )
        guard !spotReferences.isEmpty else { return [] }

        let matches = articles.filter { article in
            article.linkedSpotReferences.contains { rawReference in
                guard let reference = rawReference.contentNonEmpty else {
                    return false
                }
                return spotReferences.contains(reference)
            }
        }
        return Array(publishedOrder(matches).prefix(limit))
    }

    public static func relatedArticles(
        in articles: [ArticleSummary],
        eventID: String,
        eventMonth: String? = nil,
        prefecture: String? = nil,
        limit: Int = 3
    ) -> [ArticleSummary] {
        guard
            limit > 0,
            let eventReference = eventID.contentNonEmpty
        else {
            return []
        }

        let matches = articles.filter { article in
            article.linkedEventReferences.contains { rawReference in
                rawReference.contentNonEmpty == eventReference
            }
        }
        if !matches.isEmpty {
            return Array(publishedOrder(matches).prefix(limit))
        }

        guard
            let eventMonth = eventMonth?.contentNonEmpty,
            let prefecture = prefecture?.contentNonEmpty
        else {
            return []
        }
        let roundupFallback = articles.filter { article in
            article.category.lowercased() == "event"
                && eventRoundupMonthKey(
                    title: article.title,
                    slug: article.slug,
                    theme: article.theme
                ) == eventMonth
                && article.targetPrefectures.contains {
                    $0.contentNonEmpty == prefecture
                }
        }
        return Array(publishedOrder(roundupFallback).prefix(limit))
    }

    public static func isTextBlockSectionTitle(_ content: String) -> Bool {
        let value = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return false }
        if value.hasPrefix("【") || value.hasPrefix("■") {
            return true
        }
        return value.utf16.count <= 20
    }

    public static func rank(
        _ articles: [ArticleSummary],
        spotsByReference: [String: ArticleRankingSpot],
        context: ArticleRankingContext
    ) -> [ArticleSummary] {
        guard articles.count > 1 else { return articles }
        let dayKey = utcDateKey(context.now)
        let locationKey = context.userLocation.map {
            String(
                format: "%.3f,%.3f",
                locale: Locale(identifier: "en_US_POSIX"),
                $0.latitude,
                $0.longitude
            )
        } ?? "noloc"
        let tagsKey = context.walkAreaTags.sorted().joined(separator: "|")
        let seedBase =
            "\(context.userSeed)|\(dayKey)|\(locationKey)|\(tagsKey.isEmpty ? "notags" : tagsKey)"

        return articles.map { article -> RankedArticle in
            let spots = article.linkedSpotReferences.compactMap {
                spotsByReference[$0]
            }.unique(by: \.id)
            let searchText = [
                article.title,
                article.theme,
                article.category,
                article.summary,
            ].compactMap(\.self).joined(separator: " ")
                + " "
                + article.keywords.joined(separator: " ")

            var score = 50.0
            score += regionScore(searchText, context: context)
            score += walkAreaTextScore(searchText, tags: context.walkAreaTags)
            score += seasonScore(searchText, now: context.now)
            score += freshnessScore(article.publishedAt, now: context.now)

            var distances: [Double] = []
            var retentionScore = 0.0
            for spot in spots {
                if
                    let origin = context.userLocation,
                    let latitude = spot.latitude,
                    let longitude = spot.longitude
                {
                    distances.append(
                        NearbyGeometry.distanceMeters(
                            from: origin,
                            to: NearbyCoordinate(
                                latitude: latitude,
                                longitude: longitude
                            )
                        ) / 1_000
                    )
                }
                if
                    let prefecture = context.userPrefecture,
                    spot.prefecture == prefecture
                {
                    score += 18
                }
                if
                    let municipality = context.userMunicipality,
                    spot.municipality == municipality
                {
                    score += 45
                }
                if let likedAt = context.likedAtBySpotID[spot.id] {
                    retentionScore += 1.6 * recencyFactor(
                        likedAt,
                        now: context.now
                    )
                }
                if let checkedAt = context.checkedAtBySpotID[spot.id] {
                    retentionScore += 0.9 * recencyFactor(
                        checkedAt,
                        now: context.now
                    )
                }
            }
            distances.sort()
            let nearest = distances.first ?? .infinity
            let nearestThree = distances.prefix(3)
            if !nearestThree.isEmpty {
                score += distanceBoost(
                    nearestThree.reduce(0, +) / Double(nearestThree.count)
                )
            }
            score += walkAreaSpotScore(spots, tags: context.walkAreaTags)
            score += catalogProximityScore(
                spots,
                userLocation: context.userLocation,
                tags: context.walkAreaTags
            )
            score += retentionScore * 12
            if context.recentArticleIDs.contains(article.id) {
                score -= 12
            }

            return RankedArticle(
                article: article,
                segmentTier: segmentTier(
                    article,
                    spots: spots,
                    nearestDistanceKilometers: nearest,
                    context: context
                ),
                segmentRank: segmentRank(article.segmentLevel),
                score: score,
                tie: randomUnit("\(seedBase)|\(article.id)")
            )
        }.sorted { lhs, rhs in
            if lhs.segmentTier != rhs.segmentTier {
                return lhs.segmentTier < rhs.segmentTier
            }
            if lhs.segmentRank != rhs.segmentRank {
                return lhs.segmentRank < rhs.segmentRank
            }
            if lhs.score != rhs.score {
                return lhs.score > rhs.score
            }
            return lhs.tie < rhs.tie
        }.map(\.article)
    }

    private struct RegexMatch {
        let range: Range<String.Index>
        let captures: [String]
    }

    private struct RankedArticle {
        let article: ArticleSummary
        let segmentTier: Int
        let segmentRank: Int
        let score: Double
        let tie: Double
    }

    private static func matches(_ genre: ArticleGenre, in value: String) -> Bool {
        switch genre {
        case .event:
            value.contains("イベント")
        case .cafe:
            value.contains("カフェ")
        case .park:
            value.contains("公園")
        case .dogRun:
            value.range(of: #"ドッ[グク]ラン"#, options: .regularExpression) != nil
        case .restaurant:
            value.contains("レストラン")
        case .hotel:
            ["泊まれる", "宿", "ホテル"].contains(where: value.contains)
        case .onsen:
            value.contains("温泉")
        case .indoor:
            ["雨の日", "屋内"].contains(where: value.contains)
        case .shopping:
            ["ショッピング", "モール"].contains(where: value.contains)
        case .camp:
            value.contains("キャンプ")
        }
    }

    private static func firstMatch(
        _ pattern: String,
        in value: String
    ) -> RegexMatch? {
        guard
            let expression = try? NSRegularExpression(pattern: pattern),
            let match = expression.firstMatch(
                in: value,
                range: NSRange(value.startIndex..., in: value)
            ),
            let range = Range(match.range(at: 0), in: value)
        else {
            return nil
        }
        let captures = (1 ..< match.numberOfRanges).compactMap { index -> String? in
            guard let range = Range(match.range(at: index), in: value) else {
                return nil
            }
            return String(value[range])
        }
        return RegexMatch(range: range, captures: captures)
    }

    private static func normalized(_ value: String) -> String {
        value.replacingOccurrences(
            of: #"\s"#,
            with: "",
            options: .regularExpression
        )
    }

    private static func uniqueStrings(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.compactMap { raw in
            guard
                let value = raw.contentNonEmpty,
                seen.insert(value).inserted
            else {
                return nil
            }
            return value
        }
    }

    private static func intersects(_ lhs: [String], _ rhs: [String]) -> Bool {
        guard !lhs.isEmpty, !rhs.isEmpty else { return false }
        let right = Set(rhs.map(normalized))
        return lhs.contains { right.contains(normalized($0)) }
    }

    private static func regionScore(
        _ searchText: String,
        context: ArticleRankingContext
    ) -> Double {
        var score = 0.0
        if let prefecture = context.userPrefecture?.contentNonEmpty {
            if searchText.contains(prefecture) { score += 45 }
            let short = prefecture.replacingOccurrences(
                of: #"[都道府県]$"#,
                with: "",
                options: .regularExpression
            )
            if !short.isEmpty, searchText.contains(short) { score += 20 }
        }
        if
            let municipality = context.userMunicipality?.contentNonEmpty,
            searchText.contains(municipality)
        {
            score += 50
        }
        return score
    }

    private static func walkAreaTextScore(
        _ searchText: String,
        tags: [String]
    ) -> Double {
        let text = normalized(searchText)
        var score = 0.0
        for tag in tags {
            guard let tag = tag.contentNonEmpty else { continue }
            if text.contains(normalized(tag)) { score += 55 }
            if
                let city = tag.firstIndex(of: "市"),
                city > tag.startIndex,
                tag.index(after: city) < tag.endIndex
            {
                let suffix = String(tag[tag.index(after: city)...])
                if suffix.count >= 2, text.contains(normalized(suffix)) {
                    score += 25
                }
            }
        }
        return score
    }

    private static func seasonScore(_ searchText: String, now: Date) -> Double {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = CalendarRules.tokyoTimeZone
        let month = calendar.component(.month, from: now)
        let current = switch month {
        case 3 ... 5: "spring"
        case 6 ... 8: "summer"
        case 9 ... 11: "autumn"
        default: "winter"
        }
        let keywords = [
            "spring": ["春", "桜", "お花見", "新緑", "入学"],
            "summer": ["夏", "海", "ビーチ", "浴衣", "花火", "盆", "海水浴"],
            "autumn": ["秋", "紅葉", "秋祭り", "ハロウィン", "読書"],
            "winter": ["冬", "クリスマス", "イルミネーション", "年越し", "雪", "温泉"],
        ]
        let matches = keywords[current, default: []].filter(searchText.contains)
        var score = matches.isEmpty
            ? 0
            : 25 + Double(min(matches.count * 5, 15))
        if keywords.contains(where: { season, words in
            season != current && words.contains(where: searchText.contains)
        }) {
            score -= 10
        }
        return score
    }

    private static func freshnessScore(_ publishedAt: Date?, now: Date) -> Double {
        guard let publishedAt else { return 0 }
        let days = now.timeIntervalSince(publishedAt) / 86_400
        if days < 7 { return 10 }
        if days < 30 { return 5 }
        return 0
    }

    private static func distanceBoost(_ kilometers: Double) -> Double {
        if kilometers < 3 { return 45 }
        if kilometers < 10 { return 34 }
        if kilometers < 30 { return 22 }
        if kilometers < 100 { return 4 }
        return -24
    }

    private static func recencyFactor(_ date: Date, now: Date) -> Double {
        let ageDays = max(0, now.timeIntervalSince(date) / 86_400)
        return exp(-ageDays / 90)
    }

    private static func walkAreaSpotScore(
        _ spots: [ArticleRankingSpot],
        tags: [String]
    ) -> Double {
        let tags = Set(tags.compactMap(\.contentNonEmpty))
        guard !tags.isEmpty else { return 0 }
        return spots.reduce(into: 0.0) { score, spot in
            if let municipality = spot.municipality, tags.contains(municipality) {
                score += 60
            }
        }
    }

    private static func catalogProximityScore(
        _ spots: [ArticleRankingSpot],
        userLocation: NearbyCoordinate?,
        tags: [String]
    ) -> Double {
        guard !tags.isEmpty else { return 0 }
        var best = -Double.infinity
        for rawTag in tags {
            let tag = rawTag.trimmingCharacters(in: .whitespacesAndNewlines)
            guard let entry = walkAreasByLabel[tag] else { continue }
            let catalogCoordinate = NearbyCoordinate(
                latitude: entry.latitude,
                longitude: entry.longitude
            )
            for spot in spots {
                guard
                    let latitude = spot.latitude,
                    let longitude = spot.longitude
                else {
                    continue
                }
                let distance = NearbyGeometry.distanceMeters(
                    from: catalogCoordinate,
                    to: NearbyCoordinate(
                        latitude: latitude,
                        longitude: longitude
                    )
                ) / 1_000
                best = max(best, distanceBoost(distance) + 18)
            }
            if let userLocation {
                let distance = NearbyGeometry.distanceMeters(
                    from: userLocation,
                    to: catalogCoordinate
                ) / 1_000
                best = max(best, distanceBoost(distance) * 0.4)
            }
        }
        return best.isFinite ? best : 0
    }

    private static func segmentRank(_ level: ArticleSegmentLevel?) -> Int {
        switch level {
        case .municipality:
            0
        case .walkArea:
            1
        case .prefecture:
            2
        case .region, nil:
            3
        case .national:
            4
        }
    }

    private static func segmentTier(
        _ article: ArticleSummary,
        spots: [ArticleRankingSpot],
        nearestDistanceKilometers: Double,
        context: ArticleRankingContext
    ) -> Int {
        let userTags = uniqueStrings(
            [context.userMunicipality ?? ""] + context.walkAreaTags
        )
        let hasUserArea = !userTags.isEmpty
            || context.userPrefecture?.contentNonEmpty != nil
        if !hasUserArea {
            return segmentRank(article.segmentLevel)
        }

        let exact =
            intersects(article.targetMunicipalities, userTags)
                || intersects(article.targetWalkAreaTags, context.walkAreaTags)
                || spots.contains {
                    guard let municipality = $0.municipality else { return false }
                    return intersects([municipality], userTags)
                }
        if exact { return 0 }

        if let prefecture = context.userPrefecture?.contentNonEmpty {
            if
                intersects(article.targetPrefectures, [prefecture])
                    || spots.contains(where: { $0.prefecture == prefecture })
            {
                return 1
            }
        }
        if nearestDistanceKilometers.isFinite {
            if nearestDistanceKilometers < 30 { return 1 }
            if nearestDistanceKilometers < 100 { return 2 }
        }
        let explicit = !article.targetMunicipalities.isEmpty
            || !article.targetWalkAreaTags.isEmpty
            || !article.targetPrefectures.isEmpty
        if
            !explicit
                || article.segmentLevel == .region
                || article.segmentLevel == .national
        {
            return 3
        }
        return 4
    }

    private static func randomUnit(_ value: String) -> Double {
        var hash = Int32(bitPattern: 0x811c9dc5)
        for unit in value.utf16 {
            hash ^= Int32(unit)
            let product = Double(hash) * Double(0x01000193)
            hash = Int32(
                bitPattern: UInt32(truncatingIfNeeded: Int64(product))
            )
        }
        return Double(UInt32(bitPattern: hash)) / 4_294_967_296
    }

    private static func utcDateKey(_ date: Date) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(
            format: "%04d-%02d-%02d",
            parts.year ?? 0,
            parts.month ?? 0,
            parts.day ?? 0
        )
    }

    private static let walkAreasByLabel: [String: WalkAreaCatalogEntry] =
        OnboardingCatalog.walkAreas.reduce(into: [:]) { result, entry in
            if result[entry.label] == nil {
                result[entry.label] = entry
            }
        }
}

private extension String {
    var contentNonEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

private extension Sequence {
    func unique<Key: Hashable>(by keyPath: KeyPath<Element, Key>) -> [Element] {
        var seen = Set<Key>()
        return filter { seen.insert($0[keyPath: keyPath]).inserted }
    }
}
