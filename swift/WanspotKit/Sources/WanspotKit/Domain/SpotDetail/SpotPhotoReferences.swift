import Foundation

/// 1スポットのギャラリー上限。`/api/spots/photo` の初回取得は
/// Google 課金なので、この枚数に比例する。
public enum SpotPhotoLimit {
    public static let galleryMaximum = 5
}

/// 詳細ギャラリーの表示順。先頭は必ず `photo_ref`（一覧サムネイル）にする。
public enum SpotPhotoReferences {
    public static func merge(
        primary: String?,
        additional: [String]...,
        maximumCount: Int = SpotPhotoLimit.galleryMaximum
    ) -> [String] {
        var seen = Set<String>()
        var photos: [String] = []

        func append(_ raw: String?) {
            let photo = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !photo.isEmpty, seen.insert(photo).inserted else {
                return
            }
            photos.append(photo)
        }

        append(primary)
        for group in additional {
            for photo in group {
                guard photos.count < maximumCount else {
                    return photos
                }
                append(photo)
            }
        }
        return Array(photos.prefix(max(0, maximumCount)))
    }
}
