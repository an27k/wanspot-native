import MapKit
import Observation
import SwiftUI
import WanspotKit

struct ArticlesTabView: View {
    @Environment(AppModel.self) private var model
    @Environment(AppRouter.self) private var router
    @Environment(LocationSession.self) private var locationSession

    @State private var store = ArticlesTabStore()

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                WanspotBrandHeader()
                    .padding(.bottom, 14)

                if !store.availableGenres.isEmpty {
                    genreChips
                        .padding(.bottom, 14)
                }

                feedContent
            }
            .padding(.horizontal, WanspotMetrics.pagePadding)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .background(WanspotColors.paper)
        .accessibilityIdentifier("articles.screen")
        .toolbar(.hidden, for: .navigationBar)
        .refreshable {
            await store.load(force: true)
        }
        .task {
            configureStore()
            await store.load()
        }
        .onChange(of: locationSession.location?.timestamp) {
            Task { await store.updateLocation(currentCoordinate) }
        }
    }

    private var genreChips: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ArticleGenreChip(
                    title: "すべて",
                    isSelected: store.selectedGenre == nil
                ) {
                    store.selectGenre(nil)
                }
                ForEach(store.availableGenres) { genre in
                    ArticleGenreChip(
                        title: genre.label,
                        isSelected: store.selectedGenre == genre
                    ) {
                        store.selectGenre(
                            store.selectedGenre == genre ? nil : genre
                        )
                    }
                }
            }
        }
        .scrollIndicators(.hidden)
    }

    @ViewBuilder
    private var feedContent: some View {
        if store.isLoading, store.articles.isEmpty {
            VStack(spacing: 14) {
                ForEach(0 ..< 3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 16)
                        .fill(WanspotColors.surface)
                        .frame(height: 112)
                        .overlay { ProgressView() }
                }
            }
        } else if let error = store.errorMessage, store.articles.isEmpty {
            WanspotErrorState(
                title: "記事の読み込みに失敗しました",
                message: error,
                actionTitle: "再試行"
            ) {
                Task { await store.load(force: true) }
            }
            .frame(minHeight: 320)
        } else if store.articles.isEmpty {
            WanspotEmptyState(
                title: "公開中の記事がありません",
                systemImage: "newspaper"
            )
            .frame(minHeight: 320)
        } else if store.filteredArticles.isEmpty {
            WanspotEmptyState(
                title: "このカテゴリの記事はまだありません",
                systemImage: "line.3.horizontal.decrease.circle"
            )
            .frame(minHeight: 260)
        } else {
            ForEach(Array(store.filteredArticles.enumerated()), id: \.element.id) {
                index,
                article in
                if index == 0 {
                    articleHero(article)
                        .padding(.bottom, 14)
                } else {
                    if index == 1 {
                        HStack(spacing: 8) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(WanspotColors.primary)
                                .frame(width: 4, height: 22)
                            Text("新着記事")
                                .font(.title3.weight(.heavy))
                                .foregroundStyle(WanspotColors.textPrimary)
                        }
                        .padding(.top, 12)
                        .padding(.bottom, 6)
                    }
                    articleRow(article)
                }
            }
        }
    }

    private func articleHero(_ article: ArticleSummary) -> some View {
        Button {
            open(article)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                WanspotRemoteImage(
                    url: ContentImageURL.resized(article.imageURL, to: .card),
                    cornerRadius: 0,
                    accessibilityLabel: article.title
                )
                .aspectRatio(16 / 9, contentMode: .fit)

                VStack(alignment: .leading, spacing: 9) {
                    let info = ArticleRules.parseTheme(article.theme)
                    let metadata = [info.area, info.genreLabel]
                        .compactMap { $0 }
                        .joined(separator: " ・ ")
                    if !metadata.isEmpty {
                        Text(metadata)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(WanspotColors.textSecondary)
                            .lineLimit(1)
                    }

                    Text(article.title)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(WanspotColors.textPrimary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)

                    if !article.summary.isEmpty {
                        Text(article.summary)
                            .font(.subheadline)
                            .foregroundStyle(WanspotColors.textSecondary)
                            .lineLimit(2)
                            .lineSpacing(2)
                            .multilineTextAlignment(.leading)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 15)
            }
            .background(WanspotColors.surface)
            .clipShape(.rect(cornerRadius: 16))
            .contentShape(
                .interaction,
                RoundedRectangle(cornerRadius: 16, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(WanspotColors.border)
            }
            .shadow(color: .black.opacity(0.035), radius: 2, y: 1)
        }
        .buttonStyle(.plain)
    }

    private func articleRow(_ article: ArticleSummary) -> some View {
        Button {
            open(article)
        } label: {
            HStack(spacing: 12) {
                WanspotRemoteImage(
                    url: ContentImageURL.resized(
                        article.imageURL,
                        to: .thumbnail
                    ),
                    cornerRadius: 10,
                    accessibilityLabel: article.title
                )
                .frame(width: 88, height: 72)

                VStack(alignment: .leading, spacing: 6) {
                    let info = ArticleRules.parseTheme(article.theme)
                    HStack(spacing: 7) {
                        if let area = info.area {
                            Text(area)
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(WanspotColors.textSecondary)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(
                                    WanspotColors.border.opacity(0.6),
                                    in: Capsule()
                                )
                                .lineLimit(1)
                        }
                        if let genre = info.genreLabel {
                            Text(genre)
                                .font(.caption2)
                                .foregroundStyle(WanspotColors.textSecondary)
                        }
                    }
                    Text(article.title)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(WanspotColors.textPrimary)
                        .lineLimit(2)
                        .lineSpacing(2)
                        .multilineTextAlignment(.leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "chevron.right")
                    .font(.caption.bold())
                    .foregroundStyle(WanspotColors.textSecondary)
            }
            .padding(.vertical, 11)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(WanspotColors.border)
                    .frame(height: 1)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var currentCoordinate: NearbyCoordinate? {
        locationSession.location.map {
            NearbyCoordinate(
                latitude: $0.coordinate.latitude,
                longitude: $0.coordinate.longitude
            )
        }
    }

    private func configureStore() {
        store.configure(
            repository: model.articlesRepository,
            profileRepository: model.profileRepository,
            activityRepository: model.spotActivityRepository,
            userID: model.currentUserID,
            location: currentCoordinate
        )
    }

    private func open(_ article: ArticleSummary) {
        store.markOpened(article.id)
        router.navigate(to: .article(slug: article.slug))
        Task { await store.rerank() }
    }
}

private struct ArticleGenreChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(
                    isSelected ? WanspotColors.onPrimary : WanspotColors.textSecondary
                )
                .padding(.horizontal, 14)
                .frame(height: 36)
                .background(
                    isSelected ? WanspotColors.primary : WanspotColors.surface,
                    in: Capsule()
                )
                .overlay {
                    Capsule().strokeBorder(
                        isSelected ? Color.clear : WanspotColors.border
                    )
                }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityIdentifier("articles.genre.\(title)")
    }
}

@MainActor
@Observable
private final class ArticlesTabStore {
    private(set) var articles: [ArticleSummary] = []
    private(set) var rankedArticles: [ArticleSummary] = []
    private(set) var selectedGenre: ArticleGenre?
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    private var repository: ArticlesRepository?
    private var profileRepository: SupabaseProfileRepository?
    private var activityRepository: SupabaseSpotActivityRepository?
    private var userID: String?
    private var location: NearbyCoordinate?
    private var userPrefecture: String?
    private var userMunicipality: String?
    private var walkAreaTags: [String] = []
    private var likes: [SpotLike] = []
    private var checkIns: [CheckIn] = []
    private var recentArticleIDs = Set<String>()
    private var didLoad = false

    var availableGenres: [ArticleGenre] {
        ArticleRules.availableGenres(in: rankedArticles)
    }

    var filteredArticles: [ArticleSummary] {
        guard let selectedGenre else { return rankedArticles }
        let filtered = rankedArticles.filter {
            ArticleRules.parseTheme($0.theme).genre == selectedGenre
        }
        return selectedGenre == .event
            ? ArticleRules.eventRoundupOrder(filtered)
            : filtered
    }

    func configure(
        repository: ArticlesRepository?,
        profileRepository: SupabaseProfileRepository?,
        activityRepository: SupabaseSpotActivityRepository?,
        userID: String?,
        location: NearbyCoordinate?
    ) {
        self.repository = repository
        self.profileRepository = profileRepository
        self.activityRepository = activityRepository
        self.userID = userID
        self.location = location
    }

    func updateLocation(_ location: NearbyCoordinate?) async {
        self.location = location
        await resolveLocationContext()
        await rerank()
    }

    func selectGenre(_ genre: ArticleGenre?) {
        selectedGenre = genre
    }

    func markOpened(_ id: String) {
        recentArticleIDs.insert(id)
    }

    func load(force: Bool = false) async {
        guard let repository else {
            errorMessage = ContentRepositoryError.unavailable.localizedDescription
            return
        }
        if didLoad, !force { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let rows = try await repository.fetchArticles(force: force)
            articles = rows
            rankedArticles = rows
            didLoad = true
            await loadPersonalization()
            await resolveLocationContext()
            await rerank()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func rerank() async {
        guard let repository, !articles.isEmpty else { return }
        let context = ArticleRankingContext(
            userLocation: location,
            userPrefecture: userPrefecture,
            userMunicipality: userMunicipality,
            walkAreaTags: walkAreaTags,
            recentArticleIDs: recentArticleIDs,
            likedAtBySpotID: latestDates(
                likes.compactMap { row in
                    row.createdAt.flatMap(parseDate).map {
                        (row.spotID, $0)
                    }
                }
            ),
            checkedAtBySpotID: latestDates(
                checkIns.compactMap { row in
                    row.createdAt.flatMap(parseDate).map { (row.spotID, $0) }
                }
            ),
            userSeed: userID ?? "anon"
        )
        rankedArticles = await repository.rankedArticles(
            articles,
            context: context
        )
    }

    private func loadPersonalization() async {
        guard let userID else {
            walkAreaTags = []
            likes = []
            checkIns = []
            return
        }
        async let fetchedTags: [String] = {
            (try? await profileRepository?.fetchWalkAreaTags(userID: userID))
                ?? []
        }()
        async let fetchedLikes: [SpotLike] = {
            (try? await activityRepository?.fetchLikes(userID: userID)) ?? []
        }()
        async let fetchedCheckIns: [CheckIn] = {
            (try? await activityRepository?.fetchCheckIns(userID: userID)) ?? []
        }()
        let values = await (fetchedTags, fetchedLikes, fetchedCheckIns)
        walkAreaTags = values.0
        likes = values.1
        checkIns = values.2
    }

    private func resolveLocationContext() async {
        guard let requested = location else {
            userPrefecture = nil
            userMunicipality = nil
            return
        }
        let resolved = await articleGeoResolver.prefectureAndMunicipality(
            latitude: requested.latitude,
            longitude: requested.longitude
        )
        guard location == requested else { return }
        userPrefecture = resolved.prefecture
        userMunicipality = resolved.municipality
    }

    private func parseDate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [
            .withInternetDateTime,
            .withFractionalSeconds,
        ]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    private func latestDates(
        _ values: [(String, Date)]
    ) -> [String: Date] {
        values.reduce(into: [:]) { result, pair in
            if result[pair.0] == nil || result[pair.0]! < pair.1 {
                result[pair.0] = pair.1
            }
        }
    }
}

private let articleGeoResolver = CachedGeoResolver {
    latitude,
    longitude in
    try await ArticleReverseGeocoder.resolve(
        latitude: latitude,
        longitude: longitude
    )
}

@MainActor
private enum ArticleReverseGeocoder {
    static func resolve(
        latitude: Double,
        longitude: Double
    ) async throws -> ReverseGeocodeResult? {
        guard
            let request = MKReverseGeocodingRequest(
                location: CLLocation(
                    latitude: latitude,
                    longitude: longitude
                )
            )
        else {
            return nil
        }
        request.preferredLocale = Locale(identifier: "ja_JP")
        guard
            let item = try await request.mapItems.first,
            let address = item.addressRepresentations
        else {
            return nil
        }
        return ReverseGeocodeResult(
            region: address.regionName,
            subregion: nil,
            city: address.cityName,
            district: nil
        )
    }
}
