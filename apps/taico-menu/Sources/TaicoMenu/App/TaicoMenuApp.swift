import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {
  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.accessory)
  }
}

@main
struct TaicoMenuApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
  @StateObject private var store = TaicoAppStore()

  var body: some Scene {
    MenuBarExtra {
      TaicoMenuView(store: store)
    } label: {
      MenuBarStatusIcon(
        inProgressCount: store.inProgressCount,
        forReviewCount: store.forReviewCount,
        isActive: store.inProgressCount > 0 || store.realtimeState == .connecting
      )
    }
    .menuBarExtraStyle(.menu)

    Window("Taico Sign In", id: "sign-in") {
      SignInView(store: store)
    }
    .defaultSize(width: 460, height: 260)
  }
}
