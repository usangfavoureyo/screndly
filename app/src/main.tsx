import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./styles/globals.css";
import "./index.css";

// Prevent invalid token placeholders from lingering in storage.
if (typeof window !== 'undefined') {
  const TOKEN_KEY = 'screndly_auth_token';

  const startupToken = localStorage.getItem(TOKEN_KEY);
  if (startupToken === 'null' || startupToken === 'undefined' || startupToken === '[object Object]') {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function (...args: [string, string]) {
    const [key, value] = args;
    if (key === TOKEN_KEY && (value === 'null' || value === 'undefined' || value === '[object Object]' || !value)) {
      return;
    }
    return originalSetItem.apply(this, args);
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
