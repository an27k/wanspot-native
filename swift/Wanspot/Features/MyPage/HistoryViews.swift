import Foundation
import Observation
import SwiftUI
import WanspotKit

struct LikesListView: View {
    var body: some View {
        UserSpotHistoryListView(kind: .liked)
    }
}

struct VisitedHistoryView: View {
    var body: some View {
        UserSpotHistoryListView(kind: .visited)
    }
}

private enum HistorySort: String, CaseIterable, Hashable {
    case newest
    case name
    case rating

    var title: String {
        switch self {
        case .newest:
            "新しい順"
        case .name:
            "名前順"
        case .rating:
            "評価順"
        }
    }
}

private struct UserSpotHistoryListView: View {
    @Environment(AppModel.self) private var model
    @Environment(AppRouter.self) private var router
    @State private var store: UserSpotHistoryStore
    @State private var sort: HistorySort = .newest

    init(kind: UserSpotHistoryKind) {
        _store = State(initialValue: UserSpotHistoryStore(kind: kind))
    }

    var body: some View {
        List {
            if store.isLoading, store.items.isEmpty {
                Section {
                    HStack {
                        Spacer()
                        ProgressView("読み込み中…")
                        Spacer()
                    }
                    .padding(.vertical, 28)
                }
            } else if let errorMessage = store.errorMessage,
                      store.items.isEmpty
            {
                Section {
                    VStack(spacing: 12) {
                        Label(
                            errorMessage,
                            systemImage: "exclamationmark.triangle"
                        )
                        .foregroundStyle(WanspotColors.error)
                        Button("再試行") {
                            Task { await store.load(model: model) }
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                }
            } else if store.items.isEmpty {
                Section {
                    VStack(spacing: 10) {
                        Image(systemName: emptyIcon)
                            .font(.system(size: 38, weight: .semibold))
                            .foregroundStyle(WanspotColors.textSecondary)
                        Text(emptyTitle)
                            .font(.headline)
                        Text(emptyMessage)
                            .font(.subheadline)
                            .foregroundStyle(WanspotColors.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 36)
                }
            } else {
                Section {
                    ForEach(sortedItems) { item in
                        Button {
                            open(item)
                        } label: {
                            UserSpotHistoryRow(
                                item: item,
                                photoURL: photoURL(for: item)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(!item.isAvailable)
                        .swipeActions(
                            edge: .trailing,
                            allowsFullSwipe: true
                        ) {
                            if store.kind == .liked {
                                Button("削除", role: .destructive) {
                                    Task {
                                        await store.removeLike(
                                            item,
                                            model: model
                                        )
                                    }
                                }
                            }
                        }
                    }
                } header: {
                    Text("累計 \(store.items.count)件")
                }
            }

            if let errorMessage = store.errorMessage, !store.items.isEmpty {
                Section {
                    Label(
                        errorMessage,
                        systemImage: "exclamationmark.triangle"
                    )
                    .font(.caption)
                    .foregroundStyle(WanspotColors.error)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(WanspotColors.paper)
        .navigationTitle(navigationTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if store.items.count > 1 {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Picker("並べ替え", selection: $sort) {
                            ForEach(HistorySort.allCases, id: \.self) {
                                option in
                                Text(option.title).tag(option)
                            }
                        }
                    } label: {
                        Label(sort.title, systemImage: "arrow.up.arrow.down")
                    }
                }
            }
        }
        .refreshable {
            await store.load(model: model)
        }
        .task {
            model.track(
                AppAnalyticsEvent(
                    store.kind == .liked
                        ? .likesViewed
                        : .visitedHistoryViewed
                )
            )
            await store.load(model: model)
        }
    }

    private var navigationTitle: String {
        store.kind == .liked ? "いいね" : "行ったスポット"
    }

    private var emptyIcon: String {
        store.kind == .liked ? "heart" : "pawprint"
    }

    private var emptyTitle: String {
        store.kind == .liked
            ? "いいねしたスポットがありません"
            : "まだ行ったスポットがありません"
    }

    private var emptyMessage: String {
        store.kind == .liked
            ? "気になるスポットのハートを押すと、ここにまとまります。"
            : "スポットで「行った」を記録すると、ここに表示されます。"
    }

    private var sortedItems: [ResolvedUserSpotHistoryItem] {
        switch sort {
        case .newest:
            store.items
        case .name:
            store.items.sorted {
                $0.name.localizedStandardCompare($1.name) == .orderedAscending
            }
        case .rating:
            store.items.sorted {
                ($0.rating ?? -Double.infinity)
                    > ($1.rating ?? -Double.infinity)
            }
        }
    }

    private func photoURL(
        for item: ResolvedUserSpotHistoryItem
    ) -> URL? {
        guard let client = model.wanspotAPIClient else { return nil }
        return try? client.spotPhotoURL(
            reference: item.photoReference,
            placeID: item.placeID,
            width: .card
        )
    }

    private func open(_ item: ResolvedUserSpotHistoryItem) {
        guard item.isAvailable else { return }
        model.track(
            AppAnalyticsEvent(
                .historySpotOpened,
                storageType: .spotView,
                properties: [
                    "source": .string(store.kind.rawValue),
                ]
            ),
            spotID: item.spotID
        )
        router.navigate(to: .spot(id: item.spotID))
    }
}

@MainActor
@Observable
private final class UserSpotHistoryStore {
    let kind: UserSpotHistoryKind
    private(set) var items: [ResolvedUserSpotHistoryItem] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    init(kind: UserSpotHistoryKind) {
        self.kind = kind
    }

    func load(model: AppModel) async {
        guard !isLoading else { return }
        guard
            let userID = model.currentUserID,
            let activity = model.spotActivityRepository,
            let resolver = model.userSpotHistoryResolver
        else {
            items = []
            errorMessage = "ログインが必要です。"
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let records: [UserSpotHistoryRecord]
            switch kind {
            case .liked:
                records = UserSpotHistoryMapping.likedRecords(
                    try await activity.fetchLikes(userID: userID)
                )
            case .visited:
                guard let visits = model.visitsRepository else {
                    throw AppModelError.unavailable
                }
                async let visitRows = visits.fetchVisits(userID: userID)
                async let checkInRows = activity.fetchCheckIns(userID: userID)
                let (resolvedVisits, resolvedCheckIns) = try await (
                    visitRows,
                    checkInRows
                )
                records = UserSpotHistoryMapping.visitedRecords(
                    visits: resolvedVisits,
                    checkIns: resolvedCheckIns
                )
            }
            items = try await resolver.resolve(records)
        } catch {
            errorMessage = "スポット履歴を読み込めませんでした。"
        }
    }

    func removeLike(
        _ item: ResolvedUserSpotHistoryItem,
        model: AppModel
    ) async {
        guard
            let userID = model.currentUserID,
            let activity = model.spotActivityRepository
        else {
            return
        }
        do {
            try await activity.setLike(
                userID: userID,
                spotID: item.spotID,
                isLiked: false
            )
            items.removeAll { $0.spotID == item.spotID }
            model.track(
                AppAnalyticsEvent(
                    .likeRemoved,
                    storageType: .unlike,
                    properties: [
                        "source": .string("likes_list"),
                    ]
                ),
                spotID: item.spotID
            )
        } catch {
            errorMessage = "いいねを削除できませんでした。"
        }
    }
}

private struct UserSpotHistoryRow: View {
    let item: ResolvedUserSpotHistoryItem
    let photoURL: URL?

    var body: some View {
        HStack(spacing: 12) {
            WanspotRemoteImage(
                url: photoURL,
                cornerRadius: 12,
                accessibilityLabel: item.name
            )
            .frame(width: 78, height: 78)

            VStack(alignment: .leading, spacing: 5) {
                Text(item.name)
                    .font(.headline)
                    .foregroundStyle(WanspotColors.textPrimary)
                    .lineLimit(2)

                Text(item.category)
                    .font(.caption)
                    .foregroundStyle(WanspotColors.textSecondary)

                if let address = item.address {
                    Text(address)
                        .font(.caption)
                        .foregroundStyle(WanspotColors.textSecondary)
                        .lineLimit(1)
                }

                HStack(spacing: 8) {
                    if let rating = item.rating {
                        Label(
                            rating.formatted(.number.precision(
                                .fractionLength(1)
                            )),
                            systemImage: "star.fill"
                        )
                        .foregroundStyle(.orange)
                    }
                    if let occurredAt = displayDate(item.occurredAt) {
                        Text(occurredAt)
                    }
                }
                .font(.caption2)
                .foregroundStyle(WanspotColors.textSecondary)
            }
            Spacer(minLength: 4)
            if item.isAvailable {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(WanspotColors.textSecondary)
            }
        }
        .padding(.vertical, 4)
        .opacity(item.isAvailable ? 1 : 0.65)
        .contentShape(.rect)
    }

    private func displayDate(_ value: String?) -> String? {
        guard let value else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [
            .withInternetDateTime,
            .withFractionalSeconds,
        ]
        guard
            let date = fractional.date(from: value)
                ?? ISO8601DateFormatter().date(from: value)
        else {
            return nil
        }
        return date.formatted(
            Date.FormatStyle()
                .year(.defaultDigits)
                .month(.abbreviated)
                .day()
                .locale(Locale(identifier: "ja_JP"))
        )
    }
}
