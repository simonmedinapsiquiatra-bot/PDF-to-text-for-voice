const CACHE_NAME = 'dr-media-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
  'https://unpkg.com/pdf-lib/dist/pdf-lib.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js'
];

// Instalar el Service Worker y cachear el "App Shell" básico
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precachando App Shell...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activar el SW y limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Limpiando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar peticiones para estrategia Cache-First con guardado dinámico
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignorar peticiones que no sean GET (como las llamadas POST a /api/gemini)
  if (request.method !== 'GET') return;

  // Ignorar extensiones de navegador u otras solicitudes externas que no sean de assets importantes
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !request.url.startsWith('https://fonts.gstatic.com') && !request.url.startsWith('https://cdnjs.cloudflare.com') && !request.url.startsWith('https://unpkg.com')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Devolver inmediatamente si está en caché
        return cachedResponse;
      }

      // Si no está, buscar en la red
      return fetch(request).then((networkResponse) => {
        // Validar respuesta
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && !request.url.includes('cdn') && !request.url.includes('unpkg') && !request.url.includes('fonts')) {
          return networkResponse;
        }

        // Cachear dinámicamente el recurso (esto incluye el JS, CSS de Vite y los diccionarios .dic / .aff)
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      }).catch((err) => {
        console.error('[Service Worker] Error al buscar en red:', err);
        // Podríamos devolver un fallback offline aquí si fuera necesario
      });
    })
  );
});
