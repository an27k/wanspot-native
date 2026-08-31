import MapKit
import SwiftUI
import WanspotKit

struct SpotDetailHero: View {
    let detail: SpotDetail
    let photoURLs: [URL]

    @State private var selectedPhoto = 0
    /// 初回課金を抑えるため、1枚目以外は表示したページだけ読む。
    @State private var loadedPhotoIndexes: Set<Int> = [0]

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            if photoURLs.isEmpty {
                ZStack {
                    WanspotColors.tintWeak
                    VStack(spacing: 10) {
                        Image(systemName: "pawprint.fill")
                            .font(.system(size: 38, weight: .semibold))
                        Text("写真なし")
                            .font(.caption.weight(.semibold))
                    }
                    .foregroundStyle(WanspotColors.textSecondary)
                }
            } else {
                TabView(selection: $selectedPhoto) {
                    ForEach(Array(photoURLs.enumerated()), id: \.offset) {
                        index,
                        url in
                        photoPage(index: index, url: url)
                            .tag(index)
                            .clipped()
                            .accessibilityLabel("\(detail.name)の写真 \(index + 1)")
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .onChange(of: selectedPhoto) { _, index in
                    loadedPhotoIndexes.insert(index)
                }

                if photoURLs.count > 1 {
                    Text("\(selectedPhoto + 1) / \(photoURLs.count)")
                        .font(.caption2.bold())
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(.black.opacity(0.55), in: Capsule())
                        .padding(14)
                }
            }
        }
        .frame(height: 290)
        .clipped()
        .onChange(of: photoURLs) { _, _ in
            selectedPhoto = 0
            loadedPhotoIndexes = [0]
        }
    }

    @ViewBuilder
    private func photoPage(index: Int, url: URL) -> some View {
        if loadedPhotoIndexes.contains(index) {
            AsyncImage(
                url: url,
                transaction: Transaction(animation: .easeInOut)
            ) { phase in
                switch phase {
                case let .success(image):
                    image
                        .resizable()
                        .scaledToFill()
                case .empty:
                    photoPlaceholder(failed: false)
                case .failure:
                    photoPlaceholder(failed: true)
                @unknown default:
                    Color.clear
                }
            }
        } else {
            photoPlaceholder(failed: false)
        }
    }

    private func photoPlaceholder(failed: Bool) -> some View {
        ZStack {
            WanspotColors.tintWeak
            if failed {
                Image(systemName: "photo.badge.exclamationmark")
                    .font(.title)
                    .foregroundStyle(WanspotColors.textSecondary)
            } else {
                ProgressView()
                    .tint(WanspotColors.primary)
            }
        }
    }
}

struct SpotDetailIdentitySection: View {
    let detail: SpotDetail
    let distanceLabel: String?

    private var instagramURL: URL? {
        SpotSharing.instagramURL(
            instagramID: detail.instagramID,
            spotName: detail.name
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(detail.name)
                .font(.largeTitle.bold())
                .foregroundStyle(WanspotColors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 8) {
                if let rating = detail.rating {
                    Label(
                        rating.formatted(
                            .number.precision(.fractionLength(1))
                        ),
                        systemImage: "star.fill"
                    )
                    .foregroundStyle(.orange)
                }

                if let count = detail.userRatingsTotal {
                    Text("\(count)件")
                }

                Text(detail.category)

                if let distanceLabel {
                    Text(distanceLabel)
                }

                Spacer(minLength: 4)

                if let instagramURL {
                    Link(destination: instagramURL) {
                        InstagramIcon()
                            .frame(width: 24, height: 24)
                            .frame(width: 44, height: 44)
                            .background(WanspotColors.surface, in: Circle())
                            .overlay {
                                Circle().strokeBorder(WanspotColors.border)
                            }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(
                        detail.instagramID?.trimmingCharacters(
                            in: .whitespacesAndNewlines
                        ).isEmpty == false
                            ? "Instagram"
                            : "Instagramを検索"
                    )
                    .accessibilityIdentifier("spotDetail.instagram")
                }
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(WanspotColors.textSecondary)
            .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/*
  Google マップのブランドアイコン。RN 版 components/IconGoogleMaps.tsx の SVG
  （viewBox 48×48）を座標・色そのままに SwiftUI の Path へ写したもの。
  ブランド資産なので比率・配色は変えない。与えられた frame いっぱいに
  48×48 座標系をスケールするので、任意サイズ（24pt / 28pt / 16pt）で使える。

  唯一 SVG と違うのは角丸でクリップしている点。元の SVG は clip を持たず、
  緑（左下）と青（右上）の直角が角丸の外へ食み出す。アイコンとしては
  そこが欠けて見えるため、下地と同じ角丸で切り抜いている。
*/
struct GoogleMapsIcon: View {
    /// #E8F0FE / #34A853 / #FBBC05 / #4285F4 / #EA4335 / #B31412
    private static let plate = Color(red: 232 / 255, green: 240 / 255, blue: 254 / 255)
    private static let green = Color(red: 52 / 255, green: 168 / 255, blue: 83 / 255)
    private static let yellow = Color(red: 251 / 255, green: 188 / 255, blue: 5 / 255)
    private static let blue = Color(red: 66 / 255, green: 133 / 255, blue: 244 / 255)
    private static let red = Color(red: 234 / 255, green: 67 / 255, blue: 53 / 255)
    private static let holeRim = Color(red: 179 / 255, green: 20 / 255, blue: 18 / 255)

    private static let plateShape = GoogleMapsGlyph { path in
        path.addRoundedRect(
            in: CGRect(x: 2, y: 2, width: 44, height: 44),
            cornerSize: CGSize(width: 10, height: 10)
        )
    }

    var body: some View {
        ZStack {
            // 下地（rx10 の角丸）
            Self.plateShape.fill(Self.plate)

            // M2 14h18L8 46H2V14z
            GoogleMapsGlyph { path in
                path.move(to: CGPoint(x: 2, y: 14))
                path.addLine(to: CGPoint(x: 20, y: 14))
                path.addLine(to: CGPoint(x: 8, y: 46))
                path.addLine(to: CGPoint(x: 2, y: 46))
                path.closeSubpath()
            }
            .fill(Self.green)

            // M20 2h18l-12 44H8L20 2z
            GoogleMapsGlyph { path in
                path.move(to: CGPoint(x: 20, y: 2))
                path.addLine(to: CGPoint(x: 38, y: 2))
                path.addLine(to: CGPoint(x: 26, y: 46))
                path.addLine(to: CGPoint(x: 8, y: 46))
                path.closeSubpath()
            }
            .fill(Self.yellow)

            // M38 2h8v32L28 46 38 2z
            GoogleMapsGlyph { path in
                path.move(to: CGPoint(x: 38, y: 2))
                path.addLine(to: CGPoint(x: 46, y: 2))
                path.addLine(to: CGPoint(x: 46, y: 34))
                path.addLine(to: CGPoint(x: 28, y: 46))
                path.closeSubpath()
            }
            .fill(Self.blue)

            // ピン本体（c / s を絶対座標のベジェへ展開）
            GoogleMapsGlyph { path in
                path.move(to: CGPoint(x: 30, y: 6))
                path.addCurve(
                    to: CGPoint(x: 20, y: 15.8),
                    control1: CGPoint(x: 24.5, y: 6),
                    control2: CGPoint(x: 20, y: 10.4)
                )
                path.addCurve(
                    to: CGPoint(x: 30, y: 33),
                    control1: CGPoint(x: 20, y: 23),
                    control2: CGPoint(x: 30, y: 33)
                )
                path.addCurve(
                    to: CGPoint(x: 40, y: 15.8),
                    control1: CGPoint(x: 30, y: 33),
                    control2: CGPoint(x: 40, y: 23)
                )
                path.addCurve(
                    to: CGPoint(x: 30, y: 6),
                    control1: CGPoint(x: 40, y: 10.4),
                    control2: CGPoint(x: 35.5, y: 6)
                )
                path.closeSubpath()
            }
            .fill(Self.red)

            // 穴（cx30 cy16 / r4.2 と r2.2）
            GoogleMapsGlyph { path in
                path.addEllipse(
                    in: CGRect(x: 25.8, y: 11.8, width: 8.4, height: 8.4)
                )
            }
            .fill(Self.holeRim)

            GoogleMapsGlyph { path in
                path.addEllipse(
                    in: CGRect(x: 27.8, y: 13.8, width: 4.4, height: 4.4)
                )
            }
            .fill(.white)
        }
        .clipShape(Self.plateShape)
        .accessibilityHidden(true)
    }
}

/*
  48×48 の viewBox で書いた図形を、渡された frame の短辺に合わせて拡大縮小する。
  ベクタのままスケールするので 16pt でも 44pt でも潰れない。
*/
private struct GoogleMapsGlyph: Shape {
    let build: @Sendable (inout Path) -> Void

    func path(in rect: CGRect) -> Path {
        var path = Path()
        build(&path)
        let side = min(rect.width, rect.height)
        let scale = side / 48
        // 短辺に合わせたうえで、余った側は中央へ寄せる
        let offsetX = rect.minX + (rect.width - side) / 2
        let offsetY = rect.minY + (rect.height - side) / 2
        return path.applying(
            CGAffineTransform(translationX: offsetX, y: offsetY)
                .scaledBy(x: scale, y: scale)
        )
    }
}

private struct InstagramIcon: View {
    private let gradient = LinearGradient(
        colors: [
            Color(red: 0.50, green: 0.20, blue: 0.80),
            Color(red: 0.88, green: 0.18, blue: 0.47),
            Color(red: 1.00, green: 0.58, blue: 0.20),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 6.5, style: .continuous)
                .stroke(gradient, lineWidth: 2.4)

            Circle()
                .stroke(gradient, lineWidth: 2.4)
                .frame(width: 9.5, height: 9.5)

            Circle()
                .fill(gradient)
                .frame(width: 3, height: 3)
                .offset(x: 6.5, y: -6.5)
        }
        .accessibilityHidden(true)
    }
}

struct SpotPetAccessSection: View {
    let detail: SpotDetail

    private var presentation: PetPolicyPresentation {
        PetPolicy.presentation(for: detail)
    }

    var body: some View {
        SpotDetailSectionContainer(
            title: "愛犬との利用条件",
            systemImage: "pawprint.fill"
        ) {
            VStack(alignment: .leading, spacing: 12) {
                if let badge = presentation.badge {
                    Label(
                        badge.label,
                        systemImage: badge.tone == .caution
                            ? "exclamationmark.circle.fill"
                            : "checkmark.seal.fill"
                    )
                    .font(.subheadline.bold())
                    .foregroundStyle(foreground(for: badge.tone))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(
                        foreground(for: badge.tone).opacity(0.11),
                        in: Capsule()
                    )
                }

                ForEach(presentation.conditions, id: \.label) { condition in
                    Label(
                        condition.label,
                        systemImage: systemImage(for: condition.kind)
                    )
                    .font(.subheadline)
                    .foregroundStyle(
                        condition.isCaution
                            ? Color.orange
                            : WanspotColors.textPrimary
                    )
                }

                if let advisory = presentation.advisory {
                    Text(advisory)
                        .font(.footnote)
                        .foregroundStyle(WanspotColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private func foreground(for tone: PetPolicyBadgeTone) -> Color {
        switch tone {
        case .ok:
            .green
        case .terrace:
            .orange
        case .caution:
            WanspotColors.textSecondary
        }
    }

    private func systemImage(for kind: PetAccessConditionKind) -> String {
        switch kind {
        case .size:
            "ruler"
        case .reservation:
            "calendar.badge.exclamationmark"
        case .interaction:
            "dog.fill"
        }
    }
}

struct SpotOpeningHoursSection: View {
    let detail: SpotDetail

    @State private var showsAllHours = false

    var body: some View {
        SpotDetailSectionContainer(
            title: "営業時間",
            systemImage: "clock.fill"
        ) {
            VStack(alignment: .leading, spacing: 12) {
                if let summary {
                    Label(summary.label, systemImage: statusImage(summary.tone))
                        .font(.headline)
                        .foregroundStyle(statusColor(summary.tone))
                } else {
                    Text("営業時間はGoogle Mapsでご確認ください。")
                        .font(.subheadline)
                        .foregroundStyle(WanspotColors.textSecondary)
                }

                if let weekdayText = detail.openingHours?.weekdayText,
                   !weekdayText.isEmpty
                {
                    DisclosureGroup(
                        "曜日ごとの営業時間",
                        isExpanded: $showsAllHours
                    ) {
                        VStack(alignment: .leading, spacing: 7) {
                            ForEach(weekdayText, id: \.self) { line in
                                Text(line)
                                    .font(.footnote)
                                    .foregroundStyle(WanspotColors.textSecondary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                        .padding(.top, 10)
                    }
                    .font(.subheadline.weight(.semibold))
                    .tint(WanspotColors.primary)
                }
            }
        }
    }

    private var summary: HoursSummary? {
        guard let hours = detail.openingHours else { return nil }
        if !hours.weekdayText.isEmpty {
            return BusinessHours.todayHoursSummary(
                weekdayText: hours.weekdayText,
                openNow: hours.openNow
            )
        }
        guard !hours.periods.isEmpty else {
            return hours.openNow.map {
                HoursSummary(
                    label: $0 ? "営業中" : "営業時間外",
                    tone: $0 ? .open : .closed
                )
            }
        }
        let state = BusinessHours.openStateFromPeriods(hours.periods)
        let range = BusinessHours.todayRangeFromPeriods(hours.periods)
        let label = range.map { "本日 \($0)" }
            ?? (state.status == .open ? "営業中" : "本日は休み")
        return HoursSummary(label: label, tone: state.status)
    }

    private func statusImage(_ status: OpenStatus) -> String {
        switch status {
        case .open:
            "checkmark.circle.fill"
        case .closed:
            "minus.circle.fill"
        case .unknown:
            "clock"
        }
    }

    private func statusColor(_ status: OpenStatus) -> Color {
        switch status {
        case .open:
            .green
        case .closed:
            WanspotColors.error
        case .unknown:
            WanspotColors.textSecondary
        }
    }
}

struct SpotAIReviewSection: View {
    let isLoading: Bool
    let summary: AISummary?
    let emptyReason: AISummaryEmptyReason?
    let onRetry: () -> Void
    let onSubmitInformation: () -> Void

    @State private var isExpanded = false

    var body: some View {
        SpotDetailSectionContainer(
            title: "ワンスポ AIレビュー",
            systemImage: "sparkles"
        ) {
            Group {
                if isLoading {
                    HStack(spacing: 12) {
                        ProgressView()
                            .tint(WanspotColors.primary)
                        Text("犬連れ情報をまとめています…")
                            .font(.subheadline)
                            .foregroundStyle(WanspotColors.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else if let summary {
                    summaryContent(summary)
                } else {
                    emptyContent
                }
            }
        }
        .background(WanspotColors.tintWeak.opacity(0.45))
    }

    private func summaryContent(_ summary: AISummary) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if !summary.keywords.isEmpty {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(Array(summary.keywords.prefix(3)), id: \.self) {
                            keyword in
                            Text(keyword)
                                .font(.caption.bold())
                                .foregroundStyle(WanspotColors.primary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(WanspotColors.surface, in: Capsule())
                        }
                    }
                }
                .scrollIndicators(.hidden)
            }

            if let rating = summary.wanspotRating, rating.count > 0 {
                HStack(spacing: 7) {
                    Image(systemName: "star.fill")
                        .foregroundStyle(.orange)
                    Text(
                        rating.average.formatted(
                            .number.precision(.fractionLength(1))
                        )
                    )
                    .font(.headline)
                    Text("ワンスポ評価 \(rating.count)件")
                        .font(.caption)
                        .foregroundStyle(WanspotColors.textSecondary)
                }
            }

            Text(summary.summary)
                .font(.body)
                .foregroundStyle(WanspotColors.textPrimary)
                .lineLimit(isExpanded ? nil : 4)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("spotDetail.aiSummary")

            Button(isExpanded ? "閉じる" : "続きを読む") {
                withAnimation(.snappy) {
                    isExpanded.toggle()
                }
            }
            .font(.footnote.bold())
            .foregroundStyle(WanspotColors.primary)

            if let personalNote = summary.personalNote,
               !personalNote.trimmingCharacters(
                   in: .whitespacesAndNewlines
               ).isEmpty
            {
                Divider()
                Label(personalNote, systemImage: "pawprint.fill")
                    .font(.subheadline)
                    .foregroundStyle(WanspotColors.primary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if summary.searchState == .pending {
                Text("さらにくわしい情報を調べています")
                    .font(.caption)
                    .foregroundStyle(WanspotColors.textSecondary)
            }
        }
    }

    private var emptyContent: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(
                emptyReason == .noInformation
                    ? "このスポットの犬連れ情報は、ネット上に見つかりませんでした。"
                    : "いま混み合っています。しばらくしてから、もう一度お試しください。"
            )
            .font(.subheadline)
            .foregroundStyle(WanspotColors.textSecondary)
            .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 10) {
                Button("再試行", action: onRetry)
                    .buttonStyle(.bordered)

                Button(action: onSubmitInformation) {
                    Label("情報を教える", systemImage: "pawprint")
                }
                .buttonStyle(.borderedProminent)
                .tint(WanspotColors.primary)
            }
        }
    }
}

struct SpotUserReviewSection: View {
    @Bindable var store: SpotDetailStore

    var body: some View {
        SpotDetailSectionContainer(
            title: "あなたの評価",
            systemImage: "star.bubble.fill"
        ) {
            VStack(alignment: .leading, spacing: 14) {
                Text("この情報は公開されず、AIが提案する内容の改善に使われます。")
                    .font(.caption)
                    .foregroundStyle(WanspotColors.textSecondary)

                HStack(spacing: 8) {
                    ForEach(1 ... 5, id: \.self) { rating in
                        Button {
                            Task { await store.saveRating(rating) }
                        } label: {
                            Image(
                                systemName: rating <= store.userRating
                                    ? "star.fill"
                                    : "star"
                            )
                            .font(.title3)
                            .foregroundStyle(
                                rating <= store.userRating
                                    ? Color.orange
                                    : WanspotColors.borderEmphasis
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(store.isRatingSaving)
                        .accessibilityLabel("星\(rating)")
                        .accessibilityIdentifier(
                            "spotDetail.userRating.\(rating)"
                        )
                    }
                }

                TextEditor(
                    text: Binding(
                        get: { store.userMemo },
                        set: { value in
                            store.memoDidChange(value)
                        }
                    )
                )
                .font(.body)
                .frame(minHeight: 92)
                .scrollContentBackground(.hidden)
                .accessibilityLabel("スポットのメモ")
                .accessibilityIdentifier("spotDetail.userMemo")
                .padding(8)
                .background(
                    WanspotColors.input,
                    in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                )
                .overlay(alignment: .topLeading) {
                    if store.userMemo.isEmpty {
                        Text("愛犬の様子や、次回覚えておきたいこと")
                            .font(.body)
                            .foregroundStyle(WanspotColors.textSecondary.opacity(0.75))
                            .padding(.horizontal, 13)
                            .padding(.vertical, 17)
                            .allowsHitTesting(false)
                    }
                }

                HStack {
                    if store.isMemoSaving {
                        ProgressView()
                            .controlSize(.small)
                        Text("保存中…")
                    } else if store.memoWasSaved {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                        Text("保存しました")
                    }

                    Spacer()

                    Button("保存") {
                        Task { await store.saveMemo() }
                    }
                    .buttonStyle(.bordered)
                    .disabled(store.isMemoSaving)
                }
                .font(.caption)
                .foregroundStyle(WanspotColors.textSecondary)
            }
        }
    }
}

struct SpotDetailsSection: View {
    let detail: SpotDetail

    private var mapURL: URL? {
        detail.googleMapsURL
            ?? SpotSharing.googleMapsURL(
                name: detail.name,
                placeID: detail.placeID,
                latitude: detail.latitude,
                longitude: detail.longitude
            )
    }

    var body: some View {
        SpotDetailSectionContainer(
            title: "スポット詳細",
            systemImage: "info.circle.fill"
        ) {
            VStack(alignment: .leading, spacing: 14) {
                if let coordinate = detail.coordinate {
                    Map(
                        initialPosition: .region(
                            MKCoordinateRegion(
                                center: CLLocationCoordinate2D(
                                    latitude: coordinate.latitude,
                                    longitude: coordinate.longitude
                                ),
                                span: MKCoordinateSpan(
                                    latitudeDelta: 0.012,
                                    longitudeDelta: 0.012
                                )
                            )
                        ),
                        interactionModes: []
                    ) {
                        Marker(
                            detail.name,
                            coordinate: CLLocationCoordinate2D(
                                latitude: coordinate.latitude,
                                longitude: coordinate.longitude
                            )
                        )
                        .tint(WanspotColors.primary)
                    }
                    .frame(height: 150)
                    .clipShape(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                    )
                    .accessibilityLabel("\(detail.name)の地図")
                }

                if let address = detail.address {
                    detailRow(
                        title: "住所",
                        value: address,
                        systemImage: "mappin.and.ellipse"
                    )
                }

                if let price = BusinessHours.formatPriceDisplay(
                    priceLabel: detail.priceLabel,
                    priceLevel: detail.priceLevel.map(Double.init)
                ) {
                    detailRow(
                        title: "料金",
                        value: price,
                        systemImage: "yensign.circle"
                    )
                }

                if let phone = detail.formattedPhoneNumber {
                    detailRow(
                        title: "電話",
                        value: phone,
                        systemImage: "phone"
                    )
                }

                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 10) {
                        destinationLinks
                    }
                    VStack(alignment: .leading, spacing: 10) {
                        destinationLinks
                    }
                }
                .font(.subheadline.weight(.semibold))
            }
        }
    }

    @ViewBuilder
    private var destinationLinks: some View {
        if let mapURL {
            Link(destination: mapURL) {
                Label {
                    Text("Google Maps")
                } icon: {
                    GoogleMapsIcon()
                        .frame(width: 17, height: 17)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(WanspotColors.primary)
        }

        if let websiteURL = detail.websiteURL {
            Link(destination: websiteURL) {
                Label("公式サイト", systemImage: "safari.fill")
            }
            .buttonStyle(.bordered)
        }

    }

    private func detailRow(
        title: String,
        value: String,
        systemImage: String
    ) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: systemImage)
                .foregroundStyle(WanspotColors.primary)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.caption.bold())
                    .foregroundStyle(WanspotColors.textSecondary)
                Text(value)
                    .font(.subheadline)
                    .foregroundStyle(WanspotColors.textPrimary)
                    .textSelection(.enabled)
            }
        }
    }
}

struct SpotRelatedArticlesSection: View {
    let articles: [ArticleSummary]
    let onOpen: (ArticleSummary) -> Void

    var body: some View {
        SpotDetailSectionContainer(
            title: "このスポットの掲載記事",
            systemImage: "newspaper.fill"
        ) {
            VStack(alignment: .leading, spacing: 12) {
                Text("記事を開くと、一緒に紹介された似たスポットも探せます。")
                    .font(.subheadline)
                    .foregroundStyle(WanspotColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                ForEach(articles) { article in
                    Button {
                        onOpen(article)
                    } label: {
                        HStack(spacing: 12) {
                            WanspotRemoteImage(
                                url: ContentImageURL.resized(
                                    article.imageURL,
                                    to: .thumbnail
                                ),
                                cornerRadius: 11,
                                accessibilityLabel: article.title
                            )
                            .frame(width: 92, height: 82)

                            VStack(alignment: .leading, spacing: 5) {
                                if let metadata = metadata(for: article) {
                                    Text(metadata)
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(WanspotColors.primary)
                                        .lineLimit(1)
                                }

                                Text(article.title)
                                    .font(.subheadline.bold())
                                    .foregroundStyle(WanspotColors.textPrimary)
                                    .multilineTextAlignment(.leading)
                                    .lineLimit(2)

                                if !article.summary.isEmpty {
                                    Text(article.summary)
                                        .font(.caption)
                                        .foregroundStyle(
                                            WanspotColors.textSecondary
                                        )
                                        .multilineTextAlignment(.leading)
                                        .lineLimit(1)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            Image(systemName: "chevron.right")
                                .font(.caption.bold())
                                .foregroundStyle(WanspotColors.textSecondary)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            WanspotColors.input,
                            in: RoundedRectangle(
                                cornerRadius: 14,
                                style: .continuous
                            )
                        )
                        .contentShape(
                            RoundedRectangle(
                                cornerRadius: 14,
                                style: .continuous
                            )
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("記事を開いて似たスポットを探します")
                    .accessibilityIdentifier(
                        "spotDetail.relatedArticle.\(article.slug)"
                    )
                }
            }
        }
    }

    private func metadata(for article: ArticleSummary) -> String? {
        let theme = ArticleRules.parseTheme(article.theme)
        let value = [theme.area, theme.genreLabel]
            .compactMap(\.self)
            .joined(separator: " ・ ")
        return value.isEmpty ? nil : value
    }
}

struct SpotDetailSectionContainer<Content: View>: View {
    let title: String
    let systemImage: String
    let content: Content

    init(
        title: String,
        systemImage: String,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.systemImage = systemImage
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label(title, systemImage: systemImage)
                .font(.headline)
                .foregroundStyle(WanspotColors.textPrimary)
                .symbolRenderingMode(.hierarchical)
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            WanspotColors.surface,
            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(WanspotColors.border, lineWidth: 0.7)
        }
    }
}
