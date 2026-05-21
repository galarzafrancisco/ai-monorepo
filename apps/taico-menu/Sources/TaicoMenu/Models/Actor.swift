import Foundation

struct TaicoActor: Codable, Identifiable, Hashable {
  let id: String
  let type: ActorType
  let slug: String
  let displayName: String
  let avatarUrl: String?
  let introduction: String?
}

enum ActorType: String, Codable {
  case human = "HUMAN"
  case agent = "AGENT"
  case unknown

  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    let value = try container.decode(String.self)
    self = ActorType(rawValue: value) ?? .unknown
  }
}
