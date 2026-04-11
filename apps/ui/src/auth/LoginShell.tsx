import React from "react";
import "./LoginPage.css";

export function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          {children}
        </div>
      </div>
    </div>
  )
}