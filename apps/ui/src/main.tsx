import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import './styles/sidebar.css';
import './agents/Agents.css';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
