import Foundation
import Observation
import UIKit
import WanspotKit

enum OnboardingStep {
    case dog
    case location
    case area
    case ready
}

@MainActor
@Observable
final class OnboardingStore {
    var step = OnboardingStep.dog
    var name = ""
    var breed = ""
    var size: DogSize?
    var birthday: Date?
    var mixedVaccine: Bool?
    var rabiesVaccine: Bool?
    var mixedVaccineDate: Date?
    var rabiesVaccineDate: Date?
    var walkTimeHour: Int?
    var walkTimeWasPicked = false
    var photoURL: URL?
    var photoPreviewData: Data?
    var walkAreaTags: [String] = []
    var isBusy = false
    var isUploadingPhoto = false
    var errorMessage: String?

    private var hasRestored = false

    var dogLabel: String {
        OnboardingDomain.dogLabel(name)
    }

    var canContinueDog: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !breed.isEmpty
            && size != nil
            && !isBusy
            && !isUploadingPhoto
    }

    var draft: OnboardingDogDraft {
        OnboardingDogDraft(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            breed: breed,
            size: size,
            birthday: birthday.map { OnboardingDomain.dateKey($0) },
            photoURL: photoURL,
            mixedVaccine: mixedVaccine,
            rabiesVaccine: rabiesVaccine,
            mixedVaccineDate: mixedVaccine == true
                ? mixedVaccineDate.map { OnboardingDomain.dateKey($0) }
                : nil,
            rabiesVaccineDate: rabiesVaccine == true
                ? rabiesVaccineDate.map { OnboardingDomain.dateKey($0) }
                : nil
        )
    }

    func restore(from draft: OnboardingDogDraft?) {
        guard !hasRestored else { return }
        hasRestored = true
        guard let draft else { return }
        name = draft.name
        breed = draft.breed
        size = draft.size
        birthday = draft.birthday.flatMap(parseDateKey)
        photoURL = draft.photoURL
        mixedVaccine = draft.mixedVaccine
        rabiesVaccine = draft.rabiesVaccine
        mixedVaccineDate = draft.mixedVaccineDate.flatMap(parseDateKey)
        rabiesVaccineDate = draft.rabiesVaccineDate.flatMap(parseDateKey)
    }

    func continueFromDog(appModel: AppModel) {
        guard canContinueDog else { return }
        appModel.saveOnboardingDraft(
            draft,
            walkTimeWasPicked: walkTimeWasPicked,
            walkTimeHour: walkTimeHour
        )
        step = .location
    }

    func uploadPhoto(data: Data, appModel: AppModel) async {
        guard !isUploadingPhoto else { return }
        isUploadingPhoto = true
        errorMessage = nil
        defer { isUploadingPhoto = false }

        guard let jpegData = squareJPEG(data) else {
            errorMessage = "写真を読み込めませんでした"
            photoPreviewData = nil
            return
        }
        photoPreviewData = jpegData
        do {
            photoURL = try await appModel.uploadDogPhoto(jpegData)
            appModel.saveOnboardingDraft(
                draft,
                walkTimeWasPicked: walkTimeWasPicked,
                walkTimeHour: walkTimeHour
            )
        } catch {
            photoPreviewData = nil
            photoURL = nil
            errorMessage = "写真のアップロードに失敗しました"
        }
    }

    func complete(
        appModel: AppModel,
        walkAreaTags: [String]
    ) async {
        guard !isBusy else { return }
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do {
            try await appModel.completeOnboarding(
                draft: draft,
                walkAreaTags: walkAreaTags
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private func parseDateKey(_ value: String) -> Date? {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = .autoupdatingCurrent
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.date(from: value)
}

@MainActor
private func squareJPEG(_ data: Data) -> Data? {
    guard let image = UIImage(data: data), image.size.width > 0,
        image.size.height > 0
    else {
        return nil
    }
    let targetSide = 600.0
    let scale = max(
        targetSide / image.size.width,
        targetSide / image.size.height
    )
    let drawSize = CGSize(
        width: image.size.width * scale,
        height: image.size.height * scale
    )
    let drawOrigin = CGPoint(
        x: (targetSide - drawSize.width) / 2,
        y: (targetSide - drawSize.height) / 2
    )
    let renderer = UIGraphicsImageRenderer(
        size: CGSize(width: targetSide, height: targetSide)
    )
    let output = renderer.image { _ in
        image.draw(in: CGRect(origin: drawOrigin, size: drawSize))
    }
    return output.jpegData(compressionQuality: 0.8)
}
