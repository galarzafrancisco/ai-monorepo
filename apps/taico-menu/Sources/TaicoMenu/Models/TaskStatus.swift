import Foundation

enum TaskStatus: String, Codable, CaseIterable, Identifiable {
  case notStarted = "NOT_STARTED"
  case inProgress = "IN_PROGRESS"
  case forReview = "FOR_REVIEW"
  case done = "DONE"

  var id: String { rawValue }

  var displayName: String {
    switch self {
    case .notStarted:
      return "not started"
    case .inProgress:
      return "in progress"
    case .forReview:
      return "for review"
    case .done:
      return "done"
    }
  }
}
