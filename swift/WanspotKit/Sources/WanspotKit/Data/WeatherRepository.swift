import Foundation

public enum WeatherRepositoryError: Error, Equatable, LocalizedError, Sendable {
    case invalidURL
    case unavailable

    public var errorDescription: String? {
        "天気情報を取得できませんでした。"
    }
}

public struct WeatherRepository: Sendable {
    private let cache: MemoryCache
    private let transport: any HTTPTransport

    public init(
        cache: MemoryCache = MemoryCache(),
        transport: any HTTPTransport = URLSessionHTTPTransport()
    ) {
        self.cache = cache
        self.transport = transport
    }

    public func currentWeather(
        at coordinate: NearbyCoordinate,
        force: Bool = false
    ) async throws -> CurrentWeather {
        let key =
            "weather:\(geoBucket(latitude: coordinate.latitude, longitude: coordinate.longitude))"
        let result: CacheFetchResult<CurrentWeather> = try await cache.fetch(
            key,
            ttl: CacheTTL.weather,
            force: force
        ) {
            try await fetchCurrentWeather(at: coordinate)
        }
        return result.value
    }

    private func fetchCurrentWeather(
        at coordinate: NearbyCoordinate
    ) async throws -> CurrentWeather {
        var components = URLComponents(
            string: "https://api.open-meteo.com/v1/forecast"
        )
        components?.queryItems = [
            URLQueryItem(
                name: "latitude",
                value: String(coordinate.latitude)
            ),
            URLQueryItem(
                name: "longitude",
                value: String(coordinate.longitude)
            ),
            URLQueryItem(
                name: "current",
                value: "temperature_2m,weather_code"
            ),
        ]
        guard let url = components?.url else {
            throw WeatherRepositoryError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = WanspotAPIClient.defaultTimeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let response = try await transport.send(request)
        guard (200 ..< 300).contains(response.statusCode) else {
            throw WeatherRepositoryError.unavailable
        }
        let wire = try JSONDecoder().decode(
            OpenMeteoResponse.self,
            from: response.data
        )
        guard let current = wire.current else {
            throw WeatherRepositoryError.unavailable
        }
        return CurrentWeather(
            temperatureCelsius: current.temperature.rounded(),
            condition: WeatherJudgment.condition(
                fromWMOCode: current.weatherCode
            )
        )
    }
}

private struct OpenMeteoResponse: Decodable {
    struct Current: Decodable {
        let temperature: Double
        let weatherCode: Int

        private enum CodingKeys: String, CodingKey {
            case temperature = "temperature_2m"
            case weatherCode = "weather_code"
        }
    }

    let current: Current?
}
