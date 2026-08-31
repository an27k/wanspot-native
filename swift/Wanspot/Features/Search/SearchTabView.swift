import CoreLocation
import MapKit
import SwiftUI
import UIKit
import WanspotKit

struct SearchTabView: View {
    @Environment(AppModel.self) private var model
    @Environment(AppRouter.self) private var router
    @Environment(LocationSession.self) private var locationSession

    @AppStorage("wanspot.mapSearchTutorialSeen.v1")
    private var hasSeenTutorial = false

    @State private var store = MapSearchStore()
    @State private var cameraPosition: MapCameraPosition = .region(Self.fallbackRegion)
    @State private var showsTutorial = false
    @State private var authenticationPrompt: WanspotAuthenticationPrompt?
    @FocusState private var isSearchFocused: Bool

    private static let fallbackRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 35.6812, longitude: 139.7671),
        span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
    )

    var body: some View {
        @Bindable var store = store

        ZStack {
            map

            if store.isLoading, store.rawSpots.isEmpty {
                ProgressView("周辺スポットを探しています")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, WanspotSpacing.lg)
                    .padding(.vertical, WanspotSpacing.md)
                    .background(.regularMaterial, in: Capsule())
                    .allowsHitTesting(false)
            }
        }
        .overlay(alignment: .top) {
            VStack(spacing: 10) {
                searchControls

                if permissionIsDenied {
                    locationPermissionBanner
                } else if locationIsUnavailable {
                    locationUnavailableBanner
                } else if let errorMessage = store.errorMessage {
                    errorBanner(errorMessage)
                }
            }
            .safeAreaPadding(.top, 8)
            .padding(.horizontal, WanspotSpacing.md)
        }
        .overlay(alignment: .bottom) {
            Group {
                if !store.displaySpots.isEmpty {
                    SpotCarousel(
                        store: store,
                        currentLocation: store.currentLocation,
                        photoURL: { store.photoURL(for: $0) },
                        onOpen: openSpot,
                        onLike: toggleLike
                    )
                } else if store.center != nil, !store.isLoading {
                    emptyResultsCard
                }
            }
            .safeAreaPadding(.bottom, 8)
        }
        .overlay(alignment: .bottomTrailing) {
            recenterButton
                .padding(.horizontal, WanspotSpacing.md)
                .padding(.bottom, store.displaySpots.isEmpty ? 116 : 224)
                // 現在地ボタンはカルーセルの上に置いてあるので、その上端までを
                // 申告すればチャットFABはカードにも現在地ボタンにも重ならない
                .measuresChatFABClearance()
        }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            store.configure(
                nearbyRepository: model.nearbyRepository,
                weatherRepository: model.weatherRepository,
                profileRepository: model.profileRepository,
                activityRepository: model.spotActivityRepository,
                apiClient: model.wanspotAPIClient,
                userID: model.currentUserID
            )
            await store.loadUserContext()

            if let coordinate = currentCoordinate {
                await store.updateCurrentLocation(coordinate)
            } else {
                locationSession.requestCurrentLocation()
            }

            if !hasSeenTutorial {
                showsTutorial = true
            }
        }
        .task(id: store.query) {
            guard isSearchFocused else { return }
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            await store.refreshSuggestions()
        }
        .onChange(of: locationSession.location?.timestamp) {
            guard let coordinate = currentCoordinate else { return }
            Task {
                await store.updateCurrentLocation(coordinate)
            }
        }
        .onChange(of: store.currentLocation) { previous, coordinate in
            guard previous == nil, let coordinate, store.searchAnchor == nil else {
                return
            }
            moveCamera(to: coordinate, span: 0.055)
        }
        .onChange(of: store.searchAnchor) { _, anchor in
            if let coordinate = anchor?.coordinate {
                moveCamera(to: coordinate, span: 0.035)
            } else if let coordinate = store.currentLocation {
                moveCamera(to: coordinate, span: 0.055)
            }
        }
        .onChange(of: store.selectedPlaceID) { _, _ in
            guard let coordinate = store.selectedSpot?.coordinate else { return }
            moveCamera(to: coordinate, span: 0.025)
        }
        .sheet(isPresented: $showsTutorial, onDismiss: markTutorialSeen) {
            MapSearchTutorial {
                showsTutorial = false
            }
            .presentationDetents([.height(410)])
            .presentationDragIndicator(.visible)
        }
        .wanspotAuthenticationPrompt($authenticationPrompt) {
            model.requestAuthentication()
        }
    }

    private var map: some View {
        Map(position: $cameraPosition, interactionModes: .all) {
            if let currentLocation = store.currentLocation {
                Annotation("現在地", coordinate: currentLocation.clLocationCoordinate) {
                    CurrentLocationMarker()
                }
            }

            if let searchAnchor = store.searchAnchor {
                Marker(
                    searchAnchor.label,
                    systemImage: "magnifyingglass",
                    coordinate: searchAnchor.coordinate.clLocationCoordinate
                )
                .tint(WanspotColors.coral)
            }

            ForEach(store.displaySpots) { displaySpot in
                Annotation(
                    displaySpot.spot.name,
                    coordinate: displaySpot.displayCoordinate.clLocationCoordinate,
                    anchor: .bottom
                ) {
                    SpotMapPin(
                        genre: NearbyFilter.displayGenre(
                            for: displaySpot.spot,
                            selectedGenre: store.selectedGenre
                        ),
                        isSelected: store.selectedPlaceID == displaySpot.id
                    ) {
                        withAnimation(.snappy) {
                            store.selectSpot(displaySpot.id)
                        }
                    }
                }
            }
        }
        .mapStyle(.standard)
        .mapControls {
            MapCompass()
            MapScaleView()
        }
        .ignoresSafeArea(edges: .top)
    }

    private var searchControls: some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)

                TextField("地名・駅名・スポット名", text: $store.query)
                    .focused($isSearchFocused)
                    .textInputAutocapitalization(.never)
                    .submitLabel(.search)
                    .onSubmit {
                        isSearchFocused = false
                        Task { await store.submitSearch() }
                    }

                if !store.query.isEmpty {
                    Button {
                        store.clearQuery()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("検索文字を消去")
                }
            }
            .padding(.horizontal, 14)
            .frame(height: 48)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color.primary.opacity(0.08))
            }

            if isSearchFocused, !store.suggestions.isEmpty {
                suggestionsPanel
            }

            filters

            if store.isSearchActive {
                searchRangeBar
            }
        }
    }

    private var suggestionsPanel: some View {
        VStack(spacing: 0) {
            ForEach(Array(store.suggestions.prefix(6))) { suggestion in
                Button {
                    isSearchFocused = false
                    Task {
                        await store.selectPrediction(suggestion)
                    }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "mappin.and.ellipse")
                            .foregroundStyle(WanspotColors.coral)
                            .frame(width: 24)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(suggestion.mainText)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                                .lineLimit(1)
                            if !suggestion.secondaryText.isEmpty {
                                Text(suggestion.secondaryText)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }

                        Spacer()
                    }
                    .padding(.horizontal, 14)
                    .frame(minHeight: 52)
                }
                .buttonStyle(.plain)

                if suggestion.id != store.suggestions.prefix(6).last?.id {
                    Divider()
                        .padding(.leading, 50)
                }
            }
        }
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.08))
        }
    }

    private var filters: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                conditionsMenu

                SearchFilterChip(
                    title: "すべて",
                    systemImage: "sparkles",
                    isSelected: store.selectedGenre == nil
                ) {
                    Task { await store.setGenre(nil) }
                }

                ForEach(NearbyGenre.allCases) { genre in
                    SearchFilterChip(
                        title: genre.label,
                        systemImage: genre.systemImage,
                        isSelected: store.selectedGenre == genre,
                        tint: genre.tint
                    ) {
                        Task { await store.setGenre(genre) }
                    }
                }
            }
            .padding(.horizontal, 1)
        }
        .scrollIndicators(.hidden)
    }

    private var conditionsMenu: some View {
        Menu {
            conditionButton(
                title: "店内OK",
                systemImage: "house.fill",
                isSelected: store.conditions.indoorOnly
            ) {
                store.toggleCondition(\.indoorOnly)
            }

            conditionButton(
                title: "テラスOK",
                systemImage: "sun.max.fill",
                isSelected: store.conditions.terraceOnly
            ) {
                store.toggleCondition(\.terraceOnly)
            }

            Divider()

            Button {
                guard model.isAuthenticated else {
                    authenticationPrompt = .likedFilter
                    return
                }
                store.toggleCondition(\.likedOnly)
            } label: {
                Label(
                    "いいね",
                    systemImage: store.conditions.likedOnly
                        ? "heart.fill"
                        : "heart"
                )
            }
        } label: {
            Image(systemName: "line.3.horizontal.decrease.circle")
                .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(store.conditions.activeCount > 0 ? WanspotColors.coral : .primary)
            .frame(width: 38, height: 38)
            .background(.regularMaterial, in: Circle())
            .overlay {
                Circle()
                    .strokeBorder(
                        store.conditions.activeCount > 0
                            ? WanspotColors.coral.opacity(0.45)
                            : Color.primary.opacity(0.08)
                    )
            }
        }
        .accessibilityLabel("条件")
        .accessibilityValue(
            store.conditions.activeCount > 0
                ? "\(store.conditions.activeCount)件選択中"
                : "未選択"
        )
    }

    private func conditionButton(
        title: String,
        systemImage: String,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Label(
                title,
                systemImage: isSelected ? "checkmark.circle.fill" : systemImage
            )
        }
    }

    private var searchRangeBar: some View {
        HStack(spacing: 9) {
            Image(systemName: "scope")
                .foregroundStyle(WanspotColors.coral)
            Text(store.searchedRangeHint)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
            Spacer()
            Button("現在地へ戻る") {
                Task { await store.clearSearch() }
            }
            .font(.caption.weight(.bold))
            .foregroundStyle(WanspotColors.coral)
        }
        .padding(.horizontal, 13)
        .frame(height: 38)
        .background(.regularMaterial, in: Capsule())
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
            Text(message)
                .font(.caption.weight(.semibold))
                .lineLimit(2)
            Spacer()
            Button("再試行") {
                Task { await store.reloadNearby() }
            }
            .font(.caption.bold())
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityIdentifier("search.error")
    }

    private var locationPermissionBanner: some View {
        HStack(spacing: 12) {
            Image(systemName: "location.slash.fill")
                .foregroundStyle(.orange)
            VStack(alignment: .leading, spacing: 2) {
                Text("位置情報を利用できません")
                    .font(.caption.weight(.bold))
                Text("地名検索はそのまま利用できます")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("設定") {
                guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                UIApplication.shared.open(url)
            }
            .font(.caption.bold())
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityIdentifier("search.locationDenied")
    }

    private var locationUnavailableBanner: some View {
        HStack(spacing: 12) {
            Image(systemName: "location.magnifyingglass")
                .foregroundStyle(WanspotColors.coral)
            Text("現在地を取得できません。地名や駅名から検索してください。")
                .font(.caption.weight(.semibold))
            Spacer()
            Button {
                locationSession.requestCurrentLocation()
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.plain)
            .accessibilityLabel("位置情報を再取得")
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityIdentifier("search.locationUnavailable")
    }

    private var emptyResultsCard: some View {
        VStack(spacing: 7) {
            Image(systemName: "pawprint")
                .font(.title2)
                .foregroundStyle(WanspotColors.coral)
            Text("条件に合うスポットがありません")
                .font(.subheadline.weight(.bold))
            Text("検索範囲や絞り込み条件を変えてみてください")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, WanspotSpacing.xl)
        .padding(.vertical, WanspotSpacing.lg)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .padding(.horizontal, WanspotSpacing.lg)
    }

    private var recenterButton: some View {
        Button {
            guard let coordinate = store.currentLocation else {
                locationSession.requestCurrentLocation()
                return
            }
            moveCamera(to: coordinate, span: 0.04)
        } label: {
            Image(systemName: "location.fill")
                .font(.body.weight(.bold))
                .foregroundStyle(WanspotColors.coral)
                .frame(width: 44, height: 44)
                .background(.regularMaterial, in: Circle())
                .overlay {
                    Circle().strokeBorder(Color.primary.opacity(0.08))
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("現在地を表示")
    }

    private var currentCoordinate: NearbyCoordinate? {
        guard let location = locationSession.location else { return nil }
        return NearbyCoordinate(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude
        )
    }

    private var permissionIsDenied: Bool {
        locationSession.authorizationStatus == .denied
            || locationSession.authorizationStatus == .restricted
    }

    private var locationIsUnavailable: Bool {
        !permissionIsDenied
            && locationSession.authorizationStatus != .notDetermined
            && store.currentLocation == nil
            && !store.isSearchActive
    }

    private func moveCamera(to coordinate: NearbyCoordinate, span: CLLocationDegrees) {
        withAnimation(.smooth(duration: 0.4)) {
            cameraPosition = .region(
                MKCoordinateRegion(
                    center: coordinate.clLocationCoordinate,
                    span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span)
                )
            )
        }
    }

    private func openSpot(_ spot: PlaceResult) {
        let routeID = SpotDetailNavigationState.placeRouteID(for: spot.placeID)
        Task {
            await model.spotDetailNavigationState.setPlace(routeID: routeID, place: spot)
            await model.spotDetailNavigationState.setHandoff(routeID: routeID, place: spot)
            await model.spotDetailNavigationState.stash(spotID: routeID, place: spot)
            if let spotID = spot.spotID {
                await model.spotDetailNavigationState.setSpotUUID(spotID, for: spot.placeID)
            }
            router.navigate(to: .spot(id: routeID))
        }
    }

    private func toggleLike(_ spot: PlaceResult) {
        guard model.isAuthenticated else {
            authenticationPrompt = .like
            return
        }
        Task {
            await store.toggleLike(spot)
        }
    }

    private func markTutorialSeen() {
        hasSeenTutorial = true
    }
}

private struct SearchFilterChip: View {
    let title: String
    let systemImage: String
    let isSelected: Bool
    var tint: Color = WanspotColors.coral
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isSelected ? .white : .primary)
                .padding(.horizontal, 13)
                .frame(height: 38)
                .background(isSelected ? tint : Color.clear, in: Capsule())
                .background(.regularMaterial, in: Capsule())
                .overlay {
                    Capsule()
                        .strokeBorder(isSelected ? Color.clear : Color.primary.opacity(0.08))
                }
        }
        .buttonStyle(.plain)
    }
}

private struct SpotMapPin: View {
    let genre: NearbyGenre
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .fill(.background)
                    .shadow(color: .black.opacity(0.18), radius: 5, y: 3)

                Image(systemName: genre.systemImage)
                    .font(.system(size: isSelected ? 16 : 13, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(
                        width: isSelected ? 38 : 31,
                        height: isSelected ? 38 : 31
                    )
                    .background(genre.tint, in: Circle())
            }
            .frame(width: isSelected ? 42 : 35, height: isSelected ? 42 : 35)
            .scaleEffect(isSelected ? 1.08 : 1)
            .animation(.snappy, value: isSelected)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(genre.label)
    }
}

private struct CurrentLocationMarker: View {
    var body: some View {
        Circle()
            .fill(.blue)
            .frame(width: 16, height: 16)
            .overlay {
                Circle()
                    .stroke(.white, lineWidth: 3)
            }
            .shadow(color: .blue.opacity(0.35), radius: 8)
    }
}

private struct SpotCarousel: View {
    @Bindable var store: MapSearchStore
    let currentLocation: NearbyCoordinate?
    let photoURL: (PlaceResult) -> URL?
    let onOpen: (PlaceResult) -> Void
    let onLike: (PlaceResult) -> Void

    var body: some View {
        ScrollView(.horizontal) {
            LazyHStack(alignment: .center, spacing: 12) {
                ForEach(store.spots) { spot in
                    SpotPreviewCard(
                        spot: spot,
                        displayGenre: NearbyFilter.displayGenre(
                            for: spot,
                            selectedGenre: store.selectedGenre
                        ),
                        isSelected: store.selectedPlaceID == spot.placeID,
                        isLiked: store.isLiked(spot),
                        currentLocation: currentLocation,
                        photoURL: photoURL(spot),
                        onOpen: { onOpen(spot) },
                        onLike: { onLike(spot) }
                    )
                    .id(spot.placeID)
                }
            }
            .padding(.vertical, 8)
            .scrollTargetLayout()
            .padding(.horizontal, WanspotSpacing.md)
        }
        .scrollIndicators(.hidden)
        .scrollTargetBehavior(.viewAligned)
        .scrollPosition(id: $store.selectedPlaceID)
        .frame(height: 210)
    }
}

private struct SpotPreviewCard: View {
    let spot: PlaceResult
    let displayGenre: NearbyGenre
    let isSelected: Bool
    let isLiked: Bool
    let currentLocation: NearbyCoordinate?
    let photoURL: URL?
    let onOpen: () -> Void
    let onLike: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topTrailing) {
                AsyncImage(url: photoURL) { phase in
                    switch phase {
                    case let .success(image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        ZStack {
                            displayGenre.tint.opacity(0.13)
                            Image(systemName: displayGenre.systemImage)
                                .font(.title2)
                                .foregroundStyle(displayGenre.tint)
                        }
                    }
                }
                .frame(width: 300, height: 92)
                .clipped()

                Button(action: onLike) {
                    Image(systemName: isLiked ? "heart.fill" : "heart")
                        .font(.body.weight(.bold))
                        .foregroundStyle(isLiked ? WanspotColors.coral : .primary)
                        .frame(width: 36, height: 36)
                        .background(.ultraThinMaterial, in: Circle())
                }
                .buttonStyle(.plain)
                .padding(8)
                .accessibilityLabel(isLiked ? "お気に入りから削除" : "お気に入りに追加")
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(spot.name)
                        .font(.subheadline.weight(.bold))
                        .lineLimit(1)

                    Spacer(minLength: 0)

                    if let rating = spot.rating {
                        Label(rating.formatted(.number.precision(.fractionLength(1))), systemImage: "star.fill")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.orange)
                    }
                }
                .frame(height: 18)

                HStack(spacing: 8) {
                    Label(
                        displayGenre.label,
                        systemImage: displayGenre.systemImage
                    )

                    if let distance = distanceText {
                        Text(distance)
                    }

                    if let openStatus {
                        Text(openStatus == .open ? "営業中" : "営業時間外")
                            .foregroundStyle(openStatus == .open ? .green : .secondary)
                    }
                }
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .frame(height: 16)

                Group {
                    if let badge = PetPolicy.badge(for: spot) {
                        Label(
                            badge.label,
                            systemImage: badge.tone == .caution
                                ? "exclamationmark.circle"
                                : "pawprint.fill"
                        )
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(badge.tone.foregroundColor)
                        .lineLimit(1)
                    }
                }
                .frame(height: 16, alignment: .leading)
            }
            .padding(12)
            .frame(height: 86, alignment: .top)
        }
        .frame(width: 300, height: 178, alignment: .top)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(
                    isSelected ? WanspotColors.coral : Color.primary.opacity(0.08),
                    lineWidth: 2
                )
        }
        .shadow(color: .black.opacity(0.1), radius: 10, y: 5)
        .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .onTapGesture(perform: onOpen)
        .accessibilityIdentifier("search.spotCard.\(spot.placeID)")
        .accessibilityAddTraits(.isButton)
    }

    private var distanceText: String? {
        guard let currentLocation else { return nil }
        let meters = NearbyGeometry.distanceMeters(
            from: currentLocation,
            to: spot.coordinate
        )
        return NearbyGeometry.distanceLabel(meters)
    }

    private var openStatus: OpenStatus? {
        guard let periods = spot.openingHours?.periods else { return nil }
        let status = BusinessHours.openStateFromPeriods(periods).status
        return status == .unknown ? nil : status
    }
}

private struct MapSearchTutorial: View {
    let onDone: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 6) {
                Text("わんこと行ける場所を探そう")
                    .font(.title2.bold())
                Text("地図とカードは連動しています")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            tutorialRow(
                icon: "mappin.and.ellipse",
                title: "ピンをタップ",
                detail: "スポットのカードへすぐ移動します"
            )
            tutorialRow(
                icon: "line.3.horizontal.decrease.circle",
                title: "条件で絞り込み",
                detail: "店内OK・テラス席・営業中などを選べます"
            )
            tutorialRow(
                icon: "magnifyingglass",
                title: "好きなエリアを検索",
                detail: "現在地が使えないときも地名検索できます"
            )

            Button("はじめる", action: onDone)
                .buttonStyle(WanspotPrimaryButtonStyle())
        }
        .padding(WanspotSpacing.xl)
    }

    private func tutorialRow(icon: String, title: String, detail: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.title3.weight(.semibold))
                .foregroundStyle(WanspotColors.coral)
                .frame(width: 42, height: 42)
                .background(WanspotColors.coral.opacity(0.12), in: Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.bold))
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private extension NearbyCoordinate {
    var clLocationCoordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

private extension NearbyGenre {
    var tint: Color {
        switch self {
        case .cafe: Color(red: 0.72, green: 0.43, blue: 0.25)
        case .restaurant: Color(red: 0.92, green: 0.31, blue: 0.24)
        case .park: Color(red: 0.20, green: 0.62, blue: 0.35)
        case .dogRun: WanspotColors.coral
        case .veterinaryCare: Color(red: 0.13, green: 0.61, blue: 0.68)
        case .petHotel: Color(red: 0.19, green: 0.49, blue: 0.82)
        }
    }
}

private extension PetPolicyBadgeTone {
    var foregroundColor: Color {
        switch self {
        case .ok: .green
        case .terrace: .orange
        case .caution: .orange
        }
    }
}
