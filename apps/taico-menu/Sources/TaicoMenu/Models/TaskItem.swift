import Foundation

struct TaskItem: Codable, Identifiable, Hashable {
  let id: String
  let name: String
  let description: String
  let status: TaskStatus
  let assignee: String?
  let assigneeActor: TaicoActor?
  let sessionId: String
  let tags: [TaicoTag]
  let createdByActor: TaicoActor?
  let dependsOnIds: [String]
  let createdAt: String
  let updatedAt: String

  var displayTitle: String {
    name.shortMenuTitle()
  }
}

struct TaskListResponse: Codable {
  let items: [TaskItem]
  let total: Int
  let page: Int
  let limit: Int
  let totalPages: Int
}
