import Foundation

enum AuthCookieParser {
  static func session(
    from response: HTTPURLResponse,
    baseURL: URL,
    fallback: AuthSession? = nil,
    body: LoginResponse
  ) throws -> AuthSession {
    let headers = response.allHeaderFields.reduce(into: [String: String]()) { result, entry in
      guard let key = entry.key as? String else { return }
      result[key] = String(describing: entry.value)
    }
    let cookies = HTTPCookie.cookies(withResponseHeaderFields: headers, for: baseURL)
    let accessToken = cookies.first(where: { $0.name == "access_token" })?.value ?? fallback?.accessToken
    let refreshToken = cookies.first(where: { $0.name == "refresh_token" })?.value ?? fallback?.refreshToken

    guard let accessToken, let refreshToken else {
      throw TaicoAPIError.missingAuthCookies
    }

    let expiresIn = body.expiresIn ?? 900
    return AuthSession(
      baseURL: baseURL,
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresAt: Date().addingTimeInterval(TimeInterval(expiresIn)),
      user: body.user
    )
  }
}
