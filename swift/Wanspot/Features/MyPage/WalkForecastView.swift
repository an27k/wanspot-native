import CoreLocation
import SwiftUI
import UIKit
import WanspotKit

struct WalkForecastView: View {
    @Environment(AppModel.self) private var model
    @Environment(AppRouter.self) private var router
    @Environment(LocationSession.self) private var locationSession
    @State private var weather: CurrentWeather?
    @State private var updatedAt: Date?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            forecastSection

            if let locationMessage {
                Section("位置情報") {
                    Label(
                        locationMessage,
                        systemImage: "location.slash"
                    )
                    .foregroundStyle(WanspotColors.textSecondary)

                    if locationSession.canRequestLocation {
                        Button("現在地を取得") {
                            locationSession.requestCurrentLocation()
                        }
                    } else {
                        Button("設定アプリを開く", action: openSystemSettings)
                    }
                }
            }

            Section("お散歩設定") {
                Button {
                    router.navigate(to: .editDog(.walkAreas))
                } label: {
                    SettingsNavigationLabel(
                        title: "散歩エリア",
                        subtitle: "よく散歩する場所を最大8件",
                        systemImage: "mappin.and.ellipse"
                    )
                }
                .buttonStyle(.plain)
            }

            Section {
                Button {
                    refresh()
                } label: {
                    Label("最新の予報に更新", systemImage: "arrow.clockwise")
                }
                .disabled(isLoading)
            }
        }
        .scrollContentBackground(.hidden)
        .background(WanspotColors.paper)
        .navigationTitle("お散歩予報")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable {
            await loadWeather(force: true)
        }
        .task {
            model.track(AppAnalyticsEvent(.walkForecastViewed))
            if model.isAuthenticated, model.primaryDog == nil {
                _ = try? await model.refreshPrimaryDog()
            }
            if locationSession.location == nil {
                locationSession.requestCurrentLocation()
            }
        }
        .task(id: locationSession.location?.timestamp) {
            guard locationSession.location != nil else { return }
            await loadWeather()
        }
    }

    private var forecastSection: some View {
        Section {
            if isLoading, weather == nil {
                HStack {
                    Spacer()
                    ProgressView("予報を確認中…")
                    Spacer()
                }
                .padding(.vertical, 28)
            } else if let weather, let alert {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 14) {
                        Image(systemName: weather.condition.systemImage)
                            .font(.system(size: 34, weight: .semibold))
                            .foregroundStyle(alert.tint)
                            .frame(width: 48, height: 48)
                            .background(alert.tint.opacity(0.12), in: .circle)

                        VStack(alignment: .leading, spacing: 3) {
                            Text(weather.condition.displayName)
                                .font(.subheadline)
                                .foregroundStyle(WanspotColors.textSecondary)
                            Text(
                                weather.temperatureCelsius.formatted(
                                    .number.precision(.fractionLength(0))
                                ) + "℃"
                            )
                            .font(.largeTitle.bold())
                            .foregroundStyle(WanspotColors.textPrimary)
                        }

                        Spacer()

                        Text(alert.label)
                            .font(.headline)
                            .foregroundStyle(alert.tint)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(
                                alert.tint.opacity(0.12),
                                in: .capsule
                            )
                    }

                    Text(alert.advice)
                        .font(.body)
                        .foregroundStyle(WanspotColors.textPrimary)

                    if let dog = model.primaryDog {
                        Label(
                            "\(dog.name)の犬種と年齢を考慮しています",
                            systemImage: "pawprint.fill"
                        )
                        .font(.caption)
                        .foregroundStyle(WanspotColors.textSecondary)
                    }

                    if let updatedAt {
                        Text(
                            "更新 "
                                + updatedAt.formatted(
                                    date: .omitted,
                                    time: .shortened
                                )
                        )
                        .font(.caption2)
                        .foregroundStyle(WanspotColors.textSecondary)
                    }
                }
                .padding(.vertical, 8)
            } else {
                ContentUnavailableView(
                    "予報を表示できません",
                    systemImage: "cloud.sun",
                    description: Text(
                        errorMessage
                            ?? "現在地を取得してから、もう一度お試しください。"
                    )
                )
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            }
        } header: {
            Text("現在地のお散歩目安")
        } footer: {
            Text(
                "現在の天気と愛犬の犬種・年齢から目安を表示します。"
                    + "実際の路面温度や体調も確認してください。"
            )
        }
    }

    private var alert: WalkAlert? {
        guard let weather else { return nil }
        let dog = model.primaryDog
        return WeatherJudgment.walkAlert(
            temperatureCelsius: weather.temperatureCelsius,
            heatSensitivity: WeatherJudgment.breedHeatSensitivity(dog?.breed),
            ageMonths: WeatherJudgment.dogAgeMonths(
                birthday: dog?.birthday
            )
        )
    }

    private var locationMessage: String? {
        guard locationSession.location == nil else { return nil }
        if let message = locationSession.errorMessage {
            return message
        }
        return locationSession.isLocating
            ? "現在地を確認しています。"
            : "お散歩予報には現在地を使用します。"
    }

    private func refresh() {
        if locationSession.location == nil {
            locationSession.requestCurrentLocation()
            return
        }
        Task {
            await loadWeather(force: true)
        }
    }

    private func loadWeather(force: Bool = false) async {
        guard
            !isLoading,
            let location = locationSession.location,
            let repository = model.weatherRepository
        else {
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            weather = try await repository.currentWeather(
                at: NearbyCoordinate(
                    latitude: location.coordinate.latitude,
                    longitude: location.coordinate.longitude
                ),
                force: force
            )
            updatedAt = Date()
        } catch {
            errorMessage = "天気情報を取得できませんでした。"
        }
    }

    private func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            return
        }
        UIApplication.shared.open(url)
    }
}

private extension WeatherCondition {
    var displayName: String {
        switch self {
        case .clear:
            "晴れ"
        case .partly:
            "晴れ時々くもり"
        case .cloudy:
            "くもり"
        case .rain:
            "雨"
        case .snow:
            "雪"
        case .thunder:
            "雷雨"
        case .fog:
            "霧"
        case .wind:
            "強風"
        }
    }

    var systemImage: String {
        switch self {
        case .clear:
            "sun.max.fill"
        case .partly:
            "cloud.sun.fill"
        case .cloudy:
            "cloud.fill"
        case .rain:
            "cloud.rain.fill"
        case .snow:
            "cloud.snow.fill"
        case .thunder:
            "cloud.bolt.rain.fill"
        case .fog:
            "cloud.fog.fill"
        case .wind:
            "wind"
        }
    }
}

private extension WalkAlert {
    var tint: Color {
        switch level {
        case .comfortable:
            .green
        case .chilly:
            .cyan
        case .numb, .sting:
            .blue
        case .caution:
            .orange
        case .danger, .stop:
            WanspotColors.error
        }
    }
}
