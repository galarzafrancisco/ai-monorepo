import SwiftUI

struct TaicoMenuView: View {
  @ObservedObject var store: TaicoAppStore
  @Environment(\.openWindow) private var openWindow

  var body: some View {
    Group {
      if store.isAuthenticated {
        authenticatedMenu
      } else {
        unauthenticatedMenu
      }
    }
    .task {
      store.start()
    }
  }

  private var authenticatedMenu: some View {
    Group {
      Button("Refresh") {
        Task { await store.reloadAll() }
      }

      Section("tasks") {
        ForEach(TaskStatus.allCases) { status in
          StatusTaskMenu(status: status, store: store)
        }
      }

      Divider()

      Text(store.activityMessage ?? statusText)

      if let lastError = store.lastError {
        Text(lastError.shortMenuTitle())
      }

      Button("Sign Out") {
        Task { await store.signOut() }
      }

      Button("Quit") {
        NSApplication.shared.terminate(nil)
      }
    }
  }

  private var unauthenticatedMenu: some View {
    Group {
      Button("Sign In...") {
        openWindow(id: "sign-in")
        NSApp.activate(ignoringOtherApps: true)
      }

      if let lastError = store.lastError {
        Text(lastError.shortMenuTitle())
      }

      Button("Quit") {
        NSApplication.shared.terminate(nil)
      }
    }
  }

  private var statusText: String {
    switch store.realtimeState {
    case .connected:
      return "live"
    case .connecting:
      return "connecting"
    case .disconnected:
      return "offline"
    }
  }
}

private struct StatusTaskMenu: View {
  private let visibleTaskLimit = 40

  let status: TaskStatus
  @ObservedObject var store: TaicoAppStore

  var body: some View {
    let items = store.tasks(for: status)
    let visibleItems = Array(items.prefix(visibleTaskLimit))
    Menu("\(status.displayName) (\(items.count))") {
      if items.isEmpty {
        Text("No tasks")
      } else {
        ForEach(visibleItems) { task in
          TaskMenu(task: task, store: store)
        }

        if items.count > visibleTaskLimit {
          Divider()
          Text("Showing \(visibleTaskLimit) of \(items.count)")
        }
      }
    }
  }
}

private struct TaskMenu: View {
  let task: TaskItem
  @ObservedObject var store: TaicoAppStore

  var body: some View {
    Menu(task.displayTitle) {
      Text(task.description.shortMenuTitle())

      Menu("Move To") {
        ForEach(TaskStatus.allCases) { status in
          Button {
            Task { await store.changeStatus(task, to: status) }
          } label: {
            Label(status.displayName, systemImage: status == task.status ? "checkmark" : "circle")
          }
          .disabled(status == task.status)
        }
      }

      Menu("Assignee: \(assigneeName.shortMenuTitle(limit: 18))") {
        if store.actors.isEmpty {
          Text("No actors")
        } else {
          ForEach(store.actors) { actor in
            Button {
              Task { await store.assign(task, to: actor) }
            } label: {
              Label(actor.displayName.shortMenuTitle(), systemImage: actor.id == task.assigneeActor?.id ? "checkmark" : actorIcon(actor))
            }
            .disabled(actor.id == task.assigneeActor?.id)
          }
        }
      }

      Menu("Tags") {
        if store.tags.isEmpty {
          Text("No tags")
        } else {
          ForEach(store.tags) { tag in
            Button {
              Task { await store.toggleTag(tag, on: task) }
            } label: {
              Label(tag.name.shortMenuTitle(), systemImage: hasTag(tag) ? "checkmark" : "tag")
            }
          }
        }
      }
    }
  }

  private var assigneeName: String {
    task.assigneeActor?.displayName ?? task.assignee ?? "Unassigned"
  }

  private func hasTag(_ tag: TaicoTag) -> Bool {
    task.tags.contains { $0.id == tag.id }
  }

  private func actorIcon(_ actor: TaicoActor) -> String {
    actor.type == .agent ? "cpu" : "person"
  }
}
