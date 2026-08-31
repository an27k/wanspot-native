import Foundation

public enum SpotDetailResolverError: Error, Equatable, LocalizedError, Sendable {
    case invalidIdentifier
    case notFound
    case unavailable

    public var errorDescription: String? {
        switch self {
        case .invalidIdentifier:
            "無効なスポットです。"
        case .notFound:
            "スポットが見つかりませんでした。"
        case .unavailable:
            "スポット情報を取得できませんでした。通信環境を確認して再試行してください。"
        }
    }
}

public struct SpotDetailResolver: Sendable {
    private let repository: SpotsRepository
    private let navigationState: SpotDetailNavigationState

    public init(
        repository: SpotsRepository,
        navigationState: SpotDetailNavigationState
    ) {
        self.repository = repository
        self.navigationState = navigationState
    }

    public func bootstrap(routeID: String) async -> SpotDetail? {
        let routeID = normalized(routeID)
        guard !routeID.isEmpty else { return nil }

        var place = await navigationState.peekHandoff(routeID: routeID)
        if place == nil {
            place = await navigationState.place(for: routeID)
        }
        if place == nil {
            place = await navigationState.readStash(spotID: routeID)
        }
        guard let place else { return nil }

        let cachedSpotID = await navigationState.spotUUID(for: place.placeID)
        return detail(
            routeID: routeID,
            fallback: place,
            row: nil,
            placeDetail: nil,
            ensuredSpotID: cachedSpotID
        )
    }

    public func resolve(
        routeID: String,
        allowEnsuringSpot: Bool = false
    ) async throws -> SpotDetail {
        let routeID = normalized(routeID)
        guard !routeID.isEmpty else {
            throw SpotDetailResolverError.invalidIdentifier
        }

        let fallback = await bootstrap(routeID: routeID)
        var placeID =
            SpotDetailNavigationState.placeID(from: routeID)
                ?? fallback?.placeID
        var row: PublicSpot?
        var rowFailure: Error?

        if SpotIdentifier.isUUID(routeID) {
            do {
                row = try await repository.fetchSpot(spotID: routeID)
            } catch {
                rowFailure = error
            }
            placeID = nonEmpty(row?.placeID) ?? placeID
        } else {
            placeID = placeID ?? routeID
            if let placeID {
                do {
                    row = try await repository.fetchSpot(placeID: placeID)
                } catch {
                    rowFailure = error
                }
            }
        }

        guard let placeID = nonEmpty(placeID) else {
            throw rowFailure.map { _ in SpotDetailResolverError.unavailable }
                ?? SpotDetailResolverError.notFound
        }

        var remoteDetail: SpotPlaceDetail?
        var detailFailure: Error?
        do {
            remoteDetail = try await repository.fetchPlaceDetail(placeID: placeID)
        } catch {
            detailFailure = error
        }

        let cachedSpotID = await navigationState.spotUUID(for: placeID)
        var ensuredSpotID =
            validSpotID(row?.id)
                ?? validSpotID(fallback?.spotID)
                ?? validSpotID(cachedSpotID)
        if ensuredSpotID == nil, allowEnsuringSpot {
            if let value = try? await repository.ensureSpotID(placeID: placeID) {
                ensuredSpotID = value
                await navigationState.setSpotUUID(value, for: placeID)
                if row == nil {
                    row = try? await repository.fetchSpot(spotID: value)
                }
            }
        }

        guard row != nil || remoteDetail != nil || fallback != nil else {
            if rowFailure != nil || detailFailure != nil {
                throw SpotDetailResolverError.unavailable
            }
            throw SpotDetailResolverError.notFound
        }

        let resolved = detail(
            routeID: routeID,
            fallback: fallback,
            row: row,
            placeDetail: remoteDetail,
            placeID: placeID,
            ensuredSpotID: ensuredSpotID
        )
        await remember(resolved)
        return resolved
    }

    private func remember(_ detail: SpotDetail) async {
        guard
            let coordinate = detail.coordinate,
            !detail.placeID.isEmpty
        else {
            if let spotID = detail.spotID {
                await navigationState.setSpotUUID(spotID, for: detail.placeID)
            }
            return
        }

        let place = PlaceResult(
            placeID: detail.placeID,
            name: detail.name,
            category: detail.category,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            address: detail.address ?? "",
            photoReference: detail.photoReferences.first,
            rating: detail.rating,
            userRatingsTotal: detail.userRatingsTotal,
            priceLevel: detail.priceLevel,
            priceLabel: detail.priceLabel,
            petIndoorAllowed: detail.petIndoorAllowed,
            petPolicyEvidence: detail.petPolicyEvidence,
            openingHours: PlaceOpeningHours(
                periods: detail.openingHours?.periods
            ),
            petTerraceOnly: detail.petTerraceOnly,
            petFriendlyStatus: detail.petFriendlyStatus,
            petFriendlyVerified: detail.petFriendlyVerified,
            dogInteraction: detail.dogInteraction,
            petSizeLimit: detail.petSizeLimit,
            petReservationRequired: detail.petReservationRequired,
            spotID: detail.spotID
        )
        await navigationState.setPlace(routeID: detail.routeID, place: place)
        if let spotID = detail.spotID {
            await navigationState.setSpotUUID(spotID, for: detail.placeID)
        }
    }

    private func detail(
        routeID: String,
        fallback place: PlaceResult,
        row: PublicSpot?,
        placeDetail: SpotPlaceDetail?,
        ensuredSpotID: String?
    ) -> SpotDetail {
        detail(
            routeID: routeID,
            fallback: SpotDetail(
                routeID: routeID,
                spotID:
                    validSpotID(place.spotID)
                        ?? validSpotID(routeID),
                placeID: place.placeID,
                name: place.name,
                category: place.category,
                address: nonEmpty(place.address),
                latitude: place.latitude,
                longitude: place.longitude,
                photoReferences: [place.photoReference].compactMap(\.self),
                rating: place.rating,
                userRatingsTotal: place.userRatingsTotal,
                priceLevel: place.priceLevel,
                priceLabel: place.priceLabel,
                openingHours: place.openingHours.map {
                    SpotDetailOpeningHours(periods: $0.periods ?? [])
                },
                petIndoorAllowed: place.petIndoorAllowed,
                petTerraceOnly: place.petTerraceOnly,
                petFriendlyStatus: place.petFriendlyStatus,
                petFriendlyVerified: place.petFriendlyVerified,
                petPolicyEvidence: place.petPolicyEvidence,
                petSizeLimit: place.petSizeLimit,
                petReservationRequired: place.petReservationRequired,
                dogInteraction: place.dogInteraction
            ),
            row: row,
            placeDetail: placeDetail,
            placeID: place.placeID,
            ensuredSpotID: ensuredSpotID
        )
    }

    private func detail(
        routeID: String,
        fallback: SpotDetail?,
        row: PublicSpot?,
        placeDetail: SpotPlaceDetail?,
        placeID: String,
        ensuredSpotID: String?
    ) -> SpotDetail {
        let rowPeriods = row?.openingHours?.periods ?? []
        let remoteHours = placeDetail?.openingHours
        let mergedHours: SpotDetailOpeningHours? = {
            let weekdayText = remoteHours?.weekdayText ?? []
            let periods = remoteHours?.periods.isEmpty == false
                ? remoteHours?.periods ?? []
                : rowPeriods
            let openNow = remoteHours?.openNow
            guard !weekdayText.isEmpty || !periods.isEmpty || openNow != nil else {
                return fallback?.openingHours
            }
            return SpotDetailOpeningHours(
                weekdayText: weekdayText,
                openNow: openNow,
                periods: periods
            )
        }()
        let photos = SpotPhotoReferences.merge(
            primary: row?.photoReference ?? fallback?.photoReferences.first,
            additional:
                row?.photoReferences ?? [],
                placeDetail?.photoReferences ?? [],
                fallback?.photoReferences ?? []
        )

        return SpotDetail(
            routeID: routeID,
            spotID:
                validSpotID(ensuredSpotID)
                    ?? validSpotID(row?.id)
                    ?? validSpotID(fallback?.spotID)
                    ?? validSpotID(routeID),
            placeID: nonEmpty(row?.placeID) ?? placeID,
            name:
                nonEmpty(row?.name)
                    ?? nonEmpty(placeDetail?.name)
                    ?? nonEmpty(fallback?.name)
                    ?? "スポット",
            category:
                nonEmpty(row?.category)
                    ?? nonEmpty(fallback?.category)
                    ?? categoryLabel(for: placeDetail?.types ?? []),
            address:
                nonEmpty(placeDetail?.formattedAddress)
                    ?? nonEmpty(row?.bestAddress)
                    ?? nonEmpty(fallback?.address)
                    ?? nonEmpty(placeDetail?.vicinity),
            latitude:
                row?.latitude
                    ?? fallback?.latitude
                    ?? placeDetail?.latitude,
            longitude:
                row?.longitude
                    ?? fallback?.longitude
                    ?? placeDetail?.longitude,
            photoReferences: photos,
            rating:
                placeDetail?.rating
                    ?? row?.rating
                    ?? fallback?.rating,
            userRatingsTotal:
                placeDetail?.userRatingsTotal
                    ?? row?.userRatingsTotal
                    ?? fallback?.userRatingsTotal,
            priceLevel:
                placeDetail?.priceLevel
                    ?? row?.priceLevel
                    ?? fallback?.priceLevel,
            priceLabel:
                nonEmpty(placeDetail?.priceLabel)
                    ?? nonEmpty(row?.priceLabel)
                    ?? nonEmpty(fallback?.priceLabel),
            openingHours: mergedHours,
            reviews: Array((placeDetail?.reviews ?? []).prefix(5)),
            formattedPhoneNumber: placeDetail?.formattedPhoneNumber,
            websiteURL: placeDetail?.websiteURL,
            googleMapsURL: placeDetail?.googleMapsURL,
            instagramID: nonEmpty(row?.instagramID),
            dogFactHighlights: row?.dogFactHighlights ?? fallback?.dogFactHighlights ?? [],
            petIndoorAllowed: row?.petIndoorAllowed ?? fallback?.petIndoorAllowed,
            petTerraceOnly: row?.petTerraceOnly ?? fallback?.petTerraceOnly,
            petFriendlyStatus:
                nonEmpty(row?.petFriendlyStatus)
                    ?? nonEmpty(fallback?.petFriendlyStatus),
            petFriendlyVerified: row?.petFriendlyVerified ?? fallback?.petFriendlyVerified,
            petPolicyEvidence:
                nonEmpty(row?.petPolicyEvidence)
                    ?? nonEmpty(fallback?.petPolicyEvidence),
            petSizeLimit:
                nonEmpty(row?.petSizeLimit)
                    ?? nonEmpty(fallback?.petSizeLimit),
            petReservationRequired:
                row?.petReservationRequired
                    ?? fallback?.petReservationRequired,
            dogInteraction:
                nonEmpty(row?.dogInteraction)
                    ?? nonEmpty(fallback?.dogInteraction)
        )
    }

    private func categoryLabel(for types: [String]) -> String {
        let labels = [
            "dog_park": "ドッグラン",
            "park": "公園",
            "cafe": "カフェ",
            "bakery": "カフェ",
            "restaurant": "レストラン",
            "bar": "レストラン",
            "lodging": "宿泊",
            "campground": "キャンプ場",
            "pet_store": "ペットショップ",
            "veterinary_care": "動物病院",
            "shopping_mall": "ショッピング",
            "tourist_attraction": "観光スポット",
        ]
        for type in types {
            if let label = labels[type] {
                return label
            }
        }
        return "スポット"
    }

    private func validSpotID(_ value: String?) -> String? {
        guard let value = nonEmpty(value), SpotIdentifier.isUUID(value) else {
            return nil
        }
        return value.lowercased()
    }

    private func nonEmpty(_ value: String?) -> String? {
        let value = value?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return value.isEmpty ? nil : value
    }

    private func normalized(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
