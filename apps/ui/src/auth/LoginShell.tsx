import React from "react";
import { COPYRIGHT_NOTICE } from "../shared/const/brand";
import "./LoginPage.css";

export function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          {children}
        </div>
      </div>
      <footer className="login-footer">{COPYRIGHT_NOTICE}</footer>
    </div>
  )
}