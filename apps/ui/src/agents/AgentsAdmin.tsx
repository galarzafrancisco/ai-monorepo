export function AgentsAdmin() {
  return (
    <div className="agents-admin">
      <div className="agents-admin-header">
        <h2>Agents Admin</h2>
        <p>Manage your agents and settings</p>
      </div>

      <div className="agents-admin-content">
        <div className="agents-admin-section">
          <h3>Agent Configuration</h3>
          <div className="agents-admin-placeholder">
            <p>Agent configuration options will appear here</p>
          </div>
        </div>

        <div className="agents-admin-section">
          <h3>System Settings</h3>
          <div className="agents-admin-placeholder">
            <p>System settings will appear here</p>
          </div>
        </div>

        <div className="agents-admin-section">
          <h3>Usage Statistics</h3>
          <div className="agents-admin-placeholder">
            <p>Usage statistics will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
}
