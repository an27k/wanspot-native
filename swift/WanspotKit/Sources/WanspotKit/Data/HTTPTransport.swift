import Foundation

public struct HTTPTransportResponse: Sendable {
    public let data: Data
    public let statusCode: Int
    public let headers: [String: String]

    public init(
        data: Data,
        statusCode: Int,
        headers: [String: String] = [:]
    ) {
        self.data = data
        self.statusCode = statusCode
        self.headers = headers
    }
}

public protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> HTTPTransportResponse
}

public struct URLSessionHTTPTransport: HTTPTransport {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func send(_ request: URLRequest) async throws -> HTTPTransportResponse {
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else {
            throw HTTPTransportError.nonHTTPResponse
        }

        let headers = response.allHeaderFields.reduce(into: [String: String]()) {
            result,
            element in
            guard
                let key = element.key as? String,
                let value = element.value as? String
            else {
                return
            }
            result[key] = value
        }
        return HTTPTransportResponse(
            data: data,
            statusCode: response.statusCode,
            headers: headers
        )
    }
}

public enum HTTPTransportError: Error, Equatable, Sendable {
    case nonHTTPResponse
}
