import CoreLocation
import Foundation

enum OnboardingLocationError: LocalizedError {
    case denied
    case unavailable
    case requestInProgress

    var errorDescription: String? {
        switch self {
        case .denied:
            "位置情報の利用が許可されていません。"
        case .unavailable:
            "位置情報を取得できませんでした。"
        case .requestInProgress:
            "位置情報を取得しています。"
        }
    }
}

@MainActor
final class OnboardingLocationProvider:
    NSObject,
    @preconcurrency CLLocationManagerDelegate
{
    private let manager = CLLocationManager()
    private var continuation:
        CheckedContinuation<CLLocationCoordinate2D, Error>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func requestCoordinate() async throws -> CLLocationCoordinate2D {
        guard continuation == nil else {
            throw OnboardingLocationError.requestInProgress
        }
        guard CLLocationManager.locationServicesEnabled() else {
            throw OnboardingLocationError.unavailable
        }

        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            continueForAuthorization(manager.authorizationStatus)
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard continuation != nil else { return }
        continueForAuthorization(manager.authorizationStatus)
    }

    func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let location = locations.last else { return }
        finish(.success(location.coordinate))
    }

    func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {
        finish(.failure(error))
    }

    private func continueForAuthorization(
        _ status: CLAuthorizationStatus
    ) {
        switch status {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            manager.requestLocation()
        case .denied, .restricted:
            finish(.failure(OnboardingLocationError.denied))
        @unknown default:
            finish(.failure(OnboardingLocationError.unavailable))
        }
    }

    private func finish(
        _ result: Result<CLLocationCoordinate2D, Error>
    ) {
        let continuation = continuation
        self.continuation = nil
        continuation?.resume(with: result)
    }
}
