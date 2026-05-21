import Foundation

@MainActor
final class TaicoAppStore: ObservableObject {
  @Published private(set) var auth: AuthSession?
  @Published private(set) var tasks: [TaskItem] = []
  @Published private(set) var actors: [TaicoActor] = []
  @Published private(set) var tags: [TaicoTag] = []
  @Published private(set) var realtimeState: RealtimeState = .disconnected
  @Published private(set) var activityMessage: String?
  @Published var lastError: String?
  @Published var isBusy = false

  private let realtimeClient = SocketIOTasksClient()
  private var refreshLoopTask: Task<Void, Never>?
  private var cachedTasksByStatus: [TaskStatus: [TaskItem]] = [:]
  private var cachedTaskCounts: [TaskStatus: Int] = [:]

  var isAuthenticated: Bool {
    auth != nil
  }

  var inProgressCount: Int {
    cachedTaskCounts[.inProgress] ?? 0
  }

  var forReviewCount: Int {
    cachedTaskCounts[.forReview] ?? 0
  }

  func start() {
    guard auth == nil else { return }
    configureRealtimeClient()
    Task {
      do {
        if let session = try await loadStoredSession() {
          auth = session
          startRefreshLoop()
          if await reloadAll() {
            connectRealtime()
          }
        }
      } catch {
        lastError = error.localizedDescription
      }
    }
  }

  func signIn(baseURL: String, email: String, password: String) async {
    isBusy = true
    activityMessage = "Logging in..."
    lastError = nil
    configureRealtimeClient()
    do {
      let session = try await Task.detached(priority: .userInitiated) {
        try await TaicoAPIClient().login(baseURLString: baseURL, email: email, password: password)
      }.value
      activityMessage = "Saving session..."
      try await saveStoredSession(session)
      auth = session
      startRefreshLoop()
      isBusy = false
      Task {
        if await reloadAll() {
          connectRealtime()
        }
      }
    } catch {
      lastError = error.localizedDescription
      isBusy = false
      activityMessage = nil
    }
  }

  func signOut() async {
    let previousAuth = auth
    realtimeClient.stop()
    refreshLoopTask?.cancel()
    refreshLoopTask = nil
    tasks = []
    cachedTasksByStatus = [:]
    cachedTaskCounts = [:]
    actors = []
    tags = []
    auth = nil
    Task.detached(priority: .utility) {
      if let previousAuth {
        await TaicoAPIClient().logout(previousAuth)
      }
      try? SessionStore().clearSession()
    }
  }

  @discardableResult
  func reloadAll() async -> Bool {
    guard let auth = await validSession() else { return false }
    isBusy = true
    activityMessage = "Loading tasks..."
    lastError = nil
    do {
      let snapshot = try await Task.detached(priority: .userInitiated) {
        let client = TaicoAPIClient()
        async let taskResponse = client.listTasks(auth: auth)
        async let actorResponse = client.listActors(auth: auth)
        async let tagResponse = client.listTags(auth: auth)

        let tasks = try await taskResponse.items
        let actors = try await actorResponse.sorted {
          $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending
        }
        let tags = try await tagResponse.sorted {
          $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }

        return TaskSnapshot(tasks: tasks, actors: actors, tags: tags)
      }.value

      apply(snapshot)
      isBusy = false
      activityMessage = nil
      return true
    } catch {
      await handle(error)
    }
    isBusy = false
    activityMessage = nil
    return false
  }

  func tasks(for status: TaskStatus) -> [TaskItem] {
    cachedTasksByStatus[status] ?? []
  }

  func changeStatus(_ task: TaskItem, to status: TaskStatus) async {
    guard status != task.status, let auth = await validSession() else { return }
    await mutateTask {
      try await TaicoAPIClient().changeStatus(taskID: task.id, status: status, auth: auth)
    }
  }

  func assign(_ task: TaskItem, to actor: TaicoActor) async {
    guard task.assigneeActor?.id != actor.id, let auth = await validSession() else { return }
    await mutateTask {
      try await TaicoAPIClient().assign(taskID: task.id, to: actor.id, auth: auth)
    }
  }

  func toggleTag(_ tag: TaicoTag, on task: TaskItem) async {
    guard let auth = await validSession() else { return }
    let hasTag = task.tags.contains(where: { $0.id == tag.id })
    await mutateTask {
      let client = TaicoAPIClient()
      if hasTag {
        return try await client.removeTag(taskID: task.id, tag: tag, auth: auth)
      }
      return try await client.addTag(taskID: task.id, tag: tag, auth: auth)
    }
  }

  private func mutateTask(_ operation: @escaping () async throws -> TaskItem) async {
    isBusy = true
    activityMessage = "Updating task..."
    lastError = nil
    do {
      let updatedTask = try await Task.detached(priority: .userInitiated) {
        try await operation()
      }.value
      upsert(updatedTask)
    } catch {
      await handle(error)
    }
    isBusy = false
    activityMessage = nil
  }

  private func validSession() async -> AuthSession? {
    guard var current = auth else { return nil }
    if current.shouldRefreshSoon {
      do {
        let sessionToRefresh = current
        current = try await Task.detached(priority: .userInitiated) {
          try await TaicoAPIClient().refresh(sessionToRefresh)
        }.value
        try await saveStoredSession(current)
        auth = current
      } catch {
        await handle(error)
        return nil
      }
    }
    return current
  }


  private func connectRealtime() {
    guard let auth else { return }
    realtimeClient.connect(auth: auth)
  }

  private func configureRealtimeClient() {
    realtimeClient.onStateChange = { [weak self] state in
      Task { @MainActor in
        guard self?.realtimeState != state else { return }
        self?.realtimeState = state
      }
    }
    realtimeClient.onEvent = { [weak self] event in
      Task { @MainActor in
        switch event {
        case .upsert(let task):
          self?.upsert(task)
        case .delete(let id):
          self?.tasks.removeAll { $0.id == id }
          self?.rebuildTaskStatusCache()
        }
      }
    }
  }

  private func startRefreshLoop() {
    refreshLoopTask?.cancel()
    refreshLoopTask = Task { [weak self] in
      while !Task.isCancelled {
        try? await Task.sleep(nanoseconds: 60_000_000_000)
        await self?.refreshIfNeeded()
      }
    }
  }

  private func refreshIfNeeded() async {
    guard var current = auth, current.shouldRefreshSoon else { return }
    do {
      let sessionToRefresh = current
      current = try await Task.detached(priority: .userInitiated) {
        try await TaicoAPIClient().refresh(sessionToRefresh)
      }.value
      try await saveStoredSession(current)
      auth = current
      connectRealtime()
    } catch {
      await handle(error)
    }
  }

  private func handle(_ error: Error) async {
    if case TaicoAPIError.unauthorized = error {
      do {
        if let current = auth {
          let refreshed = try await Task.detached(priority: .userInitiated) {
            try await TaicoAPIClient().refresh(current)
          }.value
          try await saveStoredSession(refreshed)
          auth = refreshed
          connectRealtime()
          return
        }
      } catch {
        lastError = error.localizedDescription
        return
      }
    }
    lastError = error.localizedDescription
  }

  private func upsert(_ task: TaskItem) {
    if let index = tasks.firstIndex(where: { $0.id == task.id }) {
      tasks[index] = task
    } else {
      tasks.append(task)
    }
    rebuildTaskStatusCache()
  }

  private func setTasks(_ newTasks: [TaskItem]) {
    tasks = newTasks
    rebuildTaskStatusCache()
  }

  private func apply(_ snapshot: TaskSnapshot) {
    tasks = snapshot.tasks
    actors = snapshot.actors
    tags = snapshot.tags
    rebuildTaskStatusCache()
  }

  private func rebuildTaskStatusCache() {
    let groupedTasks = Dictionary(grouping: tasks, by: \.status)
    cachedTasksByStatus = groupedTasks.mapValues { items in
      items.sorted { $0.updatedAt > $1.updatedAt }
    }
    cachedTaskCounts = groupedTasks.mapValues(\.count)
  }

  private func loadStoredSession() async throws -> AuthSession? {
    try await Task.detached(priority: .utility) {
      try SessionStore().loadSession()
    }.value
  }

  private func saveStoredSession(_ session: AuthSession) async throws {
    try await Task.detached(priority: .utility) {
      try SessionStore().saveSession(session)
    }.value
  }
}

private struct TaskSnapshot {
  let tasks: [TaskItem]
  let actors: [TaicoActor]
  let tags: [TaicoTag]
}
