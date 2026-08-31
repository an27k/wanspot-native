import Foundation

public enum WanspotAPIError: Error, Equatable, LocalizedError, Sendable {
    case invalidURL(String)
    case invalidRequest(String)
    case httpStatus(code: Int, message: String?)
    case emptyResponse
    case offline
    case timedOut
    case transportUnavailable
    case invalidResponse

    public var errorDescription: String? {
        switch self {
        case let .invalidURL(path):
            "API URLを組み立てられませんでした: \(path)"
        case let .invalidRequest(message):
            message
        case let .httpStatus(code, message):
            message ?? Self.fallbackMessage(statusCode: code)
        case .emptyResponse:
            "APIの応答が空です。"
        case .offline:
            "インターネット接続がありません。接続を確認して、もう一度お試しください。"
        case .timedOut:
            "通信がタイムアウトしました。しばらく待ってから、もう一度お試しください。"
        case .transportUnavailable:
            "サーバーに接続できませんでした。通信環境を確認して、もう一度お試しください。"
        case .invalidResponse:
            "サーバーから受け取ったデータを読み込めませんでした。"
        }
    }

    private static func fallbackMessage(statusCode: Int) -> String {
        switch statusCode {
        case 401:
            "ログインが必要です。"
        case 403:
            "この操作を実行する権限がありません。"
        case 408:
            "通信がタイムアウトしました。もう一度お試しください。"
        case 429:
            "アクセスが集中しています。しばらく待ってから、もう一度お試しください。"
        case 500 ... 599:
            "サーバーで問題が発生しました。しばらく待ってから、もう一度お試しください。"
        default:
            "通信エラーが発生しました（HTTP \(statusCode)）。"
        }
    }
}

public struct WanspotAPIClient: Sendable {
    public typealias AccessTokenProvider = @Sendable () async throws -> String?

    public static let defaultTimeout: TimeInterval = 12
    public static let slowPathTimeout: TimeInterval = 40

    private let baseURL: URL
    private let transport: any HTTPTransport
    private let accessTokenProvider: AccessTokenProvider

    public init(
        baseURL: URL,
        transport: any HTTPTransport = URLSessionHTTPTransport(),
        accessTokenProvider: @escaping AccessTokenProvider = { nil }
    ) {
        self.baseURL = baseURL
        self.transport = transport
        self.accessTokenProvider = accessTokenProvider
    }

    public init(
        configuration: AppConfiguration,
        transport: any HTTPTransport = URLSessionHTTPTransport(),
        accessTokenProvider: @escaping AccessTokenProvider = { nil }
    ) {
        self.init(
            baseURL: configuration.wanspotAPIURL,
            transport: transport,
            accessTokenProvider: accessTokenProvider
        )
    }

    public func get<Response: Decodable & Sendable>(
        _ path: String,
        queryItems: [URLQueryItem] = [],
        authenticated: Bool = true,
        timeout: TimeInterval? = nil,
        as responseType: Response.Type = Response.self
    ) async throws -> Response {
        try await send(
            path: path,
            queryItems: queryItems,
            method: "GET",
            body: nil,
            authenticated: authenticated,
            timeout: timeout,
            as: responseType
        )
    }

    public func post<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        _ path: String,
        body: Body,
        authenticated: Bool = true,
        timeout: TimeInterval? = nil,
        as responseType: Response.Type = Response.self
    ) async throws -> Response {
        let body = try JSONEncoder().encode(body)
        return try await send(
            path: path,
            queryItems: [],
            method: "POST",
            body: body,
            authenticated: authenticated,
            timeout: timeout,
            as: responseType
        )
    }

    public func post<Response: Decodable & Sendable>(
        _ path: String,
        authenticated: Bool = true,
        timeout: TimeInterval? = nil,
        as responseType: Response.Type = Response.self
    ) async throws -> Response {
        try await send(
            path: path,
            queryItems: [],
            method: "POST",
            body: nil,
            authenticated: authenticated,
            timeout: timeout,
            as: responseType
        )
    }

    public func fetchAISummary(_ request: AISummaryRequest) async -> AISummaryOutcome? {
        do {
            let response: AISummaryWireResponse = try await post(
                "/api/ai-summary",
                body: request
            )
            guard let keywords = response.keywords, let summary = response.summary else {
                return .empty(AISummaryEmptyReason(serverValue: response.emptyReason))
            }
            return .summary(
                AISummary(
                    keywords: keywords,
                    summary: summary,
                    personalNote: response.personalNote,
                    wanspotRating: response.wanspotRating,
                    searchState: response.searchState
                )
            )
        } catch {
            return nil
        }
    }

    public func fetchCloudQualityScores(
        _ items: [CloudQualityItem]
    ) async -> [String: CloudQualityResult] {
        guard !items.isEmpty else { return [:] }

        struct Request: Encodable, Sendable {
            let items: [CloudQualityItem]
        }

        do {
            let response: CloudQualityWireResponse = try await post(
                "/api/vlog/quality",
                body: Request(items: items)
            )
            return response.results.reduce(into: [:]) { result, row in
                if row.source != .rejected {
                    result[row.mediaID] = row
                }
            }
        } catch {
            return [:]
        }
    }

    public func fetchWalkLine(
        latitude: Double,
        longitude: Double
    ) async -> WalkLine? {
        do {
            let response: WalkLineWireResponse = try await get(
                "/api/walk-line",
                queryItems: [
                    URLQueryItem(name: "lat", value: String(latitude)),
                    URLQueryItem(name: "lng", value: String(longitude)),
                ]
            )
            let text = response.line?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !text.isEmpty else { return nil }
            return WalkLine(
                text: text,
                conditionID: response.conditionID ?? "",
                hideWhenLevelAtOrAbove: response.hideWhenLevelAtOrAbove
                    .flatMap(WalkAlertLevel.init(rawValue:))
            )
        } catch {
            return nil
        }
    }

    public func requestVlogRender<Payload: Encodable & Sendable>(
        _ payload: Payload
    ) async -> VlogRenderOutcome {
        do {
            let result: VlogRenderResult = try await post(
                "/api/vlog/render",
                body: payload
            )
            return .success(result)
        } catch let WanspotAPIError.httpStatus(code, _) where code == 404 {
            return .failure(
                VlogRenderFailure(
                    code: .notReady,
                    message: "VLOG生成は準備中です"
                )
            )
        } catch let WanspotAPIError.httpStatus(_, message) {
            return .failure(
                VlogRenderFailure(
                    code: .server,
                    message: message ?? "動画URLの取得に失敗しました"
                )
            )
        } catch WanspotAPIError.emptyResponse {
            return .failure(
                VlogRenderFailure(
                    code: .server,
                    message: "動画URLの取得に失敗しました"
                )
            )
        } catch WanspotAPIError.invalidResponse {
            return .failure(
                VlogRenderFailure(
                    code: .server,
                    message: "動画URLの取得に失敗しました"
                )
            )
        } catch {
            return .failure(
                VlogRenderFailure(
                    code: .network,
                    message: error.localizedDescription.isEmpty
                        ? "通信に失敗しました"
                        : error.localizedDescription
                )
            )
        }
    }

    private func send<Response: Decodable & Sendable>(
        path: String,
        queryItems: [URLQueryItem],
        method: String,
        body: Data?,
        authenticated: Bool,
        timeout: TimeInterval?,
        as responseType: Response.Type
    ) async throws -> Response {
        guard let url = makeURL(path: path, queryItems: queryItems) else {
            throw WanspotAPIError.invalidURL(path)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = timeout ?? timeoutForPath(path)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if authenticated {
            let token: String?
            do {
                token = try await accessTokenProvider()
            } catch {
                throw normalizedTransportError(error)
            }
            if let token, !token.isEmpty {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
        }

        let response: HTTPTransportResponse
        do {
            response = try await transport.send(request)
        } catch {
            throw normalizedTransportError(error)
        }
        guard (200 ..< 300).contains(response.statusCode) else {
            throw WanspotAPIError.httpStatus(
                code: response.statusCode,
                message: serverMessage(from: response.data)
            )
        }
        guard !response.data.isEmpty else {
            throw WanspotAPIError.emptyResponse
        }
        do {
            return try JSONDecoder().decode(responseType, from: response.data)
        } catch {
            throw WanspotAPIError.invalidResponse
        }
    }

    private func makeURL(path: String, queryItems: [URLQueryItem]) -> URL? {
        guard var components = URLComponents(
            url: baseURL,
            resolvingAgainstBaseURL: false
        ) else {
            return nil
        }
        let basePath = components.path.hasSuffix("/")
            ? String(components.path.dropLast())
            : components.path
        let requestPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        components.path = "\(basePath)/\(requestPath)"
        components.queryItems = queryItems.isEmpty ? nil : queryItems
        return components.url
    }

    private func timeoutForPath(_ path: String) -> TimeInterval {
        let slowPaths = [
            "/api/ai-summary",
            "/api/vlog/render",
            "/api/vlog/quality",
            "/api/walk-line",
        ]
        return slowPaths.contains(where: path.hasPrefix)
            ? Self.slowPathTimeout
            : Self.defaultTimeout
    }

    private func serverMessage(from data: Data) -> String? {
        guard
            let response = try? JSONDecoder().decode(
                ServerErrorResponse.self,
                from: data
            )
        else {
            return nil
        }
        return response.error ?? response.message
    }

    private func normalizedTransportError(_ error: Error) -> WanspotAPIError {
        if let error = error as? WanspotAPIError {
            return error
        }
        let nsError = error as NSError
        guard nsError.domain == NSURLErrorDomain else {
            return .transportUnavailable
        }
        switch URLError.Code(rawValue: nsError.code) {
        case .notConnectedToInternet, .networkConnectionLost,
             .dataNotAllowed, .internationalRoamingOff:
            return .offline
        case .timedOut:
            return .timedOut
        default:
            return .transportUnavailable
        }
    }
}

public extension WanspotAPIClient {
    func deleteAccount() async throws -> AccountDeleteResponse {
        let response: AccountDeleteResponse = try await post(
            "/api/account/delete"
        )
        guard response.success else {
            throw WanspotAPIError.invalidRequest(
                "アカウント削除APIが失敗を返しました。"
            )
        }
        return response
    }

    func fetchNearbySpots(
        latitude: Double,
        longitude: Double,
        radiusMeters: Int,
        type: NearbyGenre
    ) async throws -> NearbySpotsResponse {
        try await get(
            "/api/spots/nearby",
            queryItems: [
                URLQueryItem(name: "lat", value: String(latitude)),
                URLQueryItem(name: "lng", value: String(longitude)),
                URLQueryItem(name: "radius", value: String(radiusMeters)),
                URLQueryItem(name: "type", value: type.rawValue),
            ]
        )
    }

    func searchSpots(
        query: String,
        latitude: Double? = nil,
        longitude: Double? = nil
    ) async throws -> SpotSearchResponse {
        var queryItems = [
            URLQueryItem(name: "q", value: query),
        ]
        if let latitude, let longitude {
            queryItems.append(
                contentsOf: [
                    URLQueryItem(name: "lat", value: String(latitude)),
                    URLQueryItem(name: "lng", value: String(longitude)),
                ]
            )
        }
        return try await get(
            "/api/spots/search",
            queryItems: queryItems
        )
    }

    func autocompletePlaces(
        query: String,
        latitude: Double? = nil,
        longitude: Double? = nil
    ) async throws -> [PlacePrediction] {
        var queryItems = [
            URLQueryItem(name: "q", value: query),
        ]
        if let latitude, let longitude {
            queryItems.append(
                contentsOf: [
                    URLQueryItem(name: "lat", value: String(latitude)),
                    URLQueryItem(name: "lng", value: String(longitude)),
                ]
            )
        }
        let response: PlaceAutocompleteResponse = try await get(
            "/api/places/autocomplete",
            queryItems: queryItems,
            authenticated: false
        )
        return response.predictions
    }

    func resolvePlace(placeID: String) async throws -> ResolvedPlace {
        try await get(
            "/api/places/resolve",
            queryItems: [
                URLQueryItem(name: "place_id", value: placeID),
            ],
            authenticated: false
        )
    }

    func ensureSpot(placeID: String) async throws -> EnsureSpotResponse {
        try await post(
            "/api/spots/ensure",
            body: EnsureSpotRequest(placeID: placeID)
        )
    }

    func fetchSpotsByIDs(
        ids: [String] = [],
        placeIDs: [String] = [],
        columns: SpotColumnSet
    ) async throws -> [PublicSpot] {
        let ids = uniqueNonEmpty(ids)
        let placeIDs = uniqueNonEmpty(placeIDs)
        var requests: [SpotsByIDsRequest] = []

        for chunk in ids.chunked(maxCount: 200) {
            requests.append(
                SpotsByIDsRequest(
                    ids: chunk,
                    placeIDs: [],
                    columns: columns
                )
            )
        }
        for chunk in placeIDs.chunked(maxCount: 200) {
            requests.append(
                SpotsByIDsRequest(
                    ids: [],
                    placeIDs: chunk,
                    columns: columns
                )
            )
        }
        guard !requests.isEmpty else { return [] }

        var rows: [PublicSpot] = []
        for request in requests {
            let response: SpotsByIDsResponse = try await post(
                "/api/spots/by-ids",
                body: request
            )
            rows.append(contentsOf: response.spots)
        }

        var seen = Set<String>()
        return rows.filter { row in
            guard let key = row.id ?? row.placeID, !key.isEmpty else {
                return false
            }
            return seen.insert(key).inserted
        }
    }

    func fetchBatchDetails(
        placeIDs: [String]
    ) async throws -> [String: BatchPlaceDetail] {
        let placeIDs = uniqueNonEmpty(placeIDs)
        guard !placeIDs.isEmpty else { return [:] }

        var details: [String: BatchPlaceDetail] = [:]
        for chunk in placeIDs.chunked(maxCount: 40) {
            let response: BatchDetailsResponse = try await post(
                "/api/spots/batch-details",
                body: BatchDetailsRequest(placeIDs: chunk)
            )
            details.merge(response.details) { _, newest in newest }
        }
        return details
    }

    func spotPhotoURL(
        reference: String? = nil,
        placeID: String? = nil,
        width: SpotPhotoWidth = .card
    ) throws -> URL {
        var queryItems: [URLQueryItem] = []
        if let reference = nonEmpty(reference) {
            queryItems.append(URLQueryItem(name: "ref", value: reference))
        }
        if let placeID = nonEmpty(placeID) {
            queryItems.append(
                URLQueryItem(name: "place_id", value: placeID)
            )
        }
        guard !queryItems.isEmpty else {
            throw WanspotAPIError.invalidRequest(
                "写真参照またはplace_idが必要です。"
            )
        }
        queryItems.append(
            URLQueryItem(name: "w", value: String(width.rawValue))
        )
        guard
            let url = makeURL(
                path: "/api/spots/photo",
                queryItems: queryItems
            )
        else {
            throw WanspotAPIError.invalidURL("/api/spots/photo")
        }
        return url
    }

    func fetchSpotPhoto(
        reference: String? = nil,
        placeID: String? = nil,
        width: SpotPhotoWidth = .card
    ) async throws -> SpotPhoto {
        let url = try spotPhotoURL(
            reference: reference,
            placeID: placeID,
            width: width
        )
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = Self.defaultTimeout
        request.setValue("image/*", forHTTPHeaderField: "Accept")

        let response: HTTPTransportResponse
        do {
            response = try await transport.send(request)
        } catch {
            throw normalizedTransportError(error)
        }
        guard (200 ..< 300).contains(response.statusCode) else {
            throw WanspotAPIError.httpStatus(
                code: response.statusCode,
                message: serverMessage(from: response.data)
            )
        }
        guard !response.data.isEmpty else {
            throw WanspotAPIError.emptyResponse
        }
        let contentType = response.headers.first {
            $0.key.caseInsensitiveCompare("Content-Type") == .orderedSame
        }?.value ?? "image/jpeg"
        return SpotPhoto(data: response.data, contentType: contentType)
    }

    private func uniqueNonEmpty(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.compactMap { value in
            let value = value.trimmingCharacters(
                in: .whitespacesAndNewlines
            )
            guard !value.isEmpty, seen.insert(value).inserted else {
                return nil
            }
            return value
        }
    }

    private func nonEmpty(_ value: String?) -> String? {
        let value = value?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return value.isEmpty ? nil : value
    }
}

private struct EnsureSpotRequest: Encodable, Sendable {
    let placeID: String

    private enum CodingKeys: String, CodingKey {
        case placeID = "place_id"
    }
}

private struct SpotsByIDsRequest: Encodable, Sendable {
    let ids: [String]
    let placeIDs: [String]
    let columns: SpotColumnSet

    private enum CodingKeys: String, CodingKey {
        case ids
        case placeIDs = "placeIds"
        case columns
    }
}

private struct BatchDetailsRequest: Encodable, Sendable {
    let placeIDs: [String]

    private enum CodingKeys: String, CodingKey {
        case placeIDs = "place_ids"
    }
}

private extension Array {
    func chunked(maxCount: Int) -> [[Element]] {
        guard maxCount > 0 else { return [] }
        return stride(from: 0, to: count, by: maxCount).map {
            Array(self[$0 ..< Swift.min($0 + maxCount, count)])
        }
    }
}
