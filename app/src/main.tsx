import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./styles/globals.css";
import "./index.css";

// Prevent invalid token placeholders from lingering in storage.
if (typeof window !== 'undefined') {
  console.log('[DEBUG] main.tsx start');

  window.addEventListener('error', (e) => {
    console.log('[DEBUG GLOBAL ERROR]', e.message, e.filename, e.lineno, e.colno, e.error);
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.log('[DEBUG UNHANDLED REJECTION]', e.reason);
  });

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

console.log('[DEBUG] Calling createRoot');
const rootElement = document.getElementById("root");
console.log('[DEBUG] rootElement:', rootElement);

if (rootElement) {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('[DEBUG] createRoot.render called');
  } catch (err) {
    console.error('[DEBUG] createRoot failed:', err);
  }
} else {
  console.error('[DEBUG] ROOT ELEMENT NOT FOUND!');
}
