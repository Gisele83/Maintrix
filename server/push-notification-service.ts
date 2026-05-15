/**
 * 📱 SERVICE DE NOTIFICATIONS PUSH MOBILES — Maintrix
 *
 * Web Push (VAPID) pour PWA mobile/desktop.
 * Déclenche des notifications pour :
 *   • Événements critiques (alertes, pannes, urgences)
 *   • Affectation d'ordres de travail
 *   • Échéances de maintenance
 *   • Mises à jour d'OT
 */

import type { Express } from "express";
import { db } from "./db";
import { eq, and, desc, isNull } from "drizzle-orm";
import {
  pushSubscriptions,
  mobileNotifications,
  userProfiles,
  workOrders,
  equipmentRegistry,
  alertsNotifications,
} from "../shared/schema";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";

// ── VAPID key management ───────────────────────────────────────────────────────
let webpush: any = null;
let vapidPublicKey = "";
let vapidPrivateKey = "";

async function getWebPush() {
  if (webpush) return webpush;
  try {
    webpush = await import("web-push");
    webpush = webpush.default || webpush;

    // Use stored keys from env or generate ephemeral ones
    const storedPublic = process.env.VAPID_PUBLIC_KEY;
    const storedPrivate = process.env.VAPID_PRIVATE_KEY;

    if (storedPublic && storedPrivate) {
      vapidPublicKey = storedPublic;
      vapidPrivateKey = storedPrivate;
    } else {
      const keys = webpush.generateVAPIDKeys();
      vapidPublicKey = keys.publicKey;
      vapidPrivateKey = keys.privateKey;
      console.log("📱 VAPID keys generated (ephemeral). Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars for persistence.");
    }

    webpush.setVapidDetails(
      "mailto:admin@maintrix.io",
      vapidPublicKey,
      vapidPrivateKey
    );
    console.log("📱 Web Push service initialized (VAPID ready)");
    return webpush;
  } catch (err) {
    console.warn("⚠️  web-push unavailable:", err);
    return null;
  }
}

// Initialize at startup
getWebPush().catch(() => {});

// ── Types ──────────────────────────────────────────────────────────────────────
export interface PushPayload {
  title: string;
  body: string;
  type: "critical_alert" | "task_assigned" | "maintenance_due" | "work_order_update" | "system";
  severity?: "low" | "medium" | "high" | "critical" | "emergency";
  url?: string;
  notificationId?: number;
  tag?: string;
  requireInteraction?: boolean;
  actions?: { action: string; title: string }[];
}

// ── Core send function ─────────────────────────────────────────────────────────
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<number> {
  const wp = await getWebPush();
  if (!wp) return 0;

  let subs: any[] = [];
  try {
    subs = await db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true)));
  } catch {
    return 0;
  }

  let sent = 0;
  const deadEndpoints: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await wp.sendNotification(pushSub, JSON.stringify(payload), { TTL: 86400 });
        // Update lastUsedAt
        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.id, sub.id));
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          deadEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  // Cleanup dead subscriptions
  for (const endpoint of deadEndpoints) {
    await db
      .update(pushSubscriptions)
      .set({ isActive: false })
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }

  return sent;
}

export async function sendPushToTenant(tenantId: string, payload: PushPayload): Promise<number> {
  const wp = await getWebPush();
  if (!wp) return 0;

  let subs: any[] = [];
  try {
    subs = await db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.tenantId, tenantId), eq(pushSubscriptions.isActive, true)));
  } catch {
    return 0;
  }

  let sent = 0;
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await wp.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 86400 }
        );
        sent++;
      } catch {}
    })
  );
  return sent;
}

// ── Notification helpers ───────────────────────────────────────────────────────
export async function notifyTaskAssigned(
  assigneeId: number,
  workOrder: any,
  equipment: any
): Promise<void> {
  // Persist in mobile feed
  try {
    await db.insert(mobileNotifications).values({
      userId: assigneeId,
      tenantId: workOrder.tenantId,
      type: "task_assigned",
      severity: workOrder.priority === "urgent" ? "critical" : workOrder.priority === "high" ? "high" : "medium",
      title: `📋 Nouvelle tâche affectée`,
      body: `${workOrder.title} — ${equipment?.equipmentName || "Équipement"} (${workOrder.orderType}, priorité ${workOrder.priority})`,
      relatedEntityType: "work_order",
      relatedEntityId: workOrder.id,
      actionUrl: "/work-orders",
      pushSent: false,
    });
  } catch {}

  // Push notification
  const p: PushPayload = {
    title: "📋 Nouvelle tâche affectée",
    body: `${workOrder.title} — ${equipment?.equipmentName || "Équipement"}`,
    type: "task_assigned",
    severity: workOrder.priority === "urgent" ? "critical" : workOrder.priority as any,
    url: "/work-orders",
    tag: `task-${workOrder.id}`,
    requireInteraction: workOrder.priority === "urgent" || workOrder.priority === "high",
  };
  await sendPushToUser(assigneeId, p);
}

export async function notifyCriticalAlert(
  tenantId: string,
  alert: any,
  equipment: any
): Promise<void> {
  // Get all admins + technicians of the tenant to notify
  let users: any[] = [];
  try {
    users = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.tenantId, tenantId));
  } catch {}

  const criticalUsers = users.filter(
    (u) => ["admin", "director", "supervisor", "technician"].includes(u.role || "")
  );

  for (const user of criticalUsers) {
    try {
      await db.insert(mobileNotifications).values({
        userId: user.id,
        tenantId,
        type: "critical_alert",
        severity: alert.severity as any,
        title: `🚨 ${alert.title}`,
        body: alert.message + (equipment ? ` — ${equipment.equipmentName}` : ""),
        relatedEntityType: "equipment",
        relatedEntityId: alert.equipmentId,
        actionUrl: "/mobile-notifications",
        pushSent: false,
      });
    } catch {}
  }

  const payload: PushPayload = {
    title: `🚨 ${alert.title}`,
    body: alert.message,
    type: "critical_alert",
    severity: alert.severity as any,
    url: "/mobile-notifications",
    tag: `alert-${alert.id}`,
    requireInteraction: true,
  };
  await sendPushToTenant(tenantId, payload);
}

export async function notifyMaintenanceDue(
  tenantId: string,
  equipmentName: string,
  equipmentId: number,
  daysDue: number
): Promise<void> {
  let users: any[] = [];
  try {
    users = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.tenantId, tenantId));
  } catch {}

  const maintUsers = users.filter((u) =>
    ["admin", "supervisor", "maintenance_manager"].includes(u.role || "")
  );

  for (const user of maintUsers) {
    try {
      await db.insert(mobileNotifications).values({
        userId: user.id,
        tenantId,
        type: "maintenance_due",
        severity: daysDue <= 0 ? "high" : "medium",
        title: daysDue <= 0 ? `⚠️ Maintenance en retard` : `📅 Maintenance à planifier`,
        body: `${equipmentName} — ${daysDue <= 0 ? `En retard de ${Math.abs(daysDue)}j` : `Dans ${daysDue}j`}`,
        relatedEntityType: "equipment",
        relatedEntityId: equipmentId,
        actionUrl: "/maintenance-recommendations",
        pushSent: false,
      });
    } catch {}
  }
}

// ── Route registration ─────────────────────────────────────────────────────────
export function registerPushNotificationRoutes(app: Express) {
  // GET /api/push/vapid-public-key — public VAPID key for client-side subscription
  app.get("/api/push/vapid-public-key", async (_req, res) => {
    try {
      await getWebPush();
      if (!vapidPublicKey) {
        return res.status(503).json({ error: "Push service not initialized" });
      }
      res.json({ publicKey: vapidPublicKey });
    } catch {
      res.status(503).json({ error: "Push service unavailable" });
    }
  });

  // POST /api/push/subscribe — register a push subscription
  app.post(
    "/api/push/subscribe",
    EnterpriseAuthMiddleware.requireAuthentication,
    async (req: any, res) => {
      try {
        const { subscription, deviceName } = req.body;
        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
          return res.status(400).json({ error: "Invalid subscription object" });
        }

        const userId = req.user?.id;
        const tenantId = req.user?.tenantId || "default-tenant";

        // Upsert subscription
        await db
          .insert(pushSubscriptions)
          .values({
            userId,
            tenantId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            deviceName: deviceName || "Appareil inconnu",
            isActive: true,
          })
          .onConflictDoUpdate({
            target: pushSubscriptions.endpoint,
            set: { isActive: true, lastUsedAt: new Date(), deviceName },
          });

        res.json({ success: true, message: "Abonnement push enregistré avec succès." });
      } catch (err) {
        console.error("[Push] Subscribe error:", err);
        res.status(500).json({ error: "Subscription failed" });
      }
    }
  );

  // DELETE /api/push/unsubscribe
  app.delete(
    "/api/push/unsubscribe",
    EnterpriseAuthMiddleware.requireAuthentication,
    async (req: any, res) => {
      try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ error: "endpoint required" });

        await db
          .update(pushSubscriptions)
          .set({ isActive: false })
          .where(eq(pushSubscriptions.endpoint, endpoint));

        res.json({ success: true });
      } catch {
        res.status(500).json({ error: "Unsubscribe failed" });
      }
    }
  );

  // GET /api/mobile/notifications — notification feed for current user
  app.get(
    "/api/mobile/notifications",
    EnterpriseAuthMiddleware.requireAuthentication,
    async (req: any, res) => {
      try {
        const userId = req.user?.id;
        const limit = parseInt((req.query.limit as string) || "50", 10);
        const unreadOnly = req.query.unread === "true";

        const conditions: any[] = [eq(mobileNotifications.userId, userId)];
        if (unreadOnly) conditions.push(eq(mobileNotifications.isRead, false));
        conditions.push(eq(mobileNotifications.isDismissed, false));

        const notifs = await db
          .select()
          .from(mobileNotifications)
          .where(and(...conditions))
          .orderBy(desc(mobileNotifications.createdAt))
          .limit(limit);

        const unreadCount = await db
          .select()
          .from(mobileNotifications)
          .where(and(
            eq(mobileNotifications.userId, userId),
            eq(mobileNotifications.isRead, false),
            eq(mobileNotifications.isDismissed, false)
          ));

        res.json({ notifications: notifs, unreadCount: unreadCount.length });
      } catch (err) {
        console.error("[Mobile Notif] Fetch error:", err);
        res.status(500).json({ error: "Failed to fetch notifications" });
      }
    }
  );

  // PATCH /api/mobile/notifications/:id/read
  app.patch(
    "/api/mobile/notifications/:id/read",
    EnterpriseAuthMiddleware.requireAuthentication,
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        await db
          .update(mobileNotifications)
          .set({ isRead: true, readAt: new Date() })
          .where(and(eq(mobileNotifications.id, id), eq(mobileNotifications.userId, req.user.id)));
        res.json({ success: true });
      } catch {
        res.status(500).json({ error: "Update failed" });
      }
    }
  );

  // POST /api/mobile/notifications/read-all
  app.post(
    "/api/mobile/notifications/read-all",
    EnterpriseAuthMiddleware.requireAuthentication,
    async (req: any, res) => {
      try {
        await db
          .update(mobileNotifications)
          .set({ isRead: true, readAt: new Date() })
          .where(and(
            eq(mobileNotifications.userId, req.user.id),
            eq(mobileNotifications.isRead, false)
          ));
        res.json({ success: true });
      } catch {
        res.status(500).json({ error: "Update failed" });
      }
    }
  );

  // POST /api/mobile/notifications/:id/dismiss
  app.post(
    "/api/mobile/notifications/:id/dismiss",
    EnterpriseAuthMiddleware.requireAuthentication,
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        await db
          .update(mobileNotifications)
          .set({ isDismissed: true, isRead: true })
          .where(and(eq(mobileNotifications.id, id), eq(mobileNotifications.userId, req.user.id)));
        res.json({ success: true });
      } catch {
        res.status(500).json({ error: "Dismiss failed" });
      }
    }
  );

  // POST /api/push/test — send a test notification to the current user
  app.post(
    "/api/push/test",
    EnterpriseAuthMiddleware.requireAuthentication,
    generalRateLimit,
    async (req: any, res) => {
      try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId || "default-tenant";

        // Insert into mobile feed
        const [notif] = await db
          .insert(mobileNotifications)
          .values({
            userId,
            tenantId,
            type: "system",
            severity: "medium",
            title: "🔔 Notification de test",
            body: "Les notifications push Maintrix fonctionnent correctement sur cet appareil.",
            actionUrl: "/mobile-notifications",
            pushSent: false,
          })
          .returning();

        const sent = await sendPushToUser(userId, {
          title: "🔔 Maintrix — Test push",
          body: "Les notifications push fonctionnent sur cet appareil.",
          type: "system",
          severity: "medium",
          url: "/mobile-notifications",
          notificationId: notif.id,
          tag: "test-push",
        });

        res.json({ success: true, pushSent: sent > 0, notificationId: notif.id });
      } catch (err) {
        console.error("[Push] Test error:", err);
        res.status(500).json({ error: "Test failed" });
      }
    }
  );

  // GET /api/push/subscriptions — list user's devices
  app.get(
    "/api/push/subscriptions",
    EnterpriseAuthMiddleware.requireAuthentication,
    async (req: any, res) => {
      try {
        const subs = await db
          .select({
            id: pushSubscriptions.id,
            deviceName: pushSubscriptions.deviceName,
            isActive: pushSubscriptions.isActive,
            createdAt: pushSubscriptions.createdAt,
            lastUsedAt: pushSubscriptions.lastUsedAt,
          })
          .from(pushSubscriptions)
          .where(and(
            eq(pushSubscriptions.userId, req.user.id),
            eq(pushSubscriptions.isActive, true)
          ))
          .orderBy(desc(pushSubscriptions.lastUsedAt));
        res.json({ subscriptions: subs });
      } catch {
        res.status(500).json({ error: "Failed to list subscriptions" });
      }
    }
  );

  console.log("📱 Mobile Push Notification routes registered");
}

export { vapidPublicKey };
