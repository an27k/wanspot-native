import Foundation
import Supabase

public struct OwnerProfileInput: Equatable, Sendable {
    public let id: String
    public let name: String
    public let parentType: String
    public let birthday: String?
    public let bio: String?
    public let photoURL: URL?
    public let walkAreaTags: [String]

    public init(
        id: String,
        name: String,
        parentType: String,
        birthday: String?,
        bio: String?,
        photoURL: URL? = nil,
        walkAreaTags: [String]
    ) {
        self.id = id
        self.name = name
        self.parentType = parentType
        self.birthday = birthday
        self.bio = bio
        self.photoURL = photoURL
        self.walkAreaTags = walkAreaTags
    }
}

public struct DogProfileInput: Equatable, Sendable {
    public let userID: String
    public let name: String
    public let breed: String?
    public let birthday: String?
    public let gender: DogGender?
    public let size: DogSize?
    public let photoURL: URL?
    public let rabiesVaccinated: Bool
    public let vaccineVaccinated: Bool
    public let rabiesVaccinatedAt: String?
    public let vaccineVaccinatedAt: String?
    public let walkAreaTags: [String]
    public let isPrimary: Bool

    public init(
        userID: String,
        name: String,
        breed: String?,
        birthday: String?,
        gender: DogGender?,
        size: DogSize?,
        photoURL: URL?,
        rabiesVaccinated: Bool,
        vaccineVaccinated: Bool,
        rabiesVaccinatedAt: String?,
        vaccineVaccinatedAt: String?,
        walkAreaTags: [String],
        isPrimary: Bool = true
    ) {
        self.userID = userID
        self.name = name
        self.breed = breed
        self.birthday = birthday
        self.gender = gender
        self.size = size
        self.photoURL = photoURL
        self.rabiesVaccinated = rabiesVaccinated
        self.vaccineVaccinated = vaccineVaccinated
        self.rabiesVaccinatedAt = rabiesVaccinatedAt
        self.vaccineVaccinatedAt = vaccineVaccinatedAt
        self.walkAreaTags = walkAreaTags
        self.isPrimary = isPrimary
    }
}

public enum DogVaccineKind: Sendable {
    case rabies
    case mixed
}

public struct SupabaseProfileRepository: Sendable {
    private static let userColumns =
        "id, name, parent_type, birthday, bio, photo_url, walk_area_tags"
    private static let legacyUserColumns =
        "id, name, parent_type, birthday, bio, photo_url, walk_area"

    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func fetchUserProfile(userID: String) async throws -> UserProfile? {
        do {
            return try await fetchUserProfile(
                userID: userID,
                columns: Self.userColumns
            )
        } catch where isMissingWalkAreaTagsColumn(error) {
            return try await fetchUserProfile(
                userID: userID,
                columns: Self.legacyUserColumns
            )
        }
    }

    public func fetchPrimaryDog(userID: String) async throws -> DogProfile? {
        let rows: [DogProfile] = try await client
            .from("dogs")
            .select()
            .eq("user_id", value: userID)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    public func updateOwnerNameIfEmpty(
        userID: String,
        displayName: String
    ) async throws {
        struct NameRow: Decodable {
            let name: String?
        }

        let displayName = displayName
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !displayName.isEmpty else { return }
        let rows: [NameRow] = try await client
            .from("users")
            .select("name")
            .eq("id", value: userID)
            .limit(1)
            .execute()
            .value
        let currentName = rows.first?.name?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard currentName.isEmpty else { return }
        try await client
            .from("users")
            .update(["name": JSONValue.string(displayName)])
            .eq("id", value: userID)
            .execute()
    }

    public func fetchWalkAreaTags(userID: String) async throws -> [String] {
        if let user = try await fetchUserProfile(userID: userID) {
            let tags = normalizeWalkAreaTags(
                user.walkAreaTags,
                legacyValue: user.walkArea
            )
            if !tags.isEmpty {
                return tags
            }
        }
        let dog = try await fetchPrimaryDog(userID: userID)
        return normalizeWalkAreaTags(dog?.walkAreaTags, legacyValue: nil)
    }

    public func upsertOwner(_ input: OwnerProfileInput) async throws {
        let tags = normalizedTags(input.walkAreaTags)
        var payload = ownerPayload(input, includeNilPhoto: false)
        payload["walk_area_tags"] = .array(tags.map(JSONValue.string))

        do {
            try await client.from("users").upsert(payload).execute()
        } catch where isMissingWalkAreaTagsColumn(error) {
            var legacyPayload = ownerPayload(input, includeNilPhoto: false)
            legacyPayload["walk_area"] = legacyWalkAreaValue(tags)
            try await client.from("users").upsert(legacyPayload).execute()
        }
    }

    public func updateOwner(_ input: OwnerProfileInput) async throws {
        let tags = normalizedTags(input.walkAreaTags)
        var payload = ownerPayload(input, includeNilPhoto: true)
        payload.removeValue(forKey: "id")
        payload["walk_area_tags"] = .array(tags.map(JSONValue.string))

        do {
            try await client
                .from("users")
                .update(payload)
                .eq("id", value: input.id)
                .execute()
        } catch where isMissingWalkAreaTagsColumn(error) {
            var legacyPayload = ownerPayload(input, includeNilPhoto: true)
            legacyPayload.removeValue(forKey: "id")
            legacyPayload["walk_area"] = legacyWalkAreaValue(tags)
            try await client
                .from("users")
                .update(legacyPayload)
                .eq("id", value: input.id)
                .execute()
        }
    }

    public func updateWalkAreaTags(
        userID: String,
        tags: [String]
    ) async throws {
        let tags = normalizedTags(tags)
        do {
            try await client
                .from("users")
                .update([
                    "walk_area_tags": JSONValue.array(tags.map(JSONValue.string)),
                ])
                .eq("id", value: userID)
                .execute()
        } catch where isMissingWalkAreaTagsColumn(error) {
            try await client
                .from("users")
                .update(["walk_area": legacyWalkAreaValue(tags)])
                .eq("id", value: userID)
                .execute()
        }
    }

    public func insertDog(_ input: DogProfileInput) async throws {
        var payload = dogPayload(input)
        payload["walk_area_tags"] = .array(
            normalizedTags(input.walkAreaTags).map(JSONValue.string)
        )
        payload["is_primary"] = .bool(input.isPrimary)

        do {
            try await client.from("dogs").insert(payload).execute()
        } catch where isMissingDogExtensionColumn(error) {
            payload.removeValue(forKey: "walk_area_tags")
            payload.removeValue(forKey: "is_primary")
            try await client.from("dogs").insert(payload).execute()
        }
    }

    public func updateDogIdentity(
        dogID: String,
        name: String,
        breed: String?,
        birthday: String?,
        gender: DogGender?,
        size: DogSize?,
        photoURL: URL?
    ) async throws {
        try await client
            .from("dogs")
            .update([
                "name": .string(name.trimmingCharacters(in: .whitespacesAndNewlines)),
                "breed": nullableString(breed),
                "birthday": nullableString(birthday),
                "gender": nullableString(gender?.rawValue),
                "size": nullableString(size?.rawValue),
                "photo_url": nullableString(photoURL?.absoluteString),
            ])
            .eq("id", value: dogID)
            .execute()
    }

    public func updateDogVaccination(
        dogID: String,
        kind: DogVaccineKind,
        vaccinatedAt: String?
    ) async throws {
        let column = switch kind {
        case .rabies:
            "rabies_vaccinated_at"
        case .mixed:
            "vaccine_vaccinated_at"
        }
        try await client
            .from("dogs")
            .update([
                column: nullableString(vaccinatedAt),
            ])
            .eq("id", value: dogID)
            .execute()
    }

    public func uploadDogPhoto(
        userID: String,
        jpegData: Data,
        fileID: UUID = UUID()
    ) async throws -> URL {
        let path = "\(userID)/dog-\(fileID.uuidString.lowercased()).jpg"
        _ = try await client.storage
            .from("avatars")
            .upload(
                path,
                data: jpegData,
                options: FileOptions(
                    contentType: "image/jpeg",
                    upsert: false
                )
            )
        return try client.storage.from("avatars").getPublicURL(path: path)
    }

    private func fetchUserProfile(
        userID: String,
        columns: String
    ) async throws -> UserProfile? {
        let rows: [UserProfile] = try await client
            .from("users")
            .select(columns)
            .eq("id", value: userID)
            .limit(1)
            .execute()
            .value
        return rows.first
    }
}

private func ownerPayload(
    _ input: OwnerProfileInput,
    includeNilPhoto: Bool
) -> [String: JSONValue] {
    var payload: [String: JSONValue] = [
        "id": .string(input.id),
        "name": .string(input.name),
        "parent_type": .string(input.parentType),
        "birthday": nullableString(input.birthday),
        "bio": nullableString(input.bio),
    ]
    if includeNilPhoto || input.photoURL != nil {
        payload["photo_url"] = nullableString(input.photoURL?.absoluteString)
    }
    return payload
}

private func dogPayload(_ input: DogProfileInput) -> [String: JSONValue] {
    [
        "user_id": .string(input.userID),
        "name": .string(input.name),
        "breed": nullableString(input.breed),
        "birthday": nullableString(input.birthday),
        "gender": nullableString(input.gender?.rawValue),
        "size": nullableString(input.size?.rawValue),
        "photo_url": nullableString(input.photoURL?.absoluteString),
        "rabies_vaccinated": .bool(input.rabiesVaccinated),
        "vaccine_vaccinated": .bool(input.vaccineVaccinated),
        "rabies_vaccinated_at": nullableString(input.rabiesVaccinatedAt),
        "vaccine_vaccinated_at": nullableString(input.vaccineVaccinatedAt),
    ]
}

private func nullableString(_ value: String?) -> JSONValue {
    value.map(JSONValue.string) ?? .null
}

private func normalizedTags(_ tags: [String]) -> [String] {
    var seen = Set<String>()
    var result: [String] = []
    for tag in tags {
        let value = tag.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, seen.insert(value).inserted else { continue }
        result.append(value)
        if result.count == 8 { break }
    }
    return result
}

private func normalizeWalkAreaTags(
    _ tags: [String]?,
    legacyValue: String?
) -> [String] {
    let tags = normalizedTags(tags ?? [])
    guard tags.isEmpty, let legacyValue else { return tags }
    let value = legacyValue.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !value.isEmpty else { return [] }

    if
        value.hasPrefix("["),
        let data = value.data(using: .utf8),
        let decoded = try? JSONDecoder().decode([String].self, from: data)
    {
        return normalizedTags(decoded)
    }
    if value.hasPrefix("{"), value.hasSuffix("}") {
        return normalizedTags(
            value.dropFirst().dropLast().split(separator: ",").map {
                String($0)
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .trimmingCharacters(in: CharacterSet(charactersIn: "\""))
            }
        )
    }
    return [value]
}

private func legacyWalkAreaValue(_ tags: [String]) -> JSONValue {
    guard !tags.isEmpty else { return .null }
    guard
        let data = try? JSONEncoder().encode(tags),
        let string = String(data: data, encoding: .utf8)
    else {
        return .null
    }
    return .string(string)
}

private func isMissingWalkAreaTagsColumn(_ error: Error) -> Bool {
    let postgrestError = error as? PostgrestError
    let message = postgrestError?.message ?? error.localizedDescription
    return message.contains("walk_area_tags")
        && (
            message.contains("schema cache")
                || message.contains("Could not find")
                || postgrestError?.code == "PGRST204"
        )
}

private func isMissingDogExtensionColumn(_ error: Error) -> Bool {
    let message = (error as? PostgrestError)?.message
        ?? error.localizedDescription
    return message.contains("walk_area_tags") || message.contains("is_primary")
}
