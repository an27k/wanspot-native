import Foundation

public struct CachedWanspotService: Sendable {
    private let client: WanspotAPIClient
    private let cache: MemoryCache

    public init(
        client: WanspotAPIClient,
        cache: MemoryCache = MemoryCache()
    ) {
        self.client = client
        self.cache = cache
    }

    public func fetchAISummary(
        _ request: AISummaryRequest,
        force: Bool = false
    ) async -> AISummaryOutcome? {
        let dogKey = "\(request.dogSize ?? "none"):\(request.dogBreed ?? "none")"
        let reviewsKey = request.reviews?.isEmpty == false
            ? "withReviews"
            : "noReviews"
        let key =
            "ai-summary:v2:\(request.placeID):\(dogKey):\(reviewsKey)"

        do {
            let result: CacheFetchResult<AISummary> = try await cache.fetch(
                key,
                ttl: CacheTTL.aiSummary,
                force: force
            ) {
                guard let outcome = await client.fetchAISummary(request) else {
                    throw CachedWanspotServiceError.unavailable
                }
                switch outcome {
                case let .summary(summary):
                    return summary
                case let .empty(reason):
                    throw CachedWanspotServiceError.empty(reason)
                }
            }
            return .summary(result.value)
        } catch let CachedWanspotServiceError.empty(reason) {
            return .empty(reason)
        } catch {
            return nil
        }
    }

    public func fetchWalkLine(
        latitude: Double,
        longitude: Double,
        now: Date = Date()
    ) async -> WalkLine? {
        let key =
            "walk-line:v1:\(tokyoDateKey(now)):\(geoBucket(latitude: latitude, longitude: longitude, decimals: 1))"
        do {
            let result: CacheFetchResult<WalkLine?> = try await cache.fetch(
                key,
                ttl: 48 * 60 * 60
            ) {
                await client.fetchWalkLine(
                    latitude: latitude,
                    longitude: longitude
                )
            }
            return result.value
        } catch {
            return nil
        }
    }

    public func fetchCloudQualityScores(
        _ items: [CloudQualityItem]
    ) async -> [String: CloudQualityResult] {
        await client.fetchCloudQualityScores(items)
    }

    public func requestVlogRender<Payload: Encodable & Sendable>(
        _ payload: Payload
    ) async -> VlogRenderOutcome {
        await client.requestVlogRender(payload)
    }
}

private enum CachedWanspotServiceError: Error, Sendable {
    case unavailable
    case empty(AISummaryEmptyReason)
}

private func tokyoDateKey(_ date: Date) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Asia/Tokyo")!
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    return String(
        format: "%04d-%02d-%02d",
        parts.year ?? 0,
        parts.month ?? 0,
        parts.day ?? 0
    )
}
