import Foundation

final class SessionStore {
  private let keychain = KeychainStore()
  private let fileStore = FileSessionStore()

  func loadSession() throws -> AuthSession? {
    if let fileSession = try fileStore.loadSession() {
      return fileSession
    }

    do {
      return try keychain.loadSession()
    } catch KeychainStoreError.unavailable {
      return nil
    }
  }

  func saveSession(_ session: AuthSession) throws {
    try fileStore.saveSession(session)
    do {
      try keychain.saveSession(session)
    } catch KeychainStoreError.unavailable {
      return
    }
  }

  func clearSession() throws {
    try fileStore.clearSession()
    try? keychain.clearSession()
  }
}

private final class FileSessionStore {
  private let fileManager = FileManager.default
  private let encoder = JSONEncoder()
  private let decoder = JSONDecoder()

  func loadSession() throws -> AuthSession? {
    let url = try sessionURL()
    guard fileManager.fileExists(atPath: url.path) else {
      return nil
    }
    let data = try Data(contentsOf: url)
    return try decoder.decode(AuthSession.self, from: data)
  }

  func saveSession(_ session: AuthSession) throws {
    let url = try sessionURL()
    try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    let data = try encoder.encode(session)
    fileManager.createFile(atPath: url.path, contents: data, attributes: [
      .posixPermissions: 0o600
    ])
  }

  func clearSession() throws {
    let url = try sessionURL()
    if fileManager.fileExists(atPath: url.path) {
      try fileManager.removeItem(at: url)
    }
  }

  private func sessionURL() throws -> URL {
    let base = try fileManager.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    return base.appendingPathComponent("TaicoMenu", isDirectory: true).appendingPathComponent("auth-session.json")
  }
}
