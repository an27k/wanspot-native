import AVFoundation
import AuthenticationServices
import PhotosUI
import SwiftUI
import UIKit
import WanspotKit

struct OnboardingFlowView: View {
    @Environment(AppModel.self) private var appModel
    @State private var store = OnboardingStore()

    var body: some View {
        Group {
            switch store.step {
            case .dog:
                DogOnboardingView(store: store)
            case .location:
                LocationOnboardingView(store: store)
            case .area:
                WalkAreaOnboardingView(store: store)
            case .ready:
                ReadyOnboardingView(store: store)
            }
        }
        .background(WanspotColors.paper)
        .task {
            store.restore(from: appModel.savedOnboardingDraft())
        }
    }
}

private struct DogOnboardingView: View {
    @Environment(AppModel.self) private var appModel
    @Bindable var store: OnboardingStore
    @State private var photoItem: PhotosPickerItem?
    @State private var showsPhotoOptions = false
    @State private var showsPhotoLibrary = false
    @State private var showsCamera = false
    @State private var showsCameraPermissionAlert = false
    @State private var showsBreedPicker = false
    @State private var showsVaccines = false

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                OnboardingStepHeader(step: 1)
                VStack(spacing: 8) {
                    Text("愛犬のことを\n教えてください")
                        .font(.title.bold())
                        .multilineTextAlignment(.center)
                    Text("プロフィールに使います。あとからいつでも変更できます。")
                        .font(.caption)
                        .foregroundStyle(WanspotColors.textSecondary)
                }
                photoPicker
                OnboardingField(title: "名前", isRequired: true) {
                    TextField("例: モカ", text: $store.name)
                        .textContentType(.name)
                        .onboardingInputStyle()
                }
                OnboardingField(title: "犬種", isRequired: true) {
                    Button {
                        showsBreedPicker = true
                    } label: {
                        SelectionRow(
                            value: store.breed,
                            placeholder: "タップして犬種を選ぶ"
                        )
                    }
                }
                OnboardingField(
                    title: "サイズ",
                    isRequired: true,
                    hint: "選ぶと体重・体高の目安が表示されます"
                ) {
                    dogSizePicker
                }
                OnboardingField(
                    title: "いつものお散歩時間",
                    hint: "お散歩予報の通知時刻に使います（あとから設定で変更できます）"
                ) {
                    walkTimePicker
                }
                OnboardingField(
                    title: "誕生日（任意）",
                    hint: "お誕生日をお祝いしたいので、わかる範囲で。あとからでも入れられます"
                ) {
                    optionalDatePicker(date: $store.birthday)
                }
                vaccineSection
                if let errorMessage = store.errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(WanspotColors.error)
                }
            }
            .foregroundStyle(WanspotColors.textPrimary)
            .padding(.horizontal, WanspotMetrics.pagePadding)
            .padding(.top, 16)
            .padding(.bottom, 100)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) {
            Button {
                store.continueFromDog(appModel: appModel)
            } label: {
                Text(store.isUploadingPhoto ? "写真を保存中..." : "次へ")
            }
            .buttonStyle(WanspotPrimaryButtonStyle())
            .disabled(!store.canContinueDog)
            .opacity(store.canContinueDog ? 1 : 0.45)
            .padding(.horizontal, WanspotMetrics.pagePadding)
            .padding(.vertical, 12)
            .background(WanspotColors.paper)
        }
        .sheet(isPresented: $showsBreedPicker) {
            DogBreedPicker(selection: $store.breed)
        }
        .confirmationDialog(
            "写真を選択",
            isPresented: $showsPhotoOptions,
            titleVisibility: .visible
        ) {
            Button("カメラで撮影") {
                openCamera()
            }
            Button("ライブラリから選択") {
                showsPhotoLibrary = true
            }
            Button("キャンセル", role: .cancel) {}
        }
        .photosPicker(
            isPresented: $showsPhotoLibrary,
            selection: $photoItem,
            matching: .images
        )
        .fullScreenCover(isPresented: $showsCamera) {
            CameraImagePicker { data in
                showsCamera = false
                uploadPhoto(data)
            } onCancel: {
                showsCamera = false
            }
            .ignoresSafeArea()
        }
        .alert("権限が必要です", isPresented: $showsCameraPermissionAlert) {
            Button("設定を開く") {
                UIApplication.shared.open(
                    URL(string: UIApplication.openSettingsURLString)!
                )
            }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("設定アプリからカメラへのアクセスを許可してください。")
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task {
                guard let data = try? await item.loadTransferable(
                    type: Data.self
                ) else {
                    store.errorMessage = "写真を読み込めませんでした"
                    return
                }
                uploadPhoto(data)
            }
        }
    }

    private var photoPicker: some View {
        let previewData = store.photoPreviewData
        let remotePhotoURL = store.photoURL
        return VStack(spacing: 8) {
            Button {
                showsPhotoOptions = true
            } label: {
                ZStack {
                    Circle()
                        .fill(WanspotColors.tintWeak)
                        .frame(width: 96, height: 96)
                    if
                        let data = previewData,
                        let image = UIImage(data: data)
                    {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 96, height: 96)
                            .clipShape(.circle)
                    } else if let photoURL = remotePhotoURL {
                        AsyncImage(url: photoURL) { image in
                            image
                                .resizable()
                                .scaledToFill()
                        } placeholder: {
                            ProgressView()
                        }
                        .frame(width: 96, height: 96)
                        .clipShape(.circle)
                    } else {
                        Image(systemName: "camera.fill")
                            .font(.title2)
                            .foregroundStyle(WanspotColors.primary)
                    }
                }
                .overlay {
                    Circle().stroke(WanspotColors.primary)
                }
            }
            Text(
                remotePhotoURL == nil && previewData == nil
                    ? "写真を追加（任意）"
                    : "写真を変更"
            )
            .font(.caption)
            .foregroundStyle(WanspotColors.textSecondary)
        }
    }

    private func openCamera() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            showsCamera = true
        case .notDetermined:
            Task {
                if await AVCaptureDevice.requestAccess(for: .video) {
                    showsCamera = true
                } else {
                    showsCameraPermissionAlert = true
                }
            }
        case .denied, .restricted:
            showsCameraPermissionAlert = true
        @unknown default:
            showsCameraPermissionAlert = true
        }
    }

    private func uploadPhoto(_ data: Data) {
        Task {
            await store.uploadPhoto(data: data, appModel: appModel)
        }
    }

    private var dogSizePicker: some View {
        VStack(spacing: 8) {
            ForEach(DogSize.onboardingOptions) { option in
                Button {
                    store.size = option.size
                } label: {
                    HStack {
                        Text(option.size.rawValue)
                            .font(.headline)
                        if store.size == option.size {
                            Text(option.description)
                                .font(.caption)
                                .foregroundStyle(
                                    WanspotColors.textSecondary
                                )
                            Spacer()
                            Image(systemName: "checkmark.circle.fill")
                        } else {
                            Spacer()
                        }
                    }
                    .foregroundStyle(
                        store.size == option.size
                            ? WanspotColors.primary
                            : WanspotColors.textSecondary
                    )
                    .padding(.horizontal, 14)
                    .frame(height: 46)
                    .background(
                        store.size == option.size
                            ? WanspotColors.tintWeak
                            : WanspotColors.surface
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                store.size == option.size
                                    ? WanspotColors.primary
                                    : WanspotColors.border
                            )
                    }
                }
            }
        }
    }

    private var walkTimePicker: some View {
        FlowLayout(spacing: 8) {
            ForEach(OnboardingDomain.walkTimeChoices) { choice in
                let isSelected =
                    store.walkTimeWasPicked
                    && store.walkTimeHour == choice.hour
                Button(choice.label) {
                    store.walkTimeWasPicked = true
                    store.walkTimeHour = choice.hour
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(
                    isSelected
                        ? WanspotColors.primary
                        : WanspotColors.textSecondary
                )
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    isSelected
                        ? WanspotColors.tintWeak
                        : WanspotColors.surface
                )
                .clipShape(.capsule)
                .overlay {
                    Capsule().stroke(
                        isSelected
                            ? WanspotColors.primary
                            : WanspotColors.border
                    )
                }
            }
        }
    }

    private var vaccineSection: some View {
        DisclosureGroup(isExpanded: $showsVaccines) {
            VStack(spacing: 16) {
                VaccineInput(
                    title: "混合ワクチン",
                    value: $store.mixedVaccine,
                    date: $store.mixedVaccineDate
                )
                VaccineInput(
                    title: "狂犬病ワクチン",
                    value: $store.rabiesVaccine,
                    date: $store.rabiesVaccineDate
                )
            }
            .padding(.top, 14)
        } label: {
            VStack(alignment: .leading, spacing: 3) {
                Text("ワクチン（任意）")
                    .font(.subheadline.weight(.semibold))
                Text("あとから設定でも大丈夫です")
                    .font(.caption)
                    .foregroundStyle(WanspotColors.textSecondary)
            }
        }
        .padding(16)
        .background(WanspotColors.surface)
        .clipShape(.rect(cornerRadius: WanspotMetrics.buttonRadius))
        .overlay {
            RoundedRectangle(cornerRadius: WanspotMetrics.buttonRadius)
                .stroke(WanspotColors.border)
        }
    }

    private func optionalDatePicker(
        date: Binding<Date?>
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if date.wrappedValue != nil {
                DatePicker(
                    "",
                    selection: Binding(
                        get: { date.wrappedValue ?? Date() },
                        set: { date.wrappedValue = $0 }
                    ),
                    in: dogBirthdayRange,
                    displayedComponents: .date
                )
                .labelsHidden()
                Button("日付を削除", role: .destructive) {
                    date.wrappedValue = nil
                }
                .font(.caption)
            } else {
                Button("タップして日付を選ぶ") {
                    date.wrappedValue = Date()
                }
                .foregroundStyle(WanspotColors.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .onboardingInputStyle()
            }
        }
    }

    private var dogBirthdayRange: ClosedRange<Date> {
        let calendar = Calendar.autoupdatingCurrent
        let lower = calendar.date(
            byAdding: .year,
            value: -35,
            to: Date()
        ) ?? Date.distantPast
        return lower ... Date()
    }
}

private struct LocationOnboardingView: View {
    @Environment(AppModel.self) private var appModel
    @Bindable var store: OnboardingStore
    @State private var locationProvider = OnboardingLocationProvider()
    @State private var isRequestingLocation = false
    @State private var showsDeniedAlert = false

    var body: some View {
        VStack(spacing: 18) {
            OnboardingStepHeader(step: 2)
            Text("\(store.dogLabel)とのお出かけの\n準備ができました！")
                .font(.title.bold())
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.6)
            Text(
                "現在地を許可すると、今いる場所のまわりで\(store.dogLabel)と入れるスポットが提案できます。\nまた、今日の天候を分析してお散歩に向いた時間もお知らせします。\nあとからアプリで変更もできます。"
            )
            .font(.body)
            .foregroundStyle(WanspotColors.textSecondary)
            .padding(18)
            .background(WanspotColors.surface)
            .clipShape(.rect(cornerRadius: WanspotMetrics.buttonRadius))
            .overlay {
                RoundedRectangle(cornerRadius: WanspotMetrics.buttonRadius)
                    .stroke(WanspotColors.border)
            }
            Spacer()
            if let errorMessage = store.errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(WanspotColors.error)
            }
            Button {
                requestLocation()
            } label: {
                if isRequestingLocation || store.isBusy {
                    ProgressView()
                        .tint(WanspotColors.onPrimary)
                } else {
                    Text("はじめる")
                }
            }
            .buttonStyle(WanspotPrimaryButtonStyle())
            .disabled(isRequestingLocation || store.isBusy)
        }
        .foregroundStyle(WanspotColors.textPrimary)
        .padding(.horizontal, WanspotMetrics.pagePadding)
        .padding(.vertical, 16)
        .background(WanspotColors.paper)
        .alert("散歩エリアを選びます", isPresented: $showsDeniedAlert) {
            Button("設定を開く") {
                UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)
            }
            Button("続ける", role: .cancel) {
                appModel.markOnboardingLocationDeclined()
                store.step = .area
            }
        } message: {
            Text(
                "現在地を使わない場合は、次の画面でよく行くエリアを選べます。あとから設定アプリで変更もできます。"
            )
        }
    }

    private func requestLocation() {
        guard !isRequestingLocation, !store.isBusy else { return }
        isRequestingLocation = true
        store.errorMessage = nil
        Task {
            defer { isRequestingLocation = false }
            do {
                let coordinate = try await locationProvider.requestCoordinate()
                appModel.saveOnboardingLocation(
                    (coordinate.latitude, coordinate.longitude)
                )
                await store.complete(appModel: appModel, walkAreaTags: [])
            } catch OnboardingLocationError.denied {
                showsDeniedAlert = true
            } catch {
                store.errorMessage = error.localizedDescription
            }
        }
    }
}

private struct WalkAreaOnboardingView: View {
    @Bindable var store: OnboardingStore
    @State private var search = ""

    private var results: [WalkAreaCatalogEntry] {
        OnboardingCatalog.searchWalkAreas(search)
            .filter { !store.walkAreaTags.contains($0.label) }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                OnboardingStepHeader(step: 2)
                Text("よく散歩する\nエリアを選んでください")
                    .font(.title.bold())
                    .multilineTextAlignment(.center)
                Text(
                    "位置情報が使えない場合のフォールバックです。近くのおすすめに使います。あとから設定でも変更できます。"
                )
                .font(.caption)
                .foregroundStyle(WanspotColors.textSecondary)
                selectedTags
                TextField("例：世田谷、横浜、大阪", text: $search)
                    .onboardingInputStyle()
                if !search.trimmingCharacters(
                    in: .whitespacesAndNewlines
                ).isEmpty {
                    if results.isEmpty {
                        Text("一致する主要エリアがありません。")
                            .font(.caption)
                            .foregroundStyle(WanspotColors.textSecondary)
                    } else {
                        FlowLayout(spacing: 8) {
                            ForEach(results) { entry in
                                Button(entry.label) {
                                    toggle(entry.label)
                                }
                                .walkAreaChip(isSelected: false)
                                .disabled(
                                    store.walkAreaTags.count
                                        >= OnboardingCatalog
                                        .maximumWalkAreaTags
                                )
                            }
                        }
                    }
                }
                if let errorMessage = store.errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(WanspotColors.error)
                }
                Button("はじめる") {
                    store.step = .ready
                }
                .buttonStyle(WanspotPrimaryButtonStyle())
                .disabled(store.walkAreaTags.isEmpty)
                .opacity(store.walkAreaTags.isEmpty ? 0.45 : 1)
                .padding(.top, 8)
            }
            .foregroundStyle(WanspotColors.textPrimary)
            .padding(.horizontal, WanspotMetrics.pagePadding)
            .padding(.vertical, 16)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(WanspotColors.paper)
    }

    private var selectedTags: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(
                "選択中（最大\(OnboardingCatalog.maximumWalkAreaTags)つ）"
            )
            .font(.subheadline.weight(.semibold))
            if store.walkAreaTags.isEmpty {
                Text("まだありません。下のエリアをタップして追加してください。")
                    .font(.caption)
                    .foregroundStyle(WanspotColors.textSecondary)
            } else {
                FlowLayout(spacing: 8) {
                    ForEach(store.walkAreaTags, id: \.self) { tag in
                        Button {
                            toggle(tag)
                        } label: {
                            Label(tag, systemImage: "xmark")
                        }
                        .walkAreaChip(isSelected: true)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(WanspotColors.surface)
        .clipShape(.rect(cornerRadius: WanspotMetrics.buttonRadius))
        .overlay {
            RoundedRectangle(cornerRadius: WanspotMetrics.buttonRadius)
                .stroke(WanspotColors.border)
        }
    }

    private func toggle(_ label: String) {
        if store.walkAreaTags.contains(label) {
            store.walkAreaTags.removeAll { $0 == label }
        } else if
            store.walkAreaTags.count
                < OnboardingCatalog.maximumWalkAreaTags
        {
            store.walkAreaTags.append(label)
        }
    }
}

private struct ReadyOnboardingView: View {
    @Environment(AppModel.self) private var appModel
    @Bindable var store: OnboardingStore

    var body: some View {
        VStack(spacing: 18) {
            OnboardingBrandLockup()
            Text("\(store.dogLabel)とのお出かけの\n準備ができました！")
                .font(.title.bold())
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.6)
            Text(
                "選んだエリアのまわりで、\(store.dogLabel)と入れるスポットが提案できます。\n現在地を許可すると、今いる場所から探せるようになります。\nあとからアプリで変更もできます。"
            )
            .foregroundStyle(WanspotColors.textSecondary)
            .padding(18)
            .background(WanspotColors.surface)
            .clipShape(.rect(cornerRadius: WanspotMetrics.buttonRadius))
            .overlay {
                RoundedRectangle(cornerRadius: WanspotMetrics.buttonRadius)
                    .stroke(WanspotColors.border)
            }
            Spacer()
            if let errorMessage = store.errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(WanspotColors.error)
            }
            Button {
                Task {
                    await store.complete(
                        appModel: appModel,
                        walkAreaTags: store.walkAreaTags
                    )
                }
            } label: {
                if store.isBusy {
                    ProgressView()
                        .tint(WanspotColors.onPrimary)
                } else {
                    Text("はじめる")
                }
            }
            .buttonStyle(WanspotPrimaryButtonStyle())
            .disabled(store.isBusy)
        }
        .foregroundStyle(WanspotColors.textPrimary)
        .padding(.horizontal, WanspotMetrics.pagePadding)
        .padding(.vertical, 16)
        .background(WanspotColors.paper)
    }
}

private struct OnboardingStepHeader: View {
    let step: Int

    var body: some View {
        VStack(spacing: 14) {
            OnboardingBrandLockup()
            HStack(spacing: 6) {
                ForEach(1 ... 2, id: \.self) { index in
                    Capsule()
                        .fill(
                            index <= step
                                ? WanspotColors.primary
                                : WanspotColors.border
                        )
                        .frame(width: 36, height: 4)
                }
            }
        }
    }
}

private struct OnboardingBrandLockup: View {
    var body: some View {
        HStack(spacing: 8) {
            Image("WanspotLogo")
                .resizable()
                .scaledToFill()
                .frame(width: 32, height: 32)
                .clipShape(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                )
            Text("Wanspot")
                .font(.title3.bold())
        }
    }
}

private struct OnboardingField<Content: View>: View {
    let title: String
    var isRequired = false
    var hint: String?
    let content: Content

    init(
        title: String,
        isRequired: Bool = false,
        hint: String? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.isRequired = isRequired
        self.hint = hint
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                if isRequired {
                    Text("必須")
                        .font(.caption2)
                        .foregroundStyle(WanspotColors.primary)
                }
            }
            if let hint {
                Text(hint)
                    .font(.caption)
                    .foregroundStyle(WanspotColors.textSecondary)
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct SelectionRow: View {
    let value: String
    let placeholder: String

    var body: some View {
        HStack {
            Text(value.isEmpty ? placeholder : value)
                .foregroundStyle(
                    value.isEmpty
                        ? WanspotColors.textSecondary
                        : WanspotColors.textPrimary
                )
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(WanspotColors.textSecondary)
        }
        .onboardingInputStyle()
    }
}

private struct DogBreedPicker: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var selection: String
    @State private var query = ""

    private var results: [String] {
        OnboardingCatalog.filterDogBreeds(query)
    }

    var body: some View {
        NavigationStack {
            List {
                if query.isEmpty {
                    Section("よく選ばれる犬種") {
                        ForEach(
                            OnboardingCatalog.dogBreedQuickPicks,
                            id: \.self,
                            content: breedButton
                        )
                    }
                }
                Section(query.isEmpty ? "すべての犬種" : "検索結果") {
                    ForEach(results, id: \.self, content: breedButton)
                }
            }
            .searchable(text: $query, prompt: "犬種名で検索")
            .navigationTitle("犬種を選ぶ")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { dismiss() }
                }
            }
        }
    }

    private func breedButton(_ breed: String) -> some View {
        Button {
            selection = breed
            dismiss()
        } label: {
            HStack {
                Text(breed)
                Spacer()
                if selection == breed {
                    Image(systemName: "checkmark")
                        .foregroundStyle(WanspotColors.primary)
                }
            }
        }
        .foregroundStyle(WanspotColors.textPrimary)
    }
}

private struct VaccineInput: View {
    let title: String
    @Binding var value: Bool?
    @Binding var date: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            HStack(spacing: 10) {
                vaccineButton(title: "済", selection: true)
                vaccineButton(title: "未", selection: false)
            }
            if value == true {
                if date != nil {
                    DatePicker(
                        "接種日（任意）",
                        selection: Binding(
                            get: { date ?? Date() },
                            set: { date = $0 }
                        ),
                        in: ...Date(),
                        displayedComponents: .date
                    )
                    .font(.caption)
                    Button("接種日を削除", role: .destructive) {
                        date = nil
                    }
                    .font(.caption)
                } else {
                    Button("接種日を追加（任意）") {
                        date = Date()
                    }
                    .font(.caption)
                }
            }
        }
    }

    private func vaccineButton(
        title: String,
        selection: Bool
    ) -> some View {
        Button(title) {
            value = selection
            if !selection {
                date = nil
            }
        }
        .font(.headline)
        .foregroundStyle(
            value == selection
                ? WanspotColors.primary
                : WanspotColors.textSecondary
        )
        .frame(maxWidth: .infinity)
        .frame(height: 44)
        .background(
            value == selection
                ? WanspotColors.tintWeak
                : WanspotColors.paper
        )
        .clipShape(.rect(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(
                    value == selection
                        ? WanspotColors.primary
                        : WanspotColors.border
                )
        }
    }
}

private extension View {
    func onboardingInputStyle() -> some View {
        padding(.horizontal, 14)
            .frame(minHeight: 50)
            .background(WanspotColors.input)
            .clipShape(.rect(cornerRadius: WanspotMetrics.fieldRadius))
            .overlay {
                RoundedRectangle(cornerRadius: WanspotMetrics.fieldRadius)
                    .stroke(WanspotColors.border)
            }
    }

    func walkAreaChip(isSelected: Bool) -> some View {
        font(.caption.weight(.semibold))
            .foregroundStyle(
                isSelected
                    ? WanspotColors.primary
                    : WanspotColors.textPrimary
            )
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                isSelected
                    ? WanspotColors.tintWeak
                    : WanspotColors.surface
            )
            .clipShape(.capsule)
            .overlay {
                Capsule().stroke(
                    isSelected
                        ? WanspotColors.primary
                        : WanspotColors.border
                )
            }
    }
}

private struct CameraImagePicker: UIViewControllerRepresentable {
    let onImage: (Data) -> Void
    let onCancel: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onImage: onImage, onCancel: onCancel)
    }

    func makeUIViewController(
        context: Context
    ) -> UIImagePickerController {
        let controller = UIImagePickerController()
        controller.sourceType = .camera
        controller.cameraCaptureMode = .photo
        controller.allowsEditing = true
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(
        _ uiViewController: UIImagePickerController,
        context: Context
    ) {}

    @MainActor
    final class Coordinator:
        NSObject,
        UINavigationControllerDelegate,
        UIImagePickerControllerDelegate
    {
        private let onImage: (Data) -> Void
        private let onCancel: () -> Void

        init(
            onImage: @escaping (Data) -> Void,
            onCancel: @escaping () -> Void
        ) {
            self.onImage = onImage
            self.onCancel = onCancel
        }

        func imagePickerControllerDidCancel(
            _ picker: UIImagePickerController
        ) {
            onCancel()
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info:
                [UIImagePickerController.InfoKey: Any]
        ) {
            let image =
                info[.editedImage] as? UIImage
                ?? info[.originalImage] as? UIImage
            guard let data = image?.jpegData(compressionQuality: 1) else {
                onCancel()
                return
            }
            onImage(data)
        }
    }
}

private struct FlowLayout: Layout {
    let spacing: CGFloat

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        layout(
            proposal: proposal,
            subviews: subviews,
            placeSubviews: false
        ).size
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        let result = layout(
            proposal: ProposedViewSize(
                width: bounds.width,
                height: proposal.height
            ),
            subviews: subviews,
            placeSubviews: true,
            origin: bounds.origin
        )
        for placement in result.placements {
            placement.subview.place(
                at: placement.position,
                proposal: .unspecified
            )
        }
    }

    private func layout(
        proposal: ProposedViewSize,
        subviews: Subviews,
        placeSubviews: Bool,
        origin: CGPoint = .zero
    ) -> (size: CGSize, placements: [Placement]) {
        let width = proposal.width ?? 320
        var x = origin.x
        var y = origin.y
        var rowHeight: CGFloat = 0
        var placements: [Placement] = []

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > origin.x, x + size.width > origin.x + width {
                x = origin.x
                y += rowHeight + spacing
                rowHeight = 0
            }
            if placeSubviews {
                placements.append(
                    Placement(
                        subview: subview,
                        position: CGPoint(x: x, y: y)
                    )
                )
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return (
            CGSize(width: width, height: y - origin.y + rowHeight),
            placements
        )
    }

    private struct Placement {
        let subview: LayoutSubview
        let position: CGPoint
    }
}
