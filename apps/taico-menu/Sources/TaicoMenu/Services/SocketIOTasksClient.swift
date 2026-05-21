import Foundation

enum TaskRealtimeEvent {
  case upsert(TaskItem)
  case delete(String)
}

final class SocketIOTasksClient {
  private let decoder = JSONDecoder()
  private var task: URLSessionWebSocketTask?
  private var receiveTask: Task<Void, Never>?
  private var stopped = false
  private var reconnectAttempt = 0

  var onEvent: ((TaskRealtimeEvent) -> Void)?
  var onStateChange: ((RealtimeState) -> Void)?

  func connect(auth: AuthSession) {
    stop()
    stopped = false
    open(auth: auth)
  }

  private func open(auth: AuthSession) {
    onStateChange?(.connecting)

    var request = URLRequest(url: auth.baseURL.socketIOWebSocketURL())
    request.setValue(auth.cookieHeader, forHTTPHeaderField: "Cookie")
    request.setValue("Bearer \(auth.accessToken)", forHTTPHeaderField: "Authorization")

    let socket = URLSession.shared.webSocketTask(with: request)
    task = socket
    socket.resume()

    receiveTask = Task { [weak self] in
      await self?.receiveLoop(auth: auth)
    }
  }

  func stop() {
    stopped = true
    receiveTask?.cancel()
    receiveTask = nil
    task?.cancel(with: .goingAway, reason: nil)
    task = nil
    onStateChange?(.disconnected)
  }

  private func receiveLoop(auth: AuthSession) async {
    while !stopped, let task {
      do {
        let message = try await task.receive()
        switch message {
        case .string(let text):
          try await handle(text)
        case .data:
          break
        @unknown default:
          break
        }
      } catch {
        if !stopped {
          onStateChange?(.disconnected)
          reconnectAttempt += 1
          let delaySeconds = min(30, max(3, reconnectAttempt * 5))
          try? await Task.sleep(nanoseconds: UInt64(delaySeconds) * 1_000_000_000)
          if !stopped {
            open(auth: auth)
          }
        }
        return
      }
    }
  }

  private func handle(_ text: String) async throws {
    if text == "2" {
      try await send("3")
      return
    }

    if text.hasPrefix("0") {
      try await send("40/tasks,")
      return
    }

    if text.hasPrefix("40/tasks") {
      reconnectAttempt = 0
      onStateChange?(.connected)
      try await send("42/tasks,[\"tasks.subscribe\"]")
      return
    }

    guard text.hasPrefix("42/tasks,") else {
      return
    }

    let payloadText = String(text.dropFirst("42/tasks,".count))
    guard let data = payloadText.data(using: .utf8),
          let array = try JSONSerialization.jsonObject(with: data) as? [Any],
          let eventName = array.first as? String else {
      return
    }

    switch eventName {
    case "task.created", "task.updated", "task.assigned", "task.status_changed":
      guard array.count > 1 else { return }
      let eventData = try JSONSerialization.data(withJSONObject: array[1])
      let event = try decoder.decode(TaskEnvelope.self, from: eventData)
      onEvent?(.upsert(event.payload))
    case "task.deleted":
      guard array.count > 1 else { return }
      let eventData = try JSONSerialization.data(withJSONObject: array[1])
      let event = try decoder.decode(TaskDeletedEnvelope.self, from: eventData)
      onEvent?(.delete(event.payload.taskId))
    default:
      return
    }
  }

  private func send(_ text: String) async throws {
    try await task?.send(.string(text))
  }
}

private struct TaskEnvelope: Codable {
  let payload: TaskItem
}

private struct TaskDeletedEnvelope: Codable {
  let payload: DeletedPayload
}

private struct DeletedPayload: Codable {
  let taskId: String
}

enum RealtimeState: String {
  case disconnected
  case connecting
  case connected
}
