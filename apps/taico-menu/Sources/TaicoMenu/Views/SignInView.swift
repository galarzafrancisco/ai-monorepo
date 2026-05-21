import SwiftUI

struct SignInView: View {
  @ObservedObject var store: TaicoAppStore
  @Environment(\.dismiss) private var dismiss
  @State private var serverURL = UserDefaults.standard.string(forKey: "TaicoMenu.serverURL") ?? "http://localhost:2003"
  @State private var email = ""
  @State private var password = ""

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text("Taico Sign In")
        .font(.title2)
        .fontWeight(.semibold)

      Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 10) {
        GridRow {
          Text("Server")
            .foregroundStyle(.secondary)
          TextField("http://localhost:2003", text: $serverURL)
            .textFieldStyle(.roundedBorder)
        }

        GridRow {
          Text("Email")
            .foregroundStyle(.secondary)
          TextField("you@example.com", text: $email)
            .textFieldStyle(.roundedBorder)
        }

        GridRow {
          Text("Password")
            .foregroundStyle(.secondary)
          SecureField("Password", text: $password)
            .textFieldStyle(.roundedBorder)
        }
      }

      if let lastError = store.lastError {
        Text(lastError)
          .foregroundStyle(.red)
          .font(.callout)
          .lineLimit(3)
      }

      HStack {
        if let activityMessage = store.activityMessage {
          ProgressView()
            .controlSize(.small)
          Text(activityMessage)
            .font(.callout)
            .foregroundStyle(.secondary)
        }

        Spacer()

        Button("Sign In") {
          UserDefaults.standard.set(serverURL, forKey: "TaicoMenu.serverURL")
          Task {
            await store.signIn(baseURL: serverURL, email: email, password: password)
          }
        }
        .keyboardShortcut(.defaultAction)
        .disabled(store.isBusy || serverURL.isEmpty || email.isEmpty || password.isEmpty)
      }
    }
    .padding(20)
    .frame(minWidth: 420, idealWidth: 460)
    .disabled(store.isBusy)
    .onChange(of: store.isAuthenticated) { isAuthenticated in
      if isAuthenticated {
        dismiss()
      }
    }
  }
}
