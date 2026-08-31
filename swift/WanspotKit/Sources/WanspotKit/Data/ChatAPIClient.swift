import Foundation

public struct ChatAPIClient: Sendable {
    public typealias AccessTokenProvider = WanspotAPIClient.AccessTokenProvider

    // SSEは応答完了まで長くかかるため、既存の12秒/40秒予算とは別の120秒設定を使う
    public static let streamTimeout: TimeInterval = 120

    private static let streamSession: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = streamTimeout
        return URLSession(configuration: configuration)
    }()

    private let baseURL: URL
    private let session: URLSession
    // SSE は URLSession の bytes(for:) が要るので session をそのまま使うが、
    // 履歴取得は普通の JSON GET なので他クライアントと同じ HTTPTransport を通す
    // （テストの差し替え口を WanspotAPIClient と揃えるため）
    private let transport: any HTTPTransport
    private let accessTokenProvider: AccessTokenProvider

    public init(
        baseURL: URL,
        session: URLSession? = nil,
        transport: any HTTPTransport = URLSessionHTTPTransport(),
        accessTokenProvider: @escaping AccessTokenProvider = { nil }
    ) {
        self.baseURL = baseURL
        self.session = session ?? Self.streamSession
        self.transport = transport
        self.accessTokenProvider = accessTokenProvider
    }

    public init(
        configuration: AppConfiguration,
        session: URLSession? = nil,
        transport: any HTTPTransport = URLSessionHTTPTransport(),
        accessTokenProvider: @escaping AccessTokenProvider = { nil }
    ) {
        self.init(
            baseURL: configuration.wanspotAPIURL,
            session: session,
            transport: transport,
            accessTokenProvider: accessTokenProvider
        )
    }

    // 起動をまたいだ会話の復元（GET /api/chat/history）。
    // サーバは直近セッションが24時間以内のときだけ本文を最大40件・古い順で返し、
    // 会話が無ければ空配列を返す。カードは復元されない（BE契約）。
    //
    // 401 / 429 / 500 も通信断もすべて「復元しない」で握りつぶす契約なので、
    // 失敗は空配列で表す（fetchAISummary / fetchWalkLine と同じ best-effort 方針）。
    // 呼び出し側は空配列を「復元するものが無かった」として扱ってよい
    public func fetchHistory() async -> [ChatHistoryMessage] {
        guard let url = makeURL(path: "/api/chat/history") else { return [] }

        // トークンが無ければ確実に 401 なので、通信する前にやめる
        guard
            let token = try? await accessTokenProvider(),
            !token.isEmpty
        else {
            return []
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "GET"
        // SSE の120秒はストリーム専用。履歴は普通のGETなので既存の12秒予算に乗せる
        urlRequest.timeoutInterval = WanspotAPIClient.defaultTimeout
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        guard
            let response = try? await transport.send(urlRequest),
            (200 ..< 300).contains(response.statusCode),
            let decoded = try? JSONDecoder().decode(
                ChatHistoryWireResponse.self,
                from: response.data
            )
        else {
            return []
        }
        // 未知 role・本文が空の行だけを落とし、残りはサーバが返した順のまま渡す
        return (decoded.messages ?? [])
            .compactMap(ChatHistoryMessage.init(wire:))
    }

    public func streamChat(
        request: ChatRequest
    ) -> AsyncThrowingStream<ChatSSEEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let urlRequest = try await makeStreamRequest(request)
                    let (bytes, response) = try await session.bytes(for: urlRequest)
                    guard let response = response as? HTTPURLResponse else {
                        throw WanspotAPIError.invalidResponse
                    }
                    guard (200 ..< 300).contains(response.statusCode) else {
                        // 上限系は HTTP 200 + SSE limit イベントで届く契約。
                        // ここに来るのは認証切れ等の失敗のみ
                        var errorBody = Data()
                        do {
                            for try await byte in bytes {
                                errorBody.append(byte)
                                if errorBody.count >= 16_384 { break }
                            }
                        } catch {
                            // 本文が読めなくてもステータス別のフォールバック文言で足りる
                        }
                        throw WanspotAPIError.httpStatus(
                            code: response.statusCode,
                            message: Self.serverMessage(from: errorBody)
                        )
                    }
                    for try await line in bytes.lines {
                        try Task.checkCancellation()
                        guard let event = Self.decodeEvent(fromLine: line) else {
                            continue
                        }
                        continuation.yield(event)
                    }
                    continuation.finish()
                } catch is CancellationError {
                    continuation.finish()
                } catch let error as URLError where error.code == .cancelled {
                    continuation.finish()
                } catch {
                    continuation.finish(
                        throwing: Self.normalizedStreamError(error)
                    )
                }
            }
            continuation.onTermination = { _ in
                task.cancel()
            }
        }
    }

    // "data: <json>" 以外の行・壊れたJSON・未知構造はスキップして
    // ストリーム全体を落とさない（未知type読み飛ばし契約のクライアント側実装）
    static func decodeEvent(fromLine line: String) -> ChatSSEEvent? {
        let line = line.trimmingCharacters(in: .whitespaces)
        guard line.hasPrefix("data:") else { return nil }
        let payload = line
            .dropFirst("data:".count)
            .trimmingCharacters(in: .whitespaces)
        guard !payload.isEmpty else { return nil }
        return try? JSONDecoder().decode(
            ChatSSEEvent.self,
            from: Data(payload.utf8)
        )
    }

    private func makeStreamRequest(
        _ request: ChatRequest
    ) async throws -> URLRequest {
        guard let url = makeURL(path: "/api/chat") else {
            throw WanspotAPIError.invalidURL("/api/chat")
        }
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.timeoutInterval = Self.streamTimeout
        urlRequest.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONEncoder().encode(request)

        let token: String?
        do {
            token = try await accessTokenProvider()
        } catch {
            throw Self.normalizedStreamError(error)
        }
        if let token, !token.isEmpty {
            urlRequest.setValue(
                "Bearer \(token)",
                forHTTPHeaderField: "Authorization"
            )
        }
        return urlRequest
    }

    private func makeURL(path: String) -> URL? {
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
        return components.url
    }

    private static func serverMessage(from data: Data) -> String? {
        guard
            !data.isEmpty,
            let response = try? JSONDecoder().decode(
                ServerErrorResponse.self,
                from: data
            )
        else {
            return nil
        }
        return response.error ?? response.message
    }

    private static func normalizedStreamError(_ error: Error) -> WanspotAPIError {
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
