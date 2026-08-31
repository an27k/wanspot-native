import Foundation

public struct ArticlesRepository: Sendable {
    private let client: WanspotAPIClient
    private let cache: MemoryCache

    public init(
        client: WanspotAPIClient,
        cache: MemoryCache = MemoryCache()
    ) {
        self.client = client
        self.cache = cache
    }

    public func fetchArticles(
        force: Bool = false
    ) async throws -> [ArticleSummary] {
        do {
            let result: CacheFetchResult<ArticlesResponse> =
                try await cache.fetch(
                    "articles:list:v3",
                    ttl: CacheTTL.articles,
                    force: force
                ) {
                    try await client.fetchArticles()
                }
            return result.value.articles
        } catch {
            throw ContentRepositoryError.unavailable
        }
    }

    public func fetchRelatedArticles(
        spotID: String?,
        placeID: String,
        limit: Int = 3,
        force: Bool = false
    ) async throws -> [ArticleSummary] {
        ArticleRules.relatedArticles(
            in: try await fetchArticles(force: force),
            spotID: spotID,
            placeID: placeID,
            limit: limit
        )
    }

    public func fetchRelatedArticles(
        eventID: String,
        eventMonth: String? = nil,
        prefecture: String? = nil,
        limit: Int = 3,
        force: Bool = false
    ) async throws -> [ArticleSummary] {
        ArticleRules.relatedArticles(
            in: try await fetchArticles(force: force),
            eventID: eventID,
            eventMonth: eventMonth,
            prefecture: prefecture,
            limit: limit
        )
    }

    public func fetchArticle(
        idOrSlug: String,
        force: Bool = false
    ) async throws -> ArticleDetail? {
        let key = idOrSlug.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty else {
            throw WanspotAPIError.invalidRequest("記事IDまたはslugが必要です。")
        }
        do {
            let result: CacheFetchResult<ArticleDetail?> = try await cache.fetch(
                "articles:detail:v1:\(key)",
                ttl: CacheTTL.articleDetail,
                force: force
            ) {
                do {
                    let response = try await client.fetchArticle(idOrSlug: key)
                    return response.article
                } catch let WanspotAPIError.httpStatus(code, _) where code == 404 {
                    return nil
                }
            }
            return result.value
        } catch let error as WanspotAPIError {
            throw error
        } catch {
            throw ContentRepositoryError.unavailable
        }
    }

    public func rankedArticles(
        _ articles: [ArticleSummary],
        context: ArticleRankingContext
    ) async -> [ArticleSummary] {
        let references = uniqueReferences(
            articles.flatMap(\.linkedSpotReferences)
        )
        guard !references.isEmpty else {
            return ArticleRules.rank(
                articles,
                spotsByReference: [:],
                context: context
            )
        }
        let referenceKey = references.sorted().joined(separator: "\u{1e}")
        let spots: [PublicSpot]
        do {
            let result: CacheFetchResult<[PublicSpot]> = try await cache.fetch(
                "articles:ranking-spots:v1:\(referenceKey)",
                ttl: CacheTTL.articles
            ) {
                try await fetchSpots(
                    references: references,
                    columns: .geo
                )
            }
            spots = result.value
        } catch {
            return ArticleRules.rank(
                articles,
                spotsByReference: [:],
                context: context
            )
        }

        var byReference: [String: ArticleRankingSpot] = [:]
        for row in spots {
            guard let spot = ArticleRankingSpot(row) else { continue }
            byReference[spot.id] = spot
            if let placeID = spot.placeID {
                byReference[placeID] = spot
            }
        }
        return ArticleRules.rank(
            articles,
            spotsByReference: byReference,
            context: context
        )
    }

    public func fetchLinkedSpots(
        for article: ArticleDetail,
        force: Bool = false
    ) async -> [String: ArticleLinkedSpot] {
        let references = uniqueReferences(article.linkedSpotReferences)
        guard !references.isEmpty else { return [:] }
        let referenceKey = references.sorted().joined(separator: "\u{1e}")
        do {
            let result: CacheFetchResult<[String: ArticleLinkedSpot]> =
                try await cache.fetch(
                    "articles:linked-spots:v1:\(article.id):\(referenceKey)",
                    ttl: CacheTTL.articleDetail,
                    force: force
                ) {
                    let rows = try await fetchSpots(
                        references: references,
                        columns: .card
                    )
                    var rowsByReference: [String: PublicSpot] = [:]
                    for row in rows {
                        if let id = row.id?.nonEmpty {
                            rowsByReference[id] = row
                        }
                        if let placeID = row.placeID?.nonEmpty {
                            rowsByReference[placeID] = row
                        }
                    }

                    let placeIDs = Array(
                        Set(rows.compactMap { $0.placeID?.nonEmpty })
                    )
                    let details = (try? await client.fetchBatchDetails(
                        placeIDs: placeIDs
                    )) ?? [:]

                    var linked: [String: ArticleLinkedSpot] = [:]
                    for reference in references {
                        guard let row = rowsByReference[reference] else { continue }
                        let enrichment = row.placeID.flatMap { details[$0] }
                        let photoReference =
                            enrichment?.photoReference ?? row.photoReference
                        let photoURL = try? client.spotPhotoURL(
                            reference: photoReference,
                            placeID: row.placeID,
                            width: .card
                        )
                        linked[reference] = ArticleLinkedSpot(
                            row: row,
                            enrichment: enrichment,
                            photoURL: photoURL
                        )
                    }
                    return linked
                }
            return result.value
        } catch {
            return [:]
        }
    }

    private func fetchSpots(
        references: [String],
        columns: SpotColumnSet
    ) async throws -> [PublicSpot] {
        let ids = references.filter(SpotIdentifier.isUUID)
        let placeIDs = references.filter { !SpotIdentifier.isUUID($0) }
        return try await client.fetchSpotsByIDs(
            ids: ids,
            placeIDs: placeIDs,
            columns: columns
        )
    }

    private func uniqueReferences(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.compactMap { raw in
            guard
                let value = raw.nonEmpty,
                seen.insert(value).inserted
            else {
                return nil
            }
            return value
        }
    }
}

public extension WanspotAPIClient {
    func fetchArticles() async throws -> ArticlesResponse {
        try await get(
            "/api/articles",
            queryItems: [
                URLQueryItem(name: "limit", value: "200"),
            ],
            authenticated: false
        )
    }

    func fetchArticle(
        idOrSlug: String
    ) async throws -> ArticleDetailResponse {
        var pathCharacters = CharacterSet.alphanumerics
        pathCharacters.insert(charactersIn: "-._~")
        let encoded = idOrSlug.addingPercentEncoding(
            withAllowedCharacters: pathCharacters
        ) ?? idOrSlug
        return try await get(
            "/api/articles/\(encoded)",
            authenticated: false
        )
    }
}

private extension String {
    var nonEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
