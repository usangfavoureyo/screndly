import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./styles/globals.css";
import "./index.css";

// ==========================================
// ABSOLUTE TRUTH AUTH MONITOR (PHASE 4)
// ==========================================
if (typeof window !== 'undefined') {
  const TOKEN_KEY = 'screndly_auth_token';
  const VERSION = '1.0.1-auth-debug-phase-5-final';

  // 1. Startup Fix: Nuke poison strings immediately
  const startupToken = localStorage.getItem(TOKEN_KEY);
  if (startupToken === 'null' || startupToken === 'undefined' || startupToken === '[object Object]') {
    console.warn(`[System v${VERSION}] POISON TOKEN DETECTED ON STARTUP: "${startupToken}". Nuking storage.`);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  // 2. Runtime Monitor: Intercept all localStorage.setItem calls
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function (key, value) {
    if (key === TOKEN_KEY) {
      if (value === 'null' || value === 'undefined' || value === '[object Object]' || !value) {
        console.error(`[System v${VERSION}] !!! SECURITY ALERT !!! Something tried to set ${key} to POISON VALUE: "${value}"`);
        console.trace('[System] Trace to find the poisoner:');
        // Prevent setting the poison string
        return;
      }
      console.warn(`[System v${VERSION}] Token updated to version: ${String(value).substring(0, 10)}... (Len: ${String(value).length})`);
    }
    return originalSetItem.apply(this, arguments as any);
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
