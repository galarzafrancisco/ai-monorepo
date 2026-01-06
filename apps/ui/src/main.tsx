import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import './index.css'
import './styles/sidebar.css';
import './agents/Agents.css';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="app-shell">
      <App />
    </div>
  </StrictMode>
);
