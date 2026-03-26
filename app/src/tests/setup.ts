// ============================================================================
// TEST SETUP
// ============================================================================
// Global test configuration and utilities

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';

beforeAll(() => {
  global.WebSocket = vi.fn(() => ({
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1,
  })) as any;

  global.IntersectionObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })) as any;

  global.ResizeObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })) as any;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    writable: true,
    value: {
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(true),
      open: vi.fn().mockResolvedValue({
        keys: vi.fn().mockResolvedValue([]),
        match: vi.fn().mockResolvedValue(undefined),
      }),
    },
  });

  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    writable: true,
    value: {
      controller: null,
      register: vi.fn().mockResolvedValue({
        scope: '/',
        installing: null,
        update: vi.fn(),
        addEventListener: vi.fn(),
      }),
      getRegistration: vi.fn().mockResolvedValue(null),
      getRegistrations: vi.fn().mockResolvedValue([]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });

  Object.defineProperty(window.navigator, 'vibrate', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });

  Object.defineProperty(window, 'Notification', {
    configurable: true,
    writable: true,
    value: {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    },
  });

  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });

  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  }

  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn();
  }
});

// Suppress console errors in tests (optional)
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  global.fetch = vi.fn() as any;
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
