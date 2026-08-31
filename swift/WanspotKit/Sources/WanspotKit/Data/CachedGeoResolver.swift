import Foundation

public struct ReverseGeocodeResult: Equatable, Sendable {
    public let region: String?
    public let subregion: String?
    public let city: String?
    public let district: String?

    public init(
        region: String?,
        subregion: String?,
        city: String?,
        district: String?
    ) {
        self.region = region
        self.subregion = subregion
        self.city = city
        self.district = district
    }
}

public struct PrefectureAndMunicipality: Equatable, Sendable {
    public let prefecture: String?
    public let municipality: String?

    public init(prefecture: String?, municipality: String?) {
        self.prefecture = prefecture
        self.municipality = municipality
    }
}

public struct CachedGeoResolver: Sendable {
    public typealias ReverseGeocoder =
        @Sendable (_ latitude: Double, _ longitude: Double) async throws
            -> ReverseGeocodeResult?

    private let cache: MemoryCache
    private let reverseGeocode: ReverseGeocoder

    public init(
        cache: MemoryCache = MemoryCache(),
        reverseGeocode: @escaping ReverseGeocoder
    ) {
        self.cache = cache
        self.reverseGeocode = reverseGeocode
    }

    public func prefecture(
        latitude: Double,
        longitude: Double
    ) async -> String {
        let key =
            "geo:pref:\(geoBucket(latitude: latitude, longitude: longitude))"
        do {
            let result: CacheFetchResult<String> = try await cache.fetch(
                key,
                ttl: CacheTTL.geo
            ) {
                do {
                    let place = try await reverseGeocode(latitude, longitude)
                    return place?.region ?? place?.subregion ?? "東京"
                } catch {
                    return "東京"
                }
            }
            return result.value
        } catch {
            return "東京"
        }
    }

    public func prefectureAndMunicipality(
        latitude: Double,
        longitude: Double
    ) async -> PrefectureAndMunicipality {
        let key =
            "geo:pref-muni:\(geoBucket(latitude: latitude, longitude: longitude))"
        do {
            let result: CacheFetchResult<PrefectureAndMunicipality> =
                try await cache.fetch(key, ttl: CacheTTL.geo) {
                    do {
                        let place = try await reverseGeocode(
                            latitude,
                            longitude
                        )
                        return PrefectureAndMunicipality(
                            prefecture: place?.region ?? place?.subregion,
                            municipality: place?.city
                                ?? place?.district
                                ?? place?.subregion
                        )
                    } catch {
                        return PrefectureAndMunicipality(
                            prefecture: nil,
                            municipality: nil
                        )
                    }
                }
            return result.value
        } catch {
            return PrefectureAndMunicipality(
                prefecture: nil,
                municipality: nil
            )
        }
    }
}

private func geoBucket(latitude: Double, longitude: Double) -> String {
    String(
        format: "%.3f,%.3f",
        locale: Locale(identifier: "en_US_POSIX"),
        latitude,
        longitude
    )
}
