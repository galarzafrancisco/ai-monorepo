import Foundation

struct TaicoTag: Codable, Identifiable, Hashable {
  let id: String
  let name: String
  let color: String?
}
