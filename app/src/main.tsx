import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./styles/globals.css";
import "./index.css";

// Prevent invalid token placeholders from lingering in storage.
if (typeof window !== 'undefined') {
  const OAUTH_CALLBACK_RESULT_KEY = 'screndly_oauth_callback_result';

  const TOKEN_KEY = 'screndly_auth_token';

  const persistedToken = localStorage.getItem(TOKEN_KEY);
  if (persistedToken && !sessionStorage.getItem(TOKEN_KEY)) {
    sessionStorage.setItem(TOKEN_KEY, persistedToken);
  }

  const startupToken = sessionStorage.getItem(TOKEN_KEY);
  if (startupToken === 'null' || startupToken === 'undefined' || startupToken === '[object Object]') {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  try {
    const pathname = window.location.pathname.replace(/\/+$/, '');
    const isOAuthCallbackPath = pathname === '/platforms/callback' || pathname === '/callback';

    if (isOAuthCallbackPath) {
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      if (search || hash) {
        const callbackSnapshot = JSON.stringify({
          search,
          hash,
          capturedAt: Date.now(),
        });
        sessionStorage.setItem(OAUTH_CALLBACK_RESULT_KEY, callbackSnapshot);
      }
    }
  } catch {
    sessionStorage.removeItem(OAUTH_CALLBACK_RESULT_KEY);
  }

  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function (...args: [string, string]) {
    const [key, value] = args;
    if (key === TOKEN_KEY && (value === 'null' || value === 'undefined' || value === '[object Object]' || !value)) {
      return;
    }
    return originalSetItem.apply(this, args);
  };

  const originalSessionSetItem = sessionStorage.setItem;
  sessionStorage.setItem = function (...args: [string, string]) {
    const [key, value] = args;
    if (key === TOKEN_KEY && (value === 'null' || value === 'undefined' || value === '[object Object]' || !value)) {
      return;
    }
    return originalSessionSetItem.apply(this, args);
  };
}

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  throw new Error('Root element not found');
}
