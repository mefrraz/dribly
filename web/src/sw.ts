import { clientsClaim, skipWaiting } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

/// <reference lib="WebWorker" />

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

// ── Push Notification Handler ──────────────────────────────
// Handles incoming push events from the server.
// Expects JSON payload: { title, body, icon?, badge?, url?, tag? }
self.addEventListener('push', (event: PushEvent) => {
    const fallback = {
        title: 'Dribly',
        body: 'Nova atualização disponível.',
        icon: '/logo.png',
        badge: '/logo.png',
    };

    const showNotification = (data: typeof fallback) => {
        const { title, body, icon, badge, url, tag } = {
            ...fallback,
            ...data,
        };
        event.waitUntil(
            self.registration.showNotification(title, {
                body,
                icon,
                badge,
                tag: tag || 'dribly-default',
                data: { url: url || 'https://dribly.pt' },
                vibrate: [200, 100, 200],
                requireInteraction: false,
                actions: [
                    { action: 'open', title: 'Ver' },
                    { action: 'close', title: 'Fechar' },
                ],
            })
        );
    };

    if (event.data) {
        try {
            const payload = event.data.json();
            showNotification(payload);
        } catch {
            // Non-JSON payload — try text
            showNotification({ ...fallback, body: event.data.text() || fallback.body });
        }
    } else {
        showNotification(fallback);
    }
});

// ── Notification Click Handler ─────────────────────────────
// Opens or focuses a Dribly window and navigates to the URL in payload.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
    event.notification.close();

    if (event.action === 'close') return;

    const url = event.notification.data?.url || 'https://dribly.pt';

    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });
            const existing = windows.find(w => w.url.startsWith(self.location.origin));
            if (existing) {
                await existing.focus();
                existing.postMessage({ type: 'NOTIFICATION_CLICK', url });
            } else {
                await self.clients.openWindow(url);
            }
        })()
    );
});
