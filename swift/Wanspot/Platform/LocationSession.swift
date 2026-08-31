import CoreLocation
import Foundation
import Observation

enum LocationSessionError: LocalizedError {
    case disabled
    case denied
    case unavailable

    var errorDescription: String? {
        switch self {
        case .disabled:
            "位置情報サービスがオフになっています。"
        case .denied:
            "位置情報の利用が許可されていません。設定アプリから許可してください。"
        case .unavailable:
            "現在地を取得できませんでした。"
        }
    }
}

enum LocationSessionSimulation: Sendable {
    case denied
    case unavailable
    case fixed(latitude: Double, longitude: Double)
}

@MainActor
@Observable
final class LocationSession:
    NSObject,
    @preconcurrency CLLocationManagerDelegate
{
    private(set) var authorizationStatus: CLAuthorizationStatus
    private(set) var location: CLLocation?
    private(set) var errorMessage: String?
    private(set) var isLocating = false

    private let manager: CLLocationManager
    private let simulation: LocationSessionSimulation?

    override init() {
        let manager = CLLocationManager()
        self.manager = manager
        simulation = nil
        authorizationStatus = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    init(simulation: LocationSessionSimulation) {
        let manager = CLLocationManager()
        self.manager = manager
        self.simulation = simulation
        switch simulation {
        case .denied:
            authorizationStatus = .denied
            errorMessage = LocationSessionError.denied.localizedDescription
        case .unavailable:
            authorizationStatus = .authorizedWhenInUse
            errorMessage = LocationSessionError.unavailable.localizedDescription
        case let .fixed(latitude, longitude):
            authorizationStatus = .authorizedWhenInUse
            location = CLLocation(
                latitude: latitude,
                longitude: longitude
            )
        }
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    var canRequestLocation: Bool {
        switch authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse, .notDetermined:
            true
        case .denied, .restricted:
            false
        @unknown default:
            false
        }
    }

    func requestCurrentLocation() {
        if let simulation {
            isLocating = false
            switch simulation {
            case .denied:
                location = nil
                authorizationStatus = .denied
                errorMessage = LocationSessionError.denied.localizedDescription
            case .unavailable:
                location = nil
                authorizationStatus = .authorizedWhenInUse
                errorMessage = LocationSessionError.unavailable.localizedDescription
            case let .fixed(latitude, longitude):
                location = CLLocation(
                    latitude: latitude,
                    longitude: longitude
                )
                authorizationStatus = .authorizedWhenInUse
                errorMessage = nil
            }
            return
        }
        errorMessage = nil
        guard CLLocationManager.locationServicesEnabled() else {
            isLocating = false
            errorMessage = LocationSessionError.disabled.localizedDescription
            return
        }

        switch authorizationStatus {
        case .notDetermined:
            isLocating = true
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            isLocating = true
            manager.requestLocation()
        case .denied, .restricted:
            isLocating = false
            errorMessage = LocationSessionError.denied.localizedDescription
        @unknown default:
            isLocating = false
            errorMessage = LocationSessionError.unavailable.localizedDescription
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if simulation != nil {
            applySimulation()
            return
        }
        authorizationStatus = manager.authorizationStatus
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            if isLocating {
                manager.requestLocation()
            }
        case .denied, .restricted:
            isLocating = false
            errorMessage = LocationSessionError.denied.localizedDescription
        case .notDetermined:
            break
        @unknown default:
            isLocating = false
            errorMessage = LocationSessionError.unavailable.localizedDescription
        }
    }

    func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard simulation == nil else {
            applySimulation()
            return
        }
        location = locations.last
        isLocating = false
        errorMessage = nil
    }

    func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {
        guard simulation == nil else {
            applySimulation()
            return
        }
        isLocating = false
        errorMessage = error.localizedDescription.isEmpty
            ? LocationSessionError.unavailable.localizedDescription
            : error.localizedDescription
    }

    private func applySimulation() {
        guard let simulation else { return }
        isLocating = false
        switch simulation {
        case .denied:
            location = nil
            authorizationStatus = .denied
            errorMessage = LocationSessionError.denied.localizedDescription
        case .unavailable:
            location = nil
            authorizationStatus = .authorizedWhenInUse
            errorMessage = LocationSessionError.unavailable.localizedDescription
        case let .fixed(latitude, longitude):
            location = CLLocation(
                latitude: latitude,
                longitude: longitude
            )
            authorizationStatus = .authorizedWhenInUse
            errorMessage = nil
        }
    }
}
