// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "WanspotKit",
    platforms: [
        .iOS(.v26),
        .macOS(.v15),
    ],
    products: [
        .library(name: "WanspotKit", targets: ["WanspotKit"]),
    ],
    dependencies: [
        .package(
            url: "https://github.com/supabase/supabase-swift.git",
            exact: "2.55.1"
        ),
    ],
    targets: [
        .target(
            name: "WanspotKit",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift"),
            ],
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "WanspotKitTests",
            dependencies: ["WanspotKit"],
            resources: [.process("Fixtures")]
        ),
    ],
    swiftLanguageModes: [.v6]
)
