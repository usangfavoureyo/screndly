// PWA Service Worker Registration and Utilities

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const BUILD_ID_STORAGE_KEY = 'screndly_build_id';
const SERVICE_WORKER_URL = `/sw.js?build=${encodeURIComponent(__APP_BUILD_ID__)}`;

async function syncInstalledBuildId(): Promise<void> {
  const previousBuildId = localStorage.getItem(BUILD_ID_STORAGE_KEY);
  if (previousBuildId === __APP_BUILD_ID__) {
    return;
  }

  localStorage.setItem(BUILD_ID_STORAGE_KEY, __APP_BUILD_ID__);

  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map(async (registration) => {
        const scriptURL =
          registration.active?.scriptURL ||
          registration.waiting?.scriptURL ||
          registration.installing?.scriptURL ||
          '';

        if (scriptURL && !scriptURL.includes('/sw.js')) {
          await registration.unregister();
          return;
        }

        await registration.update().catch(() => undefined);
      })
    );
  }
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    try {
      // Check if we're in a development/preview environment
      const isDevelopment = window.location.hostname.includes('figma.site') ||
        window.location.hostname === 'localhost';

      if (isDevelopment) {
        console.log('[PWA] Service Worker registration skipped in development environment');
        console.log('[PWA] To enable PWA features, deploy to a production server with proper MIME types');
        return null;
      }

      await syncInstalledBuildId();

      const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
        scope: '/',
      });

      console.log('[PWA] Service Worker registered successfully:', registration.scope);

      // Check for updates every hour
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);

      // Handle updates - aggressive cache busting
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New version available! Updating...');
              // Automatically claim clients and reload
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });

      return registration;
    } catch (error) {
      console.log('[PWA] Service Worker registration skipped:', (error as Error).message);
      return null;
    }
  } else {
    console.log('[PWA] Service Workers are not supported in this browser');
    return null;
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const result = await registration.unregister();
        console.log('[PWA] Service Worker unregistered:', result);
        return result;
      }
    } catch (error) {
      console.error('[PWA] Service Worker unregistration failed:', error);
    }
  }
  return false;
}

/**
 * Check if the app is installed as PWA
 */
export function isPWAInstalled(): boolean {
  // Check if running in standalone mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // Check if running in fullscreen mode
  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;

  // Check navigator.standalone (iOS Safari)
  const isIOSStandalone = (navigator as any).standalone === true;

  return isStandalone || isFullscreen || isIOSStandalone;
}

/**
 * Capture the install prompt event
 */
export function setupInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    console.log('[PWA] Install prompt captured');
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    deferredPrompt = null;
  });
}

/**
 * Show the install prompt
 */
export async function showInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) {
    console.log('[PWA] Install prompt not available');
    return 'unavailable';
  }

  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice:', outcome);
    deferredPrompt = null;
    return outcome;
  } catch (error) {
    console.error('[PWA] Install prompt failed:', error);
    return 'unavailable';
  }
}

/**
 * Check if install prompt is available
 */
export function isInstallPromptAvailable(): boolean {
  return deferredPrompt !== null;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    console.log('[PWA] Notification permission:', permission);
    return permission;
  }
  return 'denied';
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.log('[PWA] Notification permission denied');
      return null;
    }

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Subscribe to push notifications
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          // You'll need to add your VAPID public key here
          'YOUR_VAPID_PUBLIC_KEY'
        ),
      });
      console.log('[PWA] Push subscription created:', subscription);
    }

    return subscription;
  } catch (error) {
    console.error('[PWA] Push subscription failed:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(
  registration: ServiceWorkerRegistration
): Promise<boolean> {
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const result = await subscription.unsubscribe();
      console.log('[PWA] Push subscription removed:', result);
      return result;
    }
    return false;
  } catch (error) {
    console.error('[PWA] Unsubscribe failed:', error);
    return false;
  }
}

/**
 * Force-nuke the entire PWA state (Caches, Service Workers, Storage)
 * Use this only for critical debug recovery
 */
export async function nukeApp(): Promise<void> {
  console.warn('[PWA] !!! NUKING APP STATE !!!');

  // 1. Unregister all service workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log('[PWA] Unregistered:', registration.scope);
    }
  }

  // 2. Clear all caches
  await clearAllCaches();

  // 3. Clear all storage (Caution: Logs out user)
  localStorage.clear();
  sessionStorage.clear();

  // 4. Force reload
  console.log('[PWA] Nuke complete. Reloading...');
  window.location.href = window.location.origin + '?cache_bust=' + Date.now();
}

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<void> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    console.log('[PWA] All caches cleared');
  }
}

/**
 * Get cache size
 */
export async function getCacheSize(): Promise<number> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    let totalSize = 0;

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();

      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }

    return totalSize;
  }
  return 0;
}

/**
 * Check if offline
 */
export function isOffline(): boolean {
  return !navigator.onLine;
}

/**
 * Listen for online/offline events
 */
export function setupNetworkListeners(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

/**
 * Utility function to convert base64 to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Register for background sync
 */
export async function registerBackgroundSync(
  registration: ServiceWorkerRegistration,
  tag: string
): Promise<void> {
  if ('sync' in registration) {
    try {
      await (registration as any).sync.register(tag);
      console.log('[PWA] Background sync registered:', tag);
    } catch (error) {
      console.error('[PWA] Background sync registration failed:', error);
    }
  }
}

/**
 * Share content using Web Share API
 */
export async function shareContent(data: {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}): Promise<boolean> {
  if ('share' in navigator) {
    try {
      await navigator.share(data);
      console.log('[PWA] Content shared successfully');
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('[PWA] Share failed:', error);
      }
      return false;
    }
  }
  return false;
}

/**
 * Check if Web Share API is available
 */
export function canShare(data?: { files?: File[] }): boolean {
  if ('canShare' in navigator && data?.files) {
    return navigator.canShare(data);
  }
  return 'share' in navigator;
}
