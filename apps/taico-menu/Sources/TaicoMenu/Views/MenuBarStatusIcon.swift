import SwiftUI

struct MenuBarStatusIcon: View {
  let inProgressCount: Int
  let forReviewCount: Int
  let isActive: Bool

  var body: some View {
    Text("☑ \(displayCount(inProgressCount)) / \(displayCount(forReviewCount))")
      .font(.system(size: 12, weight: isActive ? .bold : .semibold, design: .rounded))
      .monospacedDigit()
    .lineLimit(1)
    .fixedSize()
    .help("Taico tasks: in progress / for review")
  }

  private func displayCount(_ count: Int) -> String {
    count > 99 ? "99+" : "\(count)"
  }
}
