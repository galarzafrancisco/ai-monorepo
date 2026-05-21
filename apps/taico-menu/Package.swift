// swift-tools-version: 5.9

import PackageDescription

let package = Package(
  name: "TaicoMenu",
  platforms: [
    .macOS(.v13)
  ],
  products: [
    .executable(name: "TaicoMenu", targets: ["TaicoMenu"])
  ],
  targets: [
    .executableTarget(
      name: "TaicoMenu",
      path: "Sources/TaicoMenu"
    )
  ]
)
