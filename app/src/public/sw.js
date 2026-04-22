// Screndly PWA Service Worker - Enhanced with Advanced Caching Strategies
// Note: The SW is registered with a `?build=...` query param in `src/utils/pwa.ts`.
// We use that build id to version caches precisely without nuking everything.
function getBuildId() {
  try {
    return new URL(self.location.href).searchParams.get('build') || 'dev';
  } catch {
    return 'dev';
  }
}

const BUILD_ID = getBuildId();
const SW_VERSION = `v1.3.0-resume-recovery-${BUILD_ID}`;
const CACHE_NAME = `screndly-${SW_VERSION}`;
const RUNTIME_CACHE = `screndly-runtime-${SW_VERSION}`;
const IMAGE_CACHE = `screndly-images-${SW_VERSION}`;
const API_CACHE = `screndly-api-${SW_VERSION}`;

// Cache expiration times (in milliseconds)
const CACHE_EXPIRATION = {
  images: 7 * 24 * 60 * 60 * 1000, // 7 days
  api: 5 * 60 * 1000, // 5 minutes
  runtime: 24 * 60 * 60 * 1000, // 24 hours
};

// Maximum cache sizes
const MAX_CACHE_SIZE = {
  images: 50,
  api: 30,
  runtime: 100,
};

function getBadgeNavigator() {
  const candidate = self.navigator;
  if (!candidate) {
    return null;
  }

  if (typeof candidate.setAppBadge !== 'function' && typeof candidate.clearAppBadge !== 'function') {
    return null;
  }

  return candidate;
}

async function updateAppBadge(count) {
  const badgeNavigator = getBadgeNavigator();
  if (!badgeNavigator) {
    return;
  }

  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;

  if (safeCount > 0 && typeof badgeNavigator.setAppBadge === 'function') {
    await badgeNavigator.setAppBadge(safeCount);
    return;
  }

  if (typeof badgeNavigator.clearAppBadge === 'function') {
    await badgeNavigator.clearAppBadge();
  }
}

// Core assets to cache on install
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing service worker ${SW_VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching core assets');
      return cache.addAll(CORE_ASSETS);
    }).then(() => {
      console.log('[SW] Service worker installed successfully');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  const screndlyCachesToKeep = new Set([CACHE_NAME, RUNTIME_CACHE, IMAGE_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Only delete our own caches; do not touch other app/libs caches on the same origin.
          if (cacheName.startsWith('screndly-') && !screndlyCachesToKeep.has(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated successfully');
      return self.clients.claim();
    })
  );
});

// Helper: Trim cache to max size
async function trimCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxSize) {
    const keysToDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
    console.log(`[SW] Trimmed ${cacheName} cache to ${maxSize} items`);
  }
}

// Helper: Check if cache entry is expired
function isCacheExpired(response, maxAge) {
  if (!maxAge || typeof maxAge !== 'number') return true;
  const cachedDateHeader = response.headers.get('sw-cache-date');
  if (!cachedDateHeader) return true;
  const cachedDate = new Date(cachedDateHeader);
  const cachedMs = cachedDate.getTime();
  if (!Number.isFinite(cachedMs)) return true;
  return (Date.now() - cachedMs) > maxAge;
}

// Helper: Add metadata to cached response
function createCachedResponse(response) {
  const clonedResponse = response.clone();
  const headers = new Headers(clonedResponse.headers);
  headers.set('sw-cache-date', new Date().toISOString());

  return clonedResponse.blob().then(body => {
    return new Response(body, {
      status: clonedResponse.status,
      statusText: clonedResponse.statusText,
      headers: headers
    });
  });
}

function isNavigationRequest(request, url) {
  return (
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html'
  );
}

function isOAuthCallbackRequest(url) {
  return url.pathname === '/platforms/callback';
}

function isStaticAssetRequest(request, url) {
  return (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'worker' ||
    request.destination === 'manifest' ||
    request.destination === 'font' ||
    url.pathname === '/manifest.json' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  );
}

async function getNavigationFallback() {
  const rootDocument = await caches.match('/');
  if (rootDocument) {
    return rootDocument;
  }

  return caches.match('/offline.html');
}

// Strategy: Cache First (for images)
async function cacheFirst(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse && !isCacheExpired(cachedResponse, maxAge)) {
    console.log('[SW] Serving from cache (cache-first):', request.url);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      const responseToCache = await createCachedResponse(networkResponse);
      await cache.put(request, responseToCache);
      await trimCache(cacheName, MAX_CACHE_SIZE.images);
    }
    return networkResponse;
  } catch (error) {
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

// Strategy: Network First (for API calls)
async function networkFirst(request, cacheName, maxAge) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      const responseToCache = await createCachedResponse(networkResponse);
      await cache.put(request, responseToCache);
      await trimCache(cacheName, MAX_CACHE_SIZE.api);
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse && !isCacheExpired(cachedResponse, maxAge)) {
      console.log('[SW] Serving from cache (network-first fallback):', request.url);
      return cachedResponse;
    }

    throw error;
  }
}

// Strategy: Stale While Revalidate (for runtime assets)
async function staleWhileRevalidate(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  const usableCachedResponse =
    cachedResponse && !isCacheExpired(cachedResponse, maxAge) ? cachedResponse : null;

  const fetchPromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse.status === 200) {
      const responseToCache = await createCachedResponse(networkResponse);
      await cache.put(request, responseToCache);
      await trimCache(cacheName, MAX_CACHE_SIZE.runtime);
    }
    return networkResponse;
  }).catch(() => usableCachedResponse);

  return usableCachedResponse || fetchPromise;
}

// Only cache a small allowlist of safe, unauthenticated API requests.
// Everything else is passed through to the network (or fails) to avoid serving stale/private data.
const API_CACHE_ALLOWLIST = new Set([
  '/api/diag/oauth-config',
]);

function isCacheableApiRequest(request, url) {
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (!API_CACHE_ALLOWLIST.has(url.pathname)) return false;
  if (request.headers.get('Authorization')) return false;
  // Avoid caching requests that explicitly opt out.
  const cacheControl = request.headers.get('Cache-Control') || '';
  if (cacheControl.toLowerCase().includes('no-store')) return false;
  return true;
}

// Fetch event - intelligent caching strategies
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CRITICAL: Skip service worker for WebAssembly files and FFmpeg CDN
  // This prevents "Network error: Response body loading was aborted" errors
  if (url.pathname.endsWith('.wasm') ||
    url.pathname.includes('ffmpeg-core') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('unpkg.com')) {
    console.log('[SW] Bypassing service worker for:', event.request.url);
    return; // Let browser handle directly
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    // Exception: Allow TMDb images
    if (event.request.url.includes('image.tmdb.org')) {
      event.respondWith(cacheFirst(event.request, IMAGE_CACHE, CACHE_EXPIRATION.images));
    }
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Strategy 1: Cache First for images
  if (event.request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
    event.respondWith(cacheFirst(event.request, IMAGE_CACHE, CACHE_EXPIRATION.images));
    return;
  }

  // Strategy 2: Network First for API calls
  if (url.pathname.startsWith('/api/')) {
    // Let the browser handle OAuth auth redirects directly so the navigation
    // can leave the app shell (service worker fetch would swallow the redirect).
    if (url.pathname.startsWith('/api/platforms/auth/')) {
      return;
    }
    if (isCacheableApiRequest(event.request, url)) {
      event.respondWith(networkFirst(event.request, API_CACHE, CACHE_EXPIRATION.api));
    } else {
      event.respondWith(fetch(event.request));
    }
    return;
  }

  // Strategy 2.5: Always use the network for OAuth callback navigations.
  // The installed PWA must not boot a stale cached shell on the callback route,
  // or it can run old callback logic and appear to spin forever.
  if (isOAuthCallbackRequest(url)) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return getNavigationFallback();
      })
    );
    return;
  }

  // Strategy 3: Network First for HTML navigations with cache fallback for resume/offline recovery.
  if (isNavigationRequest(event.request, url)) {
    event.respondWith(
      networkFirst(event.request, RUNTIME_CACHE, CACHE_EXPIRATION.runtime).catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return getNavigationFallback();
        });
      })
    );
    return;
  }

  // Strategy 4: Serve static app assets from cache immediately and refresh them in the background.
  if (isStaticAssetRequest(event.request, url)) {
    event.respondWith(
      staleWhileRevalidate(event.request, CACHE_NAME, CACHE_EXPIRATION.runtime).then((response) => {
        if (response) {
          return response;
        }

        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
    );
    return;
  }

  // Strategy 5: Stale While Revalidate for everything else
  event.respondWith(
    staleWhileRevalidate(event.request, RUNTIME_CACHE, CACHE_EXPIRATION.runtime).catch(() => {
      // Fallback for navigation requests
      if (event.request.mode === 'navigate') {
        return getNavigationFallback();
      }
      return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Content-Type': 'text/plain' })
      });
    })
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (error) {
      payload = {
        body: event.data.text(),
      };
    }
  }

  const targetUrl = payload.url || '/';
  const options = {
    body: payload.body || 'New notification from Screndly',
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: payload.tag || 'screndly-notification',
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      url: targetUrl,
      source: payload.source || 'system',
      type: payload.type || 'info',
    }
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title || 'Screndly', options),
      updateAppBadge(payload.badgeCount ?? 0),
    ])
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'SCR_UPDATE_APP_BADGE') {
    return;
  }

  event.waitUntil(updateAppBadge(data.count));
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle background sync
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-posts') {
    event.waitUntil(syncPosts());
  }
});

// Sync posts function
async function syncPosts() {
  try {
    console.log('[SW] Syncing posts...');
    // Add your sync logic here
    return Promise.resolve();
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    return Promise.reject(error);
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});
