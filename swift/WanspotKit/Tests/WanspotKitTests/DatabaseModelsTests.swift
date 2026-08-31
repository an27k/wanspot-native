import Foundation
import XCTest

@testable import WanspotKit

final class DatabaseModelsTests: XCTestCase {
    func testDecodesProfileAndDogRows() throws {
        let user = try decode(
            UserProfile.self,
            """
            {
              "id": "user-1",
              "name": "飼い主",
              "parent_type": "papa",
              "birthday": null,
              "bio": "モカと暮らしています",
              "photo_url": null,
              "walk_area": null,
              "walk_area_tags": ["代々木公園", "中目黒"]
            }
            """
        )
        XCTAssertEqual(user.walkAreaTags, ["代々木公園", "中目黒"])

        let dog = try decode(
            DogProfile.self,
            """
            {
              "id": "dog-1",
              "user_id": "user-1",
              "name": "モカ",
              "breed": "トイ・プードル",
              "birthday": "2022-04-01",
              "gender": "female",
              "size": "S",
              "rabies_vaccinated_at": "2026-05-01",
              "vaccine_vaccinated_at": null,
              "photo_url": "https://example.com/moka.jpg",
              "rabies_vaccinated": true,
              "vaccine_vaccinated": false,
              "walk_area_tags": ["代々木公園"],
              "is_primary": true
            }
            """
        )
        XCTAssertEqual(dog.gender, .female)
        XCTAssertEqual(dog.size, .small)
        XCTAssertEqual(dog.photoURL?.absoluteString, "https://example.com/moka.jpg")
    }

    func testDecodesVisitAndMemoryRowsWithoutDateCoercion() throws {
        let visit = try decode(
            Visit.self,
            """
            {
              "id": "visit-1",
              "user_id": "user-1",
              "spot_id": null,
              "visited_at": "2026-08-19T03:04:05.123456+00:00",
              "comment": null,
              "rating": 5,
              "context": "walk",
              "mood": "happy",
              "source": "other",
              "soft_deleted": false,
              "created_at": "2026-08-19T03:04:05.123456+00:00"
            }
            """
        )
        XCTAssertEqual(visit.context, .walk)
        XCTAssertEqual(visit.visitedAt, "2026-08-19T03:04:05.123456+00:00")

        let memory = try decode(
            Memory.self,
            """
            {
              "id": "memory-1",
              "user_id": "user-1",
              "visit_id": "visit-1",
              "spot_id": null,
              "media_url": "user-1/photo.jpg",
              "media_type": "image",
              "thumbnail_url": null,
              "soft_deleted": false,
              "created_at": "2026-08-19T03:04:05+00:00"
            }
            """
        )
        XCTAssertEqual(memory.mediaType, .image)
        XCTAssertEqual(memory.mediaPath, "user-1/photo.jpg")
    }

    func testUserEventAddsGuestPrivacyContext() throws {
        let event = UserEvent(
            eventType: .mapView,
            anonymousID: "anonymous-123456789",
            properties: ["radius": .integer(3_000)]
        )

        let data = try JSONEncoder().encode(event)
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
        let properties = try XCTUnwrap(json["props"] as? [String: Any])
        XCTAssertEqual(json["event_type"] as? String, "map_view")
        XCTAssertNil(json["user_id"])
        XCTAssertEqual(
            properties["anonymous_id"] as? String,
            "anonymous-123456789"
        )
        XCTAssertEqual(properties["is_guest"] as? Bool, true)
    }

    func testDecodesDogPhotoAndBuildsLocalDateKey() throws {
        let photo = try decode(
            DogPhoto.self,
            """
            {
              "id": "photo-1",
              "user_id": "user-1",
              "image_url": "https://example.com/dog.jpg",
              "storage_path": "user-1/2026-08-19-photo.jpg",
              "taken_on": "2026-08-19",
              "created_at": "2026-08-19T03:04:05+00:00"
            }
            """
        )
        XCTAssertEqual(photo.takenOn, "2026-08-19")
        XCTAssertEqual(photo.storagePath, "user-1/2026-08-19-photo.jpg")

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Tokyo")!
        let date = try XCTUnwrap(
            ISO8601DateFormatter().date(from: "2026-08-18T15:30:00Z")
        )
        XCTAssertEqual(
            dogPhotoDateKey(date, calendar: calendar),
            "2026-08-19"
        )
    }

    func testDecodesPlaceResultWireShape() throws {
        let place = try decode(
            PlaceResult.self,
            """
            {
              "place_id": "place-1",
              "name": "ワンカフェ",
              "category": "カフェ",
              "lat": 35.68,
              "lng": 139.76,
              "address": "東京都",
              "photo_ref": "photo-ref",
              "rating": 4.5,
              "user_ratings_total": 120,
              "price_level": 2,
              "opening_hours": {
                "periods": [
                  {
                    "open": { "day": 1, "time": "0900" },
                    "close": { "day": 1, "time": "1800" }
                  }
                ]
              }
            }
            """
        )

        XCTAssertEqual(place.placeID, "place-1")
        XCTAssertEqual(place.userRatingsTotal, 120)
        XCTAssertEqual(
            place.openingHours?.periods?.first?.open?.time,
            "0900"
        )
    }

    private func decode<Value: Decodable>(
        _ type: Value.Type,
        _ json: String
    ) throws -> Value {
        try JSONDecoder().decode(type, from: Data(json.utf8))
    }
}
