import Foundation
import LocalAuthentication
import Security

enum KeychainStoreError: LocalizedError {
  case unexpectedStatus(OSStatus)
  case unavailable(OSStatus)

  var errorDescription: String? {
    switch self {
    case .unexpectedStatus(let status):
      return "Keychain returned status \(status)."
    case .unavailable(let status):
      return "Keychain session is not available without user interaction (\(status))."
    }
  }
}

final class KeychainStore {
  private let service = "com.taico.TaicoMenu"
  private let account = "auth-session"

  func loadSession() throws -> AuthSession? {
    var query = baseQuery()
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    addNonInteractiveAuthenticationContext(to: &query)

    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound {
      return nil
    }
    if status == errSecUserCanceled ||
      status == errSecInteractionNotAllowed ||
      status == errSecAuthFailed {
      throw KeychainStoreError.unavailable(status)
    }
    guard status == errSecSuccess else {
      throw KeychainStoreError.unexpectedStatus(status)
    }
    guard let data = result as? Data else {
      return nil
    }
    return try JSONDecoder().decode(AuthSession.self, from: data)
  }

  func saveSession(_ session: AuthSession) throws {
    let data = try JSONEncoder().encode(session)
    var query = baseQuery()
    addNonInteractiveAuthenticationContext(to: &query)
    let attributes: [String: Any] = [
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    ]

    let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    if status == errSecUserCanceled ||
      status == errSecInteractionNotAllowed ||
      status == errSecAuthFailed {
      throw KeychainStoreError.unavailable(status)
    }
    if status == errSecItemNotFound {
      query.merge(attributes) { _, new in new }
      let addStatus = SecItemAdd(query as CFDictionary, nil)
      guard addStatus == errSecSuccess else {
        throw KeychainStoreError.unexpectedStatus(addStatus)
      }
      return
    }
    guard status == errSecSuccess else {
      throw KeychainStoreError.unexpectedStatus(status)
    }
  }

  func clearSession() throws {
    var query = baseQuery()
    addNonInteractiveAuthenticationContext(to: &query)
    let status = SecItemDelete(query as CFDictionary)
    if status == errSecUserCanceled ||
      status == errSecInteractionNotAllowed ||
      status == errSecAuthFailed {
      return
    }
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw KeychainStoreError.unexpectedStatus(status)
    }
  }

  private func baseQuery() -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account
    ]
  }

  private func addNonInteractiveAuthenticationContext(to query: inout [String: Any]) {
    let context = LAContext()
    context.interactionNotAllowed = true
    query[kSecUseAuthenticationContext as String] = context
  }
}
