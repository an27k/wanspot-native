import Foundation
import Observation
import WanspotKit

struct SpotDetailNotice: Identifiable {
    let id = UUID()
    let title: String
    let message: String
}

@MainActor
@Observable
final class SpotDetailStore {
    let routeID: String

    private(set) var detail: SpotDetail?
    private(set) var photoURLs: [URL] = []
    private(set) var isLoading = true
    private(set) var loadError: String?
    private(set) var isAILoading = false
    private(set) var aiSummary: AISummary?
    private(set) var aiEmptyReason: AISummaryEmptyReason?
    private(set) var likeCount = 0
    private(set) var isLiked = false
    private(set) var isLikeBusy = false
    private(set) var isVisited = false
    private(set) var isVisitBusy = false
    private(set) var visitID: String?
    private(set) var isRatingSaving = false
    private(set) var isMemoSaving = false
    private(set) var isTipSubmitting = false
    private(set) var memoWasSaved = false
    private(set) var relatedArticles: [ArticleSummary] = []

    var userRating = 0
    var userMemo = ""
    var notice: SpotDetailNotice?

    @ObservationIgnored private var resolver: SpotDetailResolver?
    @ObservationIgnored private var spotsRepository: SpotsRepository?
    @ObservationIgnored private var activityRepository: SupabaseSpotActivityRepository?
    @ObservationIgnored private var visitsRepository: SupabaseVisitsRepository?
    @ObservationIgnored private var cachedService: CachedWanspotService?
    @ObservationIgnored private var profileRepository: SupabaseProfileRepository?
    @ObservationIgnored private var navigationState: SpotDetailNavigationState?
    @ObservationIgnored private var userID: String?
    @ObservationIgnored private var location: NearbyCoordinate?
    @ObservationIgnored private var loadGeneration = UUID()
    @ObservationIgnored private var memoSaveTask: Task<Void, Never>?

    init(routeID: String) {
        self.routeID = routeID
    }

    func load(
        resolver: SpotDetailResolver,
        spotsRepository: SpotsRepository,
        activityRepository: SupabaseSpotActivityRepository,
        visitsRepository: SupabaseVisitsRepository,
        cachedService: CachedWanspotService,
        profileRepository: SupabaseProfileRepository,
        articlesRepository: ArticlesRepository?,
        navigationState: SpotDetailNavigationState,
        userID: String?,
        location: NearbyCoordinate?
    ) async {
        memoSaveTask?.cancel()
        self.resolver = resolver
        self.spotsRepository = spotsRepository
        self.activityRepository = activityRepository
        self.visitsRepository = visitsRepository
        self.cachedService = cachedService
        self.profileRepository = profileRepository
        self.navigationState = navigationState
        self.userID = userID
        self.location = location
        if userID == nil {
            aiSummary = nil
            aiEmptyReason = nil
            isAILoading = false
        }

        let generation = UUID()
        loadGeneration = generation
        loadError = nil
        memoWasSaved = false

        if let bootstrap = await resolver.bootstrap(routeID: routeID) {
            apply(detail: bootstrap, repository: spotsRepository)
            isLoading = false
        } else {
            isLoading = detail == nil
        }

        do {
            let resolved = try await resolver.resolve(
                routeID: routeID,
                allowEnsuringSpot: userID != nil
            )
            guard loadGeneration == generation else { return }
            apply(detail: resolved, repository: spotsRepository)
            isLoading = false

            async let activity = fetchActivitySnapshot(
                activityRepository: activityRepository,
                visitsRepository: visitsRepository,
                userID: userID,
                spotID: resolved.spotID
            )
            async let articles = fetchRelatedArticles(
                repository: articlesRepository,
                detail: resolved
            )
            if let userID {
                isAILoading = true
                async let ai = fetchAISummary(
                    service: cachedService,
                    profileRepository: profileRepository,
                    userID: userID,
                    detail: resolved,
                    location: location,
                    force: false
                )
                let (activitySnapshot, relatedArticles) = await (
                    activity,
                    articles
                )
                guard loadGeneration == generation else { return }
                apply(activitySnapshot)
                self.relatedArticles = relatedArticles
                let aiOutcome = await ai
                guard loadGeneration == generation else { return }
                apply(aiOutcome)
                isAILoading = false
            } else {
                let (activitySnapshot, relatedArticles) = await (
                    activity,
                    articles
                )
                guard loadGeneration == generation else { return }
                apply(activitySnapshot)
                self.relatedArticles = relatedArticles
                aiSummary = nil
                aiEmptyReason = nil
                isAILoading = false
            }
        } catch {
            guard loadGeneration == generation else { return }
            isLoading = false
            isAILoading = false
            if detail == nil {
                loadError = error.localizedDescription
            } else {
                notice = SpotDetailNotice(
                    title: "一部の情報を更新できませんでした",
                    message: "表示中の情報はそのまま利用できます。通信環境のよい場所で再読み込みしてください。"
                )
            }
        }
    }

    func reloadAI() async {
        guard
            let detail,
            let cachedService,
            let profileRepository,
            let userID
        else {
            return
        }
        isAILoading = true
        let outcome = await fetchAISummary(
            service: cachedService,
            profileRepository: profileRepository,
            userID: userID,
            detail: detail,
            location: location,
            force: true
        )
        apply(outcome)
        isAILoading = false
    }

    func toggleLike() async {
        guard !isLikeBusy, let userID, let activityRepository else { return }
        isLikeBusy = true
        defer { isLikeBusy = false }

        do {
            let spotID = try await ensureSpotID()
            let newValue = !isLiked
            try await activityRepository.setLike(
                userID: userID,
                spotID: spotID,
                isLiked: newValue
            )
            isLiked = newValue
            likeCount = max(0, likeCount + (newValue ? 1 : -1))
        } catch {
            showActionError(
                title: "いいねを更新できませんでした",
                error: error
            )
        }
    }

    func recordVisit() async {
        guard !isVisitBusy, let userID, let visitsRepository else { return }
        isVisitBusy = true
        defer { isVisitBusy = false }

        do {
            let spotID = try await ensureSpotID()
            let result = try await visitsRepository.recordSpotVisit(
                userID: userID,
                spotID: spotID,
                source: .detailButton
            )
            visitID = result.visitID
            isVisited = true
        } catch {
            showActionError(
                title: "行った記録を保存できませんでした",
                error: error
            )
        }
    }

    func cancelVisit() async {
        guard !isVisitBusy, let userID, let visitsRepository else { return }
        isVisitBusy = true
        defer { isVisitBusy = false }

        do {
            let spotID = try await ensureSpotID()
            guard
                try await visitsRepository.cancelTodaySpotVisit(
                    userID: userID,
                    spotID: spotID
                ) != nil
            else {
                throw SpotDetailStoreError.visitNotFound
            }
            isVisited = false
            memoSaveTask?.cancel()
            memoSaveTask = nil
            visitID = nil
            userRating = 0
            userMemo = ""
            memoWasSaved = false
        } catch {
            showActionError(
                title: "行った記録を取り消せませんでした",
                error: error
            )
        }
    }

    func saveRating(_ rating: Int) async {
        guard
            (1 ... 5).contains(rating),
            !isRatingSaving,
            let visitID,
            let visitsRepository
        else {
            return
        }
        let previous = userRating
        userRating = rating
        isRatingSaving = true
        defer { isRatingSaving = false }

        do {
            try await visitsRepository.updateVisit(
                visitID: visitID,
                patch: VisitPatch(rating: .set(rating))
            )
        } catch {
            userRating = previous
            showActionError(
                title: "評価を保存できませんでした",
                error: error
            )
        }
    }

    func memoDidChange(_ value: String) {
        userMemo = value
        memoWasSaved = false
        guard isVisited, visitID != nil else { return }
        scheduleMemoSave(after: .milliseconds(800))
    }

    func saveMemo() async {
        guard
            let visitID,
            let visitsRepository
        else {
            return
        }
        memoSaveTask?.cancel()
        memoSaveTask = nil
        guard !isMemoSaving else {
            scheduleMemoSave(after: .milliseconds(250))
            return
        }
        let submittedValue = normalizedMemo(userMemo)
        isMemoSaving = true
        defer {
            isMemoSaving = false
            if
                isVisited,
                self.visitID != nil,
                normalizedMemo(userMemo) != submittedValue
            {
                scheduleMemoSave(after: .milliseconds(250))
            }
        }

        do {
            try await visitsRepository.updateVisit(
                visitID: visitID,
                patch: VisitPatch(
                    comment: submittedValue.isEmpty
                        ? .clear
                        : .set(submittedValue)
                )
            )
            memoWasSaved = normalizedMemo(userMemo) == submittedValue
        } catch {
            showActionError(
                title: "メモを保存できませんでした",
                error: error
            )
        }
    }

    private func scheduleMemoSave(after delay: Duration) {
        memoSaveTask?.cancel()
        memoSaveTask = Task { @MainActor [weak self] in
            do {
                try await Task.sleep(for: delay)
            } catch {
                return
            }
            guard !Task.isCancelled, let self else { return }
            self.memoSaveTask = nil
            await self.saveMemo()
        }
    }

    private func normalizedMemo(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func submitTip(_ body: String) async -> Bool {
        guard
            !isTipSubmitting,
            let userID,
            let activityRepository
        else {
            return false
        }
        isTipSubmitting = true
        defer { isTipSubmitting = false }

        do {
            let spotID = try await ensureSpotID()
            try await activityRepository.submitInfoTip(
                spotID: spotID,
                userID: userID,
                body: body
            )
            return true
        } catch {
            showActionError(
                title: "情報を送信できませんでした",
                error: error
            )
            return false
        }
    }

    private func ensureSpotID() async throws -> String {
        if let spotID = detail?.spotID, SpotIdentifier.isUUID(spotID) {
            return spotID
        }
        guard
            let current = detail,
            let spotsRepository,
            let navigationState
        else {
            throw SpotDetailStoreError.spotIDUnavailable
        }
        let spotID = try await spotsRepository.ensureSpotID(
            placeID: current.placeID
        )
        detail = current.replacingSpotID(spotID)
        await navigationState.setSpotUUID(spotID, for: current.placeID)
        return spotID
    }

    private func apply(
        detail: SpotDetail,
        repository: SpotsRepository
    ) {
        self.detail = detail
        photoURLs = repository.photoURLs(
            references: detail.photoReferences,
            placeID: detail.placeID
        )
    }

    private func apply(_ snapshot: SpotActivitySnapshot) {
        likeCount = snapshot.likeCount
        isLiked = snapshot.isLiked
        isVisited = snapshot.visit != nil
        visitID = snapshot.visit?.id
        userRating = snapshot.visit?.rating ?? 0
        userMemo = snapshot.visit?.comment ?? ""
    }

    private func apply(_ outcome: AISummaryOutcome?) {
        switch outcome {
        case let .summary(summary):
            aiSummary = summary
            aiEmptyReason = nil
        case let .empty(reason):
            aiSummary = nil
            aiEmptyReason = reason
        case nil:
            aiSummary = nil
            aiEmptyReason = .busy
        }
    }

    private func showActionError(title: String, error: Error) {
        let rawMessage = error.localizedDescription
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let exposesInternalDetails = rawMessage.range(
            of: #"(permission denied|row.?level security|\brls\b|\bpgrst|sqlstate|duplicate key|foreign key|violates|relation .+ does not exist|table [a-z_]+|column [a-z_]+)"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
        let message = rawMessage.isEmpty || exposesInternalDetails
            ? "時間をおいて、もう一度お試しください。"
            : rawMessage
        notice = SpotDetailNotice(title: title, message: message)
    }
}

private struct SpotActivitySnapshot: Sendable {
    let likeCount: Int
    let isLiked: Bool
    let visit: Visit?
}

private enum SpotDetailStoreError: LocalizedError {
    case spotIDUnavailable
    case visitNotFound

    var errorDescription: String? {
        switch self {
        case .spotIDUnavailable:
            "スポット情報を準備できませんでした。再読み込みしてお試しください。"
        case .visitNotFound:
            "本日の記録が見つかりませんでした。"
        }
    }
}

private func fetchActivitySnapshot(
    activityRepository: SupabaseSpotActivityRepository,
    visitsRepository: SupabaseVisitsRepository,
    userID: String?,
    spotID: String?
) async -> SpotActivitySnapshot {
    guard let spotID, SpotIdentifier.isUUID(spotID) else {
        return SpotActivitySnapshot(likeCount: 0, isLiked: false, visit: nil)
    }

    async let counts = try? await activityRepository.likeCounts(
        spotIDs: [spotID]
    )
    async let likes: [SpotLike]? = {
        guard let userID else { return nil }
        return try? await activityRepository.fetchLikes(userID: userID)
    }()
    async let visit: Visit? = {
        guard let userID else { return nil }
        return try? await visitsRepository.fetchTodaySpotVisit(
            userID: userID,
            spotID: spotID
        )
    }()
    let (resolvedCounts, resolvedLikes, resolvedVisit) = await (
        counts,
        likes,
        visit
    )
    return SpotActivitySnapshot(
        likeCount: resolvedCounts?[spotID] ?? 0,
        isLiked: resolvedLikes?.contains { $0.spotID == spotID } == true,
        visit: resolvedVisit
    )
}

private func fetchRelatedArticles(
    repository: ArticlesRepository?,
    detail: SpotDetail
) async -> [ArticleSummary] {
    guard let repository else { return [] }
    return (try? await repository.fetchRelatedArticles(
        spotID: detail.spotID,
        placeID: detail.placeID
    )) ?? []
}

private func fetchAISummary(
    service: CachedWanspotService,
    profileRepository: SupabaseProfileRepository,
    userID: String,
    detail: SpotDetail,
    location: NearbyCoordinate?,
    force: Bool
) async -> AISummaryOutcome? {
    async let dog: DogProfile? = {
        return try? await profileRepository.fetchPrimaryDog(userID: userID)
    }()
    async let tags: [String] = {
        return (try? await profileRepository.fetchWalkAreaTags(userID: userID))
            ?? []
    }()
    let (resolvedDog, resolvedTags) = await (dog, tags)
    let context = AISummaryRequest.UserContext(
        walkAreaTags: resolvedTags,
        latitude: location?.latitude,
        longitude: location?.longitude
    )
    return await service.fetchAISummary(
        AISummaryRequest(
            placeID: detail.placeID,
            spotID: detail.spotID,
            name: detail.name,
            category: detail.category,
            rating: detail.rating,
            address: detail.address,
            reviews: detail.reviews,
            dogSize: resolvedDog?.size?.rawValue,
            dogBreed: resolvedDog?.breed,
            dogName: resolvedDog?.name,
            userContext: context
        ),
        force: force
    )
}
