import Foundation

enum TaicoAPIError: LocalizedError {
  case invalidBaseURL
  case missingAuthCookies
  case invalidResponse
  case unauthorized
  case server(status: Int, message: String)

  var errorDescription: String? {
    switch self {
    case .invalidBaseURL:
      return "The Taico server URL is invalid."
    case .missingAuthCookies:
      return "Taico did not return access and refresh cookies."
    case .invalidResponse:
      return "Taico returned an invalid response."
    case .unauthorized:
      return "The Taico session is no longer authorized."
    case .server(let status, let message):
      return "Taico returned \(status): \(message)"
    }
  }
}

final class TaicoAPIClient {
  private let session: URLSession
  private let decoder = JSONDecoder()
  private let encoder = JSONEncoder()

  init() {
    let configuration = URLSessionConfiguration.default
    configuration.httpShouldSetCookies = false
    configuration.httpCookieAcceptPolicy = .never
    self.session = URLSession(configuration: configuration)
  }

  func login(baseURLString: String, email: String, password: String) async throws -> AuthSession {
    guard let baseURL = URL(string: baseURLString.trimmingCharacters(in: .whitespacesAndNewlines)) else {
      throw TaicoAPIError.invalidBaseURL
    }
    let request = try jsonRequest(
      url: baseURL.appendingAPIPath("auth/login"),
      method: "POST",
      body: ["email": email, "password": password],
      auth: nil
    )
    let (data, response) = try await session.data(for: request)
    let http = try validate(response: response, data: data)
    let body = try decoder.decode(LoginResponse.self, from: data)
    return try AuthCookieParser.session(from: http, baseURL: baseURL, body: body)
  }

  func refresh(_ auth: AuthSession) async throws -> AuthSession {
    var request = URLRequest(url: auth.baseURL.appendingAPIPath("auth/refresh"))
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("refresh_token=\(auth.refreshToken)", forHTTPHeaderField: "Cookie")

    let (data, response) = try await session.data(for: request)
    let http = try validate(response: response, data: data)
    let body = try decoder.decode(LoginResponse.self, from: data)
    return try AuthCookieParser.session(from: http, baseURL: auth.baseURL, fallback: auth, body: body)
  }

  func logout(_ auth: AuthSession) async {
    var request = URLRequest(url: auth.baseURL.appendingAPIPath("auth/logout"))
    request.httpMethod = "POST"
    request.setValue(auth.cookieHeader, forHTTPHeaderField: "Cookie")
    _ = try? await session.data(for: request)
  }

  func listTasks(auth: AuthSession) async throws -> TaskListResponse {
    try await get("tasks/tasks?limit=200", auth: auth)
  }

  func listActors(auth: AuthSession) async throws -> [TaicoActor] {
    try await get("actors", auth: auth)
  }

  func listTags(auth: AuthSession) async throws -> [TaicoTag] {
    try await get("meta/tags", auth: auth)
  }

  func changeStatus(taskID: String, status: TaskStatus, auth: AuthSession) async throws -> TaskItem {
    try await patch("tasks/tasks/\(taskID)/status", body: ["status": status.rawValue], auth: auth)
  }

  func assign(taskID: String, to actorID: String, auth: AuthSession) async throws -> TaskItem {
    try await patch("tasks/tasks/\(taskID)/assign", body: ["assigneeActorId": actorID], auth: auth)
  }

  func addTag(taskID: String, tag: TaicoTag, auth: AuthSession) async throws -> TaskItem {
    try await post("tasks/tasks/\(taskID)/tags", body: ["name": tag.name], auth: auth)
  }

  func removeTag(taskID: String, tag: TaicoTag, auth: AuthSession) async throws -> TaskItem {
    let encodedTagID = tag.id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? tag.id
    return try await delete("tasks/tasks/\(taskID)/tags/\(encodedTagID)", auth: auth)
  }

  private func get<T: Decodable>(_ path: String, auth: AuthSession) async throws -> T {
    var request = URLRequest(url: auth.baseURL.appendingAPIPath(path))
    request.httpMethod = "GET"
    addAuth(auth, to: &request)
    let (data, response) = try await session.data(for: request)
    _ = try validate(response: response, data: data)
    return try decoder.decode(T.self, from: data)
  }

  private func post<T: Decodable, Body: Encodable>(_ path: String, body: Body, auth: AuthSession) async throws -> T {
    let request = try jsonRequest(url: auth.baseURL.appendingAPIPath(path), method: "POST", body: body, auth: auth)
    let (data, response) = try await session.data(for: request)
    _ = try validate(response: response, data: data)
    return try decoder.decode(T.self, from: data)
  }

  private func patch<T: Decodable, Body: Encodable>(_ path: String, body: Body, auth: AuthSession) async throws -> T {
    let request = try jsonRequest(url: auth.baseURL.appendingAPIPath(path), method: "PATCH", body: body, auth: auth)
    let (data, response) = try await session.data(for: request)
    _ = try validate(response: response, data: data)
    return try decoder.decode(T.self, from: data)
  }

  private func delete<T: Decodable>(_ path: String, auth: AuthSession) async throws -> T {
    var request = URLRequest(url: auth.baseURL.appendingAPIPath(path))
    request.httpMethod = "DELETE"
    addAuth(auth, to: &request)
    let (data, response) = try await session.data(for: request)
    _ = try validate(response: response, data: data)
    return try decoder.decode(T.self, from: data)
  }

  private func jsonRequest<Body: Encodable>(
    url: URL,
    method: String,
    body: Body,
    auth: AuthSession?
  ) throws -> URLRequest {
    var request = URLRequest(url: url)
    request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.httpBody = try encoder.encode(body)
    if let auth {
      addAuth(auth, to: &request)
    }
    return request
  }

  private func addAuth(_ auth: AuthSession, to request: inout URLRequest) {
    request.setValue(auth.cookieHeader, forHTTPHeaderField: "Cookie")
    request.setValue("Bearer \(auth.accessToken)", forHTTPHeaderField: "Authorization")
  }

  private func validate(response: URLResponse, data: Data) throws -> HTTPURLResponse {
    guard let http = response as? HTTPURLResponse else {
      throw TaicoAPIError.invalidResponse
    }
    if http.statusCode == 401 {
      throw TaicoAPIError.unauthorized
    }
    guard (200..<300).contains(http.statusCode) else {
      let message = String(data: data, encoding: .utf8) ?? "No response body"
      throw TaicoAPIError.server(status: http.statusCode, message: message)
    }
    return http
  }
}
