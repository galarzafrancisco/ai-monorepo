import Foundation

extension String {
  func shortMenuTitle(limit: Int = 30) -> String {
    guard count > limit else { return self }
    let end = index(startIndex, offsetBy: max(0, limit - 3))
    return String(self[..<end]) + "..."
  }
}
