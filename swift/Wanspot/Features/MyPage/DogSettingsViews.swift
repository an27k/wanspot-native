import AVFoundation
import PhotosUI
import SwiftUI
import UIKit
import WanspotKit

struct DogSettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(AppRouter.self) private var router
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section {
                HStack(spacing: 14) {
                    DogAvatarView(
                        photoURL: model.primaryDog?.photoURL,
                        size: 72
                    )
                    VStack(alignment: .leading, spacing: 4) {
                        Text(model.primaryDog?.name ?? "愛犬プロフィール")
                            .font(.headline)
                        Text(profileSummary)
                            .font(.subheadline)
                            .foregroundStyle(WanspotColors.textSecondary)
                    }
                }
                .padding(.vertical, 6)
            }

            Section("プロフィール") {
                destinationButton(
                    title: "名前・犬種・基本情報",
                    subtitle: "名前、犬種、サイズ、誕生日、性別",
                    systemImage: "pawprint.fill",
                    destination: .identity
                )
                destinationButton(
                    title: "プロフィール写真",
                    subtitle: "写真の追加・変更・削除",
                    systemImage: "camera.fill",
                    destination: .photo
                )
            }

            Section("健康") {
                destinationButton(
                    title: "ワクチン記録",
                    subtitle: "混合・狂犬病ワクチンの接種日",
                    systemImage: "syringe.fill",
                    destination: .vaccines
                )
            }

            if isLoading {
                Section {
                    ProgressView("愛犬情報を読み込み中…")
                }
            }
            if let errorMessage {
                Section {
                    Label(
                        errorMessage,
                        systemImage: "exclamationmark.triangle"
                    )
                    .foregroundStyle(WanspotColors.error)
                    Button("再試行") {
                        Task { await load() }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(WanspotColors.paper)
        .navigationTitle("愛犬設定")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            model.track(AppAnalyticsEvent(.dogSettingsViewed))
            await load()
        }
    }

    private var profileSummary: String {
        guard let dog = model.primaryDog else {
            return isLoading ? "読み込み中…" : "設定を確認してください"
        }
        return [dog.breed, dog.size?.displayName]
            .compactMap { $0 }
            .joined(separator: "・")
    }

    private func destinationButton(
        title: String,
        subtitle: String,
        systemImage: String,
        destination: DogSettingsDestination
    ) -> some View {
        Button {
            router.navigate(to: .editDog(destination))
        } label: {
            SettingsNavigationLabel(
                title: title,
                subtitle: subtitle,
                systemImage: systemImage
            )
        }
        .buttonStyle(.plain)
        .disabled(model.primaryDog == nil)
    }

    private func load() async {
        guard model.isAuthenticated else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            _ = try await model.refreshPrimaryDog()
            errorMessage = model.primaryDog == nil
                ? "愛犬プロフィールが見つかりません。"
                : nil
        } catch {
            errorMessage = "愛犬情報を読み込めませんでした。"
        }
    }
}

struct DogIdentityEditView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var form = DogProfileForm(
        name: "",
        breed: "",
        birthday: nil,
        gender: nil,
        size: nil
    )
    @State private var hasBirthday = false
    @State private var birthday = Date()
    @State private var showsBreedPicker = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var didLoad = false

    var body: some View {
        Form {
            Section("基本情報") {
                TextField("名前", text: $form.name)
                    .textContentType(.name)

                Button {
                    showsBreedPicker = true
                } label: {
                    LabeledContent(
                        "犬種",
                        value: form.breed.isEmpty ? "未設定" : form.breed
                    )
                }

                Picker("サイズ", selection: $form.size) {
                    Text("未設定").tag(nil as DogSize?)
                    ForEach(DogSize.allProfileCases, id: \.self) { size in
                        Text(size.displayName).tag(size as DogSize?)
                    }
                }

                Picker("性別", selection: $form.gender) {
                    Text("未設定").tag(nil as DogGender?)
                    Text("男の子").tag(DogGender.male as DogGender?)
                    Text("女の子").tag(DogGender.female as DogGender?)
                }
            }

            Section("誕生日") {
                Toggle("誕生日を設定", isOn: $hasBirthday)
                if hasBirthday {
                    DatePicker(
                        "日付",
                        selection: $birthday,
                        in: birthdayRange,
                        displayedComponents: .date
                    )
                }
            }

            if let errorMessage {
                Section {
                    Label(
                        errorMessage,
                        systemImage: "exclamationmark.triangle"
                    )
                    .foregroundStyle(WanspotColors.error)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(WanspotColors.paper)
        .navigationTitle("基本情報")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(isSaving ? "保存中…" : "保存") {
                    Task { await save() }
                }
                .disabled(isSaving || form.name.trimmingCharacters(
                    in: .whitespacesAndNewlines
                ).isEmpty)
            }
        }
        .sheet(isPresented: $showsBreedPicker) {
            DogBreedSelectionView(selection: $form.breed)
        }
        .task {
            await initialize()
        }
    }

    private var birthdayRange: ClosedRange<Date> {
        let calendar = Calendar.autoupdatingCurrent
        let lower = calendar.date(
            byAdding: .year,
            value: -35,
            to: Date()
        ) ?? Date.distantPast
        return lower ... Date()
    }

    private func initialize() async {
        guard !didLoad else { return }
        didLoad = true
        if model.primaryDog == nil {
            _ = try? await model.refreshPrimaryDog()
        }
        guard let dog = model.primaryDog else {
            errorMessage = "愛犬プロフィールが見つかりません。"
            return
        }
        form = DogProfileForm(profile: dog)
        if let date = dog.birthday.flatMap(profileDate) {
            hasBirthday = true
            birthday = date
        }
    }

    private func save() async {
        guard !isSaving else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        form.birthday = hasBirthday ? profileDateKey(birthday) : nil
        do {
            let submission = try form.validated()
            try await model.updateDogIdentity(submission)
            model.track(AppAnalyticsEvent(.dogProfileUpdated))
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct DogPhotoEditView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var photoItem: PhotosPickerItem?
    @State private var selectedJPEG: Data?
    @State private var isRemoved = false
    @State private var showsOptions = false
    @State private var showsLibrary = false
    @State private var showsCamera = false
    @State private var showsCameraPermissionAlert = false
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                photoPreview
                Button("写真を選ぶ") {
                    showsOptions = true
                }
                .buttonStyle(.borderedProminent)
                .tint(WanspotColors.primary)

                if model.primaryDog?.photoURL != nil || selectedJPEG != nil {
                    Button("写真を削除", role: .destructive) {
                        selectedJPEG = nil
                        isRemoved = true
                    }
                }

                Text(
                    "正方形に切り抜いてプロフィール写真として保存します。"
                )
                .font(.caption)
                .foregroundStyle(WanspotColors.textSecondary)

                if let errorMessage {
                    Label(
                        errorMessage,
                        systemImage: "exclamationmark.triangle"
                    )
                    .foregroundStyle(WanspotColors.error)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(WanspotMetrics.pagePadding)
        }
        .background(WanspotColors.paper)
        .navigationTitle("プロフィール写真")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(isSaving ? "保存中…" : "保存") {
                    Task { await save() }
                }
                .disabled(isSaving || !hasChanges)
            }
        }
        .confirmationDialog(
            "写真を選択",
            isPresented: $showsOptions,
            titleVisibility: .visible
        ) {
            Button("カメラで撮影") { openCamera() }
            Button("ライブラリから選択") { showsLibrary = true }
            Button("キャンセル", role: .cancel) {}
        }
        .photosPicker(
            isPresented: $showsLibrary,
            selection: $photoItem,
            matching: .images
        )
        .fullScreenCover(isPresented: $showsCamera) {
            DogCameraImagePicker { data in
                showsCamera = false
                acceptPhoto(data)
            } onCancel: {
                showsCamera = false
            }
            .ignoresSafeArea()
        }
        .alert(
            "カメラへのアクセスが必要です",
            isPresented: $showsCameraPermissionAlert
        ) {
            Button("設定を開く") {
                guard
                    let url = URL(string: UIApplication.openSettingsURLString)
                else {
                    return
                }
                UIApplication.shared.open(url)
            }
            Button("キャンセル", role: .cancel) {}
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task {
                guard let data = try? await item.loadTransferable(
                    type: Data.self
                ) else {
                    errorMessage = "写真を読み込めませんでした。"
                    return
                }
                acceptPhoto(data)
            }
        }
        .task {
            if model.primaryDog == nil {
                _ = try? await model.refreshPrimaryDog()
            }
        }
    }

    private var hasChanges: Bool {
        selectedJPEG != nil || isRemoved
    }

    private var photoPreview: some View {
        ZStack {
            Circle()
                .fill(WanspotColors.tintWeak)
            if isRemoved {
                Image(systemName: "pawprint.fill")
                    .font(.system(size: 58))
                    .foregroundStyle(WanspotColors.primary)
            } else if
                let selectedJPEG,
                let image = UIImage(data: selectedJPEG)
            {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else if let url = model.primaryDog?.photoURL {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    ProgressView()
                }
            } else {
                Image(systemName: "camera.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(WanspotColors.primary)
            }
        }
        .frame(width: 180, height: 180)
        .clipShape(.circle)
        .overlay {
            Circle().stroke(WanspotColors.border)
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

    private func acceptPhoto(_ data: Data) {
        guard let jpeg = squareDogProfileJPEG(data) else {
            errorMessage = "写真を読み込めませんでした。"
            return
        }
        selectedJPEG = jpeg
        isRemoved = false
        errorMessage = nil
    }

    private func save() async {
        guard !isSaving, hasChanges else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await model.updateDogPhoto(
                jpegData: isRemoved ? nil : selectedJPEG
            )
            model.track(
                AppAnalyticsEvent(
                    .dogPhotoUpdated,
                    properties: [
                        "removed": .bool(isRemoved),
                    ]
                )
            )
            dismiss()
        } catch {
            errorMessage = "写真を保存できませんでした。"
        }
    }
}

struct DogVaccinesEditView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var mixedEnabled = false
    @State private var mixedDate = Date()
    @State private var rabiesEnabled = false
    @State private var rabiesDate = Date()
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var didLoad = false

    var body: some View {
        Form {
            vaccineSection(
                title: "混合ワクチン",
                isEnabled: $mixedEnabled,
                date: $mixedDate
            )
            vaccineSection(
                title: "狂犬病ワクチン",
                isEnabled: $rabiesEnabled,
                date: $rabiesDate
            )

            if let errorMessage {
                Section {
                    Label(
                        errorMessage,
                        systemImage: "exclamationmark.triangle"
                    )
                    .foregroundStyle(WanspotColors.error)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(WanspotColors.paper)
        .navigationTitle("ワクチン記録")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(isSaving ? "保存中…" : "保存") {
                    Task { await save() }
                }
                .disabled(isSaving)
            }
        }
        .task {
            await initialize()
        }
    }

    private func vaccineSection(
        title: String,
        isEnabled: Binding<Bool>,
        date: Binding<Date>
    ) -> some View {
        Section(title) {
            Toggle("接種日を登録", isOn: isEnabled)
            if isEnabled.wrappedValue {
                DatePicker(
                    "接種日",
                    selection: date,
                    in: ...Date(),
                    displayedComponents: .date
                )
            }
        }
    }

    private func initialize() async {
        guard !didLoad else { return }
        didLoad = true
        if model.primaryDog == nil {
            _ = try? await model.refreshPrimaryDog()
        }
        guard let dog = model.primaryDog else {
            errorMessage = "愛犬プロフィールが見つかりません。"
            return
        }
        if let date = dog.vaccineVaccinatedAt.flatMap(profileDate) {
            mixedEnabled = true
            mixedDate = date
        }
        if let date = dog.rabiesVaccinatedAt.flatMap(profileDate) {
            rabiesEnabled = true
            rabiesDate = date
        }
    }

    private func save() async {
        guard !isSaving else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await model.updateDogVaccination(
                kind: .mixed,
                vaccinatedAt: mixedEnabled
                    ? profileDateKey(mixedDate)
                    : nil
            )
            try await model.updateDogVaccination(
                kind: .rabies,
                vaccinatedAt: rabiesEnabled
                    ? profileDateKey(rabiesDate)
                    : nil
            )
            model.track(AppAnalyticsEvent(.dogVaccinesUpdated))
            dismiss()
        } catch {
            errorMessage = "ワクチン記録を保存できませんでした。"
        }
    }
}

struct WalkAreaEditView: View {
    @Environment(AppModel.self) private var model
    @Environment(LocationSession.self) private var locationSession
    @Environment(\.dismiss) private var dismiss
    @State private var selected: [String] = []
    @State private var query = ""
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var errorMessage: String?

    private var candidates: [WalkAreaCatalogEntry] {
        let rows: [WalkAreaCatalogEntry]
        if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            rows = OnboardingCatalog.searchWalkAreas(query)
        } else if let coordinate = locationSession.location?.coordinate {
            rows = OnboardingCatalog.suggestedWalkAreas(
                latitude: coordinate.latitude,
                longitude: coordinate.longitude
            )
        } else {
            rows = []
        }
        return rows.filter { !selected.contains($0.label) }
    }

    var body: some View {
        List {
            Section {
                if selected.isEmpty {
                    Text("散歩エリアを1つ以上追加してください。")
                        .foregroundStyle(WanspotColors.textSecondary)
                } else {
                    ForEach(selected, id: \.self) { tag in
                        HStack {
                            Label(tag, systemImage: "mappin")
                            Spacer()
                            Button {
                                selected.removeAll { $0 == tag }
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(
                                        WanspotColors.textSecondary
                                    )
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(tag)を削除")
                        }
                    }
                }
            } header: {
                Text(
                    "選択中 \(selected.count)/"
                        + "\(OnboardingCatalog.maximumWalkAreaTags)"
                )
            }

            if query.isEmpty, locationSession.location == nil {
                Section {
                    Button {
                        locationSession.requestCurrentLocation()
                    } label: {
                        Label(
                            locationSession.isLocating
                                ? "現在地を取得中…"
                                : "現在地周辺の候補を表示",
                            systemImage: "location.fill"
                        )
                    }
                    .disabled(locationSession.isLocating)
                    Text("または上の検索欄に公園・駅・地域名を入力してください。")
                        .font(.caption)
                        .foregroundStyle(WanspotColors.textSecondary)
                }
            }

            Section(query.isEmpty ? "周辺の候補" : "検索結果") {
                if candidates.isEmpty {
                    Text(
                        query.isEmpty
                            ? "候補を表示するには現在地を使うか検索してください。"
                            : "該当するエリアがありません。"
                    )
                    .foregroundStyle(WanspotColors.textSecondary)
                } else {
                    ForEach(candidates) { entry in
                        Button {
                            guard
                                selected.count
                                    < OnboardingCatalog.maximumWalkAreaTags
                            else {
                                return
                            }
                            selected.append(entry.label)
                        } label: {
                            HStack {
                                Text(entry.label)
                                    .foregroundStyle(
                                        WanspotColors.textPrimary
                                    )
                                Spacer()
                                Image(systemName: "plus.circle")
                            }
                        }
                        .disabled(
                            selected.count
                                >= OnboardingCatalog.maximumWalkAreaTags
                        )
                    }
                }
            }

            if isLoading {
                Section {
                    ProgressView("散歩エリアを読み込み中…")
                }
            }
            if let errorMessage {
                Section {
                    Label(
                        errorMessage,
                        systemImage: "exclamationmark.triangle"
                    )
                    .foregroundStyle(WanspotColors.error)
                }
            }
        }
        .searchable(text: $query, prompt: "公園・駅・地域名で検索")
        .scrollContentBackground(.hidden)
        .background(WanspotColors.paper)
        .navigationTitle("散歩エリア")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(isSaving ? "保存中…" : "保存") {
                    Task { await save() }
                }
                .disabled(isSaving || selected.isEmpty)
            }
        }
        .task {
            await load()
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            selected = try await model.fetchWalkAreaTags()
            errorMessage = nil
        } catch {
            errorMessage = "散歩エリアを読み込めませんでした。"
        }
    }

    private func save() async {
        guard !isSaving, !selected.isEmpty else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await model.updateWalkAreaTags(selected)
            model.track(
                AppAnalyticsEvent(
                    .walkAreasUpdated,
                    properties: [
                        "count": .integer(selected.count),
                    ]
                )
            )
            dismiss()
        } catch {
            errorMessage = "散歩エリアを保存できませんでした。"
        }
    }
}

private struct DogBreedSelectionView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var selection: String
    @State private var query = ""

    private var results: [String] {
        OnboardingCatalog.filterDogBreeds(query)
    }

    var body: some View {
        NavigationStack {
            List {
                Button("未設定にする", role: .destructive) {
                    selection = ""
                    dismiss()
                }
                ForEach(results, id: \.self) { breed in
                    Button {
                        selection = breed
                        dismiss()
                    } label: {
                        HStack {
                            Text(breed)
                                .foregroundStyle(WanspotColors.textPrimary)
                            Spacer()
                            if selection == breed {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
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
}

private struct DogCameraImagePicker: UIViewControllerRepresentable {
    let onImage: (Data) -> Void
    let onCancel: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onImage: onImage, onCancel: onCancel)
    }

    func makeUIViewController(
        context: Context
    ) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.cameraCaptureMode = .photo
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(
        _ uiViewController: UIImagePickerController,
        context: Context
    ) {}

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

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [
                UIImagePickerController.InfoKey: Any
            ]
        ) {
            guard
                let image = info[.originalImage] as? UIImage,
                let data = image.jpegData(compressionQuality: 0.9)
            else {
                onCancel()
                return
            }
            onImage(data)
        }

        func imagePickerControllerDidCancel(
            _ picker: UIImagePickerController
        ) {
            onCancel()
        }
    }
}

@MainActor
private func squareDogProfileJPEG(_ data: Data) -> Data? {
    guard
        let image = UIImage(data: data),
        image.size.width > 0,
        image.size.height > 0
    else {
        return nil
    }
    let targetSide = 600.0
    let scale = max(
        targetSide / image.size.width,
        targetSide / image.size.height
    )
    let size = CGSize(
        width: image.size.width * scale,
        height: image.size.height * scale
    )
    let origin = CGPoint(
        x: (targetSide - size.width) / 2,
        y: (targetSide - size.height) / 2
    )
    let renderer = UIGraphicsImageRenderer(
        size: CGSize(width: targetSide, height: targetSide)
    )
    return renderer.image { _ in
        image.draw(in: CGRect(origin: origin, size: size))
    }.jpegData(compressionQuality: 0.8)
}

private func profileDate(_ value: String) -> Date? {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = .autoupdatingCurrent
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.isLenient = false
    return formatter.date(from: value)
}

private func profileDateKey(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = .autoupdatingCurrent
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
}

private extension DogSize {
    static let allProfileCases: [DogSize] = [
        .extraSmall,
        .small,
        .medium,
        .large,
        .extraLarge,
    ]
}
