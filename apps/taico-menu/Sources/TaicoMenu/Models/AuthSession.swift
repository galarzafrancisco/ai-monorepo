import Foundation

struct AuthSession: Codable, Equatable {
  var baseURL: URL
  var accessToken: String
  var refreshToken: String
  var expiresAt: Date
  var user: CurrentUser?

  var cookieHeader: String {
    "access_token=\(accessToken); refresh_token=\(refreshToken)"
  }

  var shouldRefreshSoon: Bool {
    expiresAt.timeIntervalSinceNow < 60
  }
}

struct LoginResponse: Codable {
  let user: CurrentUser
  let expiresIn: Int?
}

struct CurrentUser: Codable, Equatable {
  let id: String
  let email: String
  let displayName: String
  let role: String
  let actorId: String
  let onboardingDisplayMode: String?
}
