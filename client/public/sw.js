// Maintrix Service Worker — Push Notifications
const CACHE_NAME = 'maintrix-v1';
const ICON_URL = '/icon-192.png';

// ── Push Event ────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Maintrix', body: event.data ? event.data.text() : 'Nouvelle notification' };
  }

  const title = data.title || 'Maintrix';
  const options = {
    body: data.body || 'Vous avez une nouvelle notification.',
    icon: ICON_URL,
    badge: ICON_URL,
    tag: data.tag || 'maintrix-notif',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    vibrate: data.severity === 'critical' ? [200, 100, 200, 100, 200] : [200, 100, 200],
    data: {
      url: data.url || '/',
      notificationId: data.notificationId,
      type: data.type,
      severity: data.severity,
    },
    actions: data.actions || [],
  };

  // Critical events: persistent notification + special vibration pattern
  if (data.severity === 'critical' || data.severity === 'emergency') {
    options.requireInteraction = true;
    options.tag = 'maintrix-critical';
    options.actions = [
      { action: 'view', title: '👁 Voir' },
      { action: 'ack',  title: '✅ Acquitter' },
    ];
  } else if (data.type === 'task_assigned') {
    options.requireInteraction = true;
    options.tag = 'maintrix-task';
    options.actions = [
      { action: 'view', title: '📋 Voir la tâche' },
      { action: 'ack',  title: '✅ Accepter' },
    ];
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const action = event.action;

  let targetUrl = notifData.url || '/mobile-notifications';

  if (action === 'view' || !action) {
    if (notifData.type === 'task_assigned') targetUrl = '/work-orders';
    else if (notifData.type === 'critical_alert') targetUrl = '/mobile-notifications';
    else if (notifData.type === 'maintenance_due') targetUrl = '/maintenance-recommendations';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', action, data: notifData });
          return;
        }
      }
      // Open new tab
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── Notification Close ────────────────────────────────────────────────────────
self.addEventListener('notificationclose', (event) => {
  // Track dismissals if needed
  const notifData = event.notification.data || {};
  if (notifData.notificationId) {
    // Fire-and-forget analytics
    fetch(`/api/mobile/notifications/${notifData.notificationId}/dismiss`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
  }
});

// ── Install / Activate ────────────────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
