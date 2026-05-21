import Foundation

extension URL {
  func appendingAPIPath(_ path: String) -> URL {
    let normalizedBase = absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let normalizedPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    return URL(string: "\(normalizedBase)/api/v1/\(normalizedPath)")!
  }

  func socketIOWebSocketURL() -> URL {
    var components = URLComponents(url: self, resolvingAgainstBaseURL: false)!
    components.scheme = scheme == "https" ? "wss" : "ws"
    components.path = "/socket.io/"
    components.queryItems = [
      URLQueryItem(name: "EIO", value: "4"),
      URLQueryItem(name: "transport", value: "websocket")
    ]
    return components.url!
  }
}
