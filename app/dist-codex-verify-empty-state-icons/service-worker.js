/**
 * Advanced Service Worker with Optimized Caching Strategies
 * 
 * Features:
 * - Multiple cache strategies (Network-first, Cache-first, Stale-while-revalidate)
 * - Intelligent cache versioning
 * - Cache size limits with LRU eviction
 * - Background sync support
 * - Push notification support
 * - Offline fallback pages
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAMES = {
  STATIC: `screndly-static-${CACHE_VERSION}`,
  DYNAMIC: `screndly-dynamic-${CACHE_VERSION}`,
  IMAGES: `screndly-images-${CACHE_VERSION}`,
  API: `screndly-api-${CACHE_VERSION}`,
  FONTS: `screndly-fonts-${CACHE_VERSION}`,
};

// Cache size limits (in entries)
const CACHE_LIMITS = {
  STATIC: 100,
  DYNAMIC: 50,
  IMAGES: 100,
  API: 50,
  FONTS: 20,
};

// Cache expiration times (in seconds)
const CACHE_EXPIRATION = {
  STATIC: 30 * 24 * 60 * 60, // 30 days
  DYNAMIC: 7 * 24 * 60 * 60, // 7 days
  IMAGES: 7 * 24 * 60 * 60, // 7 days
  API: 5 * 60, // 5 minutes
  FONTS: 365 * 24 * 60 * 60, // 1 year
};

// Static assets to pre-cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
];

/**
 * Install event - Pre-cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAMES.STATIC)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Service worker installed');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

/**
 * Activate event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old cache versions
              return Object.values(CACHE_NAMES).indexOf(cacheName) === -1;
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim(); // Take control immediately
      })
  );
});

/**
 * Fetch event - Serve from cache with different strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Determine cache strategy based on request type
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, CACHE_NAMES.STATIC));
  } else if (isImage(url)) {
    event.respondWith(cacheFirst(request, CACHE_NAMES.IMAGES));
  } else if (isFont(url)) {
    event.respondWith(cacheFirst(request, CACHE_NAMES.FONTS));
  } else if (isAPIRequest(url)) {
    event.respondWith(networkFirst(request, CACHE_NAMES.API));
  } else {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAMES.DYNAMIC));
  }
});

/**
 * Cache-First Strategy
 * Best for: Static assets that rarely change
 */
async function cacheFirst(request, cacheName) {
  try {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      // Check if cache is expired
      const cacheTime = await getCacheTime(cacheName, request.url);
      const maxAge = CACHE_EXPIRATION[getCacheType(cacheName)];
      
      if (cacheTime && Date.now() - cacheTime < maxAge * 1000) {
        return cachedResponse;
      }
    }

    // Fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
      await setCacheTime(cacheName, request.url);
      await trimCache(cacheName);
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-first failed:', error);
    
    // Return cached response even if expired
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    throw error;
  }
}

/**
 * Network-First Strategy
 * Best for: Dynamic content and API calls
 */
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
      await setCacheTime(cacheName, request.url);
      await trimCache(cacheName);
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Network-first failed, falling back to cache:', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    throw error;
  }
}

/**
 * Stale-While-Revalidate Strategy
 * Best for: Content that can be stale but should update in background
 */
async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);

  const fetchPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const cache = await caches.open(cacheName);
        await cache.put(request, networkResponse.clone());
        await setCacheTime(cacheName, request.url);
        await trimCache(cacheName);
      }
      return networkResponse;
    })
    .catch((error) => {
      console.error('[SW] Stale-while-revalidate update failed:', error);
      return cachedResponse;
    });

  return cachedResponse || fetchPromise;
}

/**
 * Trim cache to size limit using LRU (Least Recently Used)
 */
async function trimCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const cacheType = getCacheType(cacheName);
  const limit = CACHE_LIMITS[cacheType] || 50;

  if (keys.length > limit) {
    // Get cache times
    const entries = await Promise.all(
      keys.map(async (key) => ({
        key,
        time: await getCacheTime(cacheName, key.url) || 0,
      }))
    );

    // Sort by time (oldest first)
    entries.sort((a, b) => a.time - b.time);

    // Delete oldest entries
    const toDelete = entries.slice(0, keys.length - limit);
    await Promise.all(
      toDelete.map(({ key }) => {
        console.log('[SW] Trimming cache:', key.url);
        return cache.delete(key);
      })
    );
  }
}

/**
 * Store cache time in IndexedDB
 */
async function setCacheTime(cacheName, url) {
  try {
    const db = await openCacheDB();
    const transaction = db.transaction(['cacheTimes'], 'readwrite');
    const store = transaction.objectStore('cacheTimes');
    
    await store.put({
      key: `${cacheName}:${url}`,
      time: Date.now(),
    });
  } catch (error) {
    console.error('[SW] Failed to set cache time:', error);
  }
}

/**
 * Get cache time from IndexedDB
 */
async function getCacheTime(cacheName, url) {
  try {
    const db = await openCacheDB();
    const transaction = db.transaction(['cacheTimes'], 'readonly');
    const store = transaction.objectStore('cacheTimes');
    
    const result = await store.get(`${cacheName}:${url}`);
    return result?.time;
  } catch (error) {
    console.error('[SW] Failed to get cache time:', error);
    return null;
  }
}

/**
 * Open IndexedDB for cache metadata
 */
function openCacheDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ScrendlyCacheDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('cacheTimes')) {
        db.createObjectStore('cacheTimes', { keyPath: 'key' });
      }
    };
  });
}

/**
 * Helper functions to determine request types
 */
function isStaticAsset(url) {
  return url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.html') ||
         url.pathname === '/' ||
         url.pathname.includes('/assets/');
}

function isImage(url) {
  return url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|avif|ico)$/i);
}

function isFont(url) {
  return url.pathname.match(/\.(woff|woff2|ttf|otf|eot)$/i);
}

function isAPIRequest(url) {
  return url.pathname.includes('/api/') ||
         url.hostname.includes('api.') ||
         url.hostname.includes('backblaze') ||
         url.hostname.includes('themoviedb') ||
         url.hostname.includes('openai');
}

function getCacheType(cacheName) {
  if (cacheName.includes('static')) return 'STATIC';
  if (cacheName.includes('dynamic')) return 'DYNAMIC';
  if (cacheName.includes('images')) return 'IMAGES';
  if (cacheName.includes('api')) return 'API';
  if (cacheName.includes('fonts')) return 'FONTS';
  return 'DYNAMIC';
}

/**
 * Background Sync - Retry failed requests
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-uploads') {
    event.waitUntil(syncUploads());
  }
});

async function syncUploads() {
  // Implement background sync logic
  console.log('[SW] Syncing uploads...');
}

/**
 * Push Notifications
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'New notification from Screndly',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    data: data,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Screndly', options)
  );
});

/**
 * Notification Click
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});

/**
 * Message handling
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

console.log('[SW] Service worker script loaded');
