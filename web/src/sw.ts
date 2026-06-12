import { clientsClaim, skipWaiting } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

// ── Take control immediately ──
skipWaiting();
clientsClaim();

// ── Precache all build assets ──
// The manifest is injected at build time by vite-plugin-pwa.
// index.html is excluded via globIgnores in vite.config.ts — we want
// NetworkFirst for HTML documents, never stale precached HTML.
precacheAndRoute(self.__WB_MANIFEST);

cleanupOutdatedCaches();

// ── Navigation: NetworkFirst (never serve stale HTML) ──
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'html-cache',
      plugins: [
        new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 60 }),
        new CacheableResponsePlugin({ statuses: [0, 200] }),
      ],
    })
  )
);

// ── FPB API proxy (StaleWhileRevalidate, 15 min TTL) ──
registerRoute(
  /\/api\/fpb/i,
  new StaleWhileRevalidate({
    cacheName: 'fpb-api-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 900 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  'GET'
);

// ── Supabase REST API (NetworkFirst, 2 h TTL) ──
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
  new NetworkFirst({
    cacheName: 'supabase-api-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7200 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  'GET'
);

// ── Google Fonts (CacheFirst, 1 year TTL) ──
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 31536000 }),
    ],
  }),
  'GET'
);
