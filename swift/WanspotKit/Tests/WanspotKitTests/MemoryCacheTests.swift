import Foundation
import XCTest

@testable import WanspotKit

final class MemoryCacheTests: XCTestCase {
    func testFreshValueIsReturnedWithoutFetching() async throws {
        let cache = MemoryCache()
        let fetchedAt = Date(timeIntervalSince1970: 1_000)
        await cache.write("cached", for: "spot:1", fetchedAt: fetchedAt)

        let result: CacheFetchResult<String> = try await cache.fetch(
            "spot:1",
            ttl: 60,
            now: fetchedAt.addingTimeInterval(59)
        ) {
            XCTFail("A fresh cache entry must not execute the operation")
            return "network"
        }

        XCTAssertEqual(result.value, "cached")
        XCTAssertTrue(result.isFromCache)
    }

    func testExpiredValueIsRefetched() async throws {
        let cache = MemoryCache()
        let fetchedAt = Date(timeIntervalSince1970: 1_000)
        await cache.write("old", for: "spot:1", fetchedAt: fetchedAt)

        let result: CacheFetchResult<String> = try await cache.fetch(
            "spot:1",
            ttl: 60,
            now: fetchedAt.addingTimeInterval(60)
        ) {
            "new"
        }

        XCTAssertEqual(result.value, "new")
        XCTAssertFalse(result.isFromCache)
    }

    func testOptionalNilCanBeCached() async {
        let cache = MemoryCache()
        let value: String? = nil
        await cache.write(value, for: "walk-line:none")

        let lookup: CacheLookup<String?> = await cache.lookup(
            "walk-line:none",
            as: String?.self
        )
        switch lookup {
        case let .hit(cached):
            XCTAssertNil(cached)
        case .missing:
            XCTFail("Cached nil must be distinguishable from a missing key")
        }
    }

    func testConcurrentFetchesShareOneOperation() async throws {
        let cache = MemoryCache()
        let counter = InvocationCounter()

        async let first: CacheFetchResult<String> = cache.fetch(
            "shared",
            ttl: 60
        ) {
            await counter.increment()
            try await Task.sleep(for: .milliseconds(50))
            return "value"
        }
        async let second: CacheFetchResult<String> = cache.fetch(
            "shared",
            ttl: 60
        ) {
            await counter.increment()
            return "other"
        }

        let results = try await [first, second]
        XCTAssertEqual(Set(results.map(\.value)).count, 1)
        let invocationCount = await counter.value
        XCTAssertEqual(invocationCount, 1)
    }

    func testPrefixInvalidationOnlyRemovesMatchingEntries() async {
        let cache = MemoryCache()
        await cache.write(1, for: "nearby:a")
        await cache.write(2, for: "nearby:b")
        await cache.write(3, for: "articles:a")

        await cache.invalidate(prefix: "nearby:")

        let nearby: CacheLookup<Int> = await cache.lookup("nearby:a")
        let articles: CacheLookup<Int> = await cache.lookup("articles:a")
        if case .hit = nearby {
            XCTFail("Matching entry should be invalidated")
        }
        if case let .hit(value) = articles {
            XCTAssertEqual(value, 3)
        } else {
            XCTFail("Unrelated entry should remain")
        }
    }

    func testGeoBucketMatchesTypeScriptFormatting() {
        XCTAssertEqual(
            geoBucket(latitude: 35.681236, longitude: 139.767125),
            "35.681,139.767"
        )
        XCTAssertEqual(
            geoBucket(latitude: 35.681236, longitude: 139.767125, decimals: 1),
            "35.7,139.8"
        )
    }
}

private actor InvocationCounter {
    private(set) var value = 0

    func increment() {
        value += 1
    }
}
