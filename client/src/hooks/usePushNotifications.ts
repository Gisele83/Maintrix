import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

const VAPID_PUBLIC_KEY_URL = "/api/push/vapid-public-key";
const SW_URL = "/sw.js";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export interface PushNotificationState {
  isSupported: boolean;
  permission: PushPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
}

export function usePushNotifications(): PushNotificationState {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sw, setSw] = useState<ServiceWorkerRegistration | null>(null);

  // Initialize
  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setIsSupported(supported);

    if (!supported) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as PushPermission);

    // Register SW
    navigator.serviceWorker
      .register(SW_URL, { scope: "/" })
      .then(async (registration) => {
        setSw(registration);
        // Check existing subscription
        const existing = await registration.pushManager.getSubscription();
        setIsSubscribed(!!existing);
      })
      .catch((err) => {
        console.warn("[Push] SW registration failed:", err);
      });
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    const result = await Notification.requestPermission();
    setPermission(result as PushPermission);
    return result === "granted";
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !sw) return false;
    setIsLoading(true);
    setError(null);
    try {
      // Ensure permission granted
      const perm = Notification.permission === "granted"
        ? true
        : await requestPermission();
      if (!perm) {
        setError("Permission refusée. Activez les notifications dans les paramètres du navigateur.");
        return false;
      }

      // Get VAPID public key
      const keyRes = await fetch(VAPID_PUBLIC_KEY_URL);
      if (!keyRes.ok) throw new Error("Impossible de récupérer la clé VAPID");
      const { publicKey } = await keyRes.json();

      // Subscribe via PushManager
      const subscription = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send subscription to server
      const deviceName = navigator.userAgent.includes("Mobile")
        ? `Mobile — ${navigator.platform}`
        : `Desktop — ${navigator.platform}`;

      await apiRequest("POST", "/api/push/subscribe", {
        subscription: subscription.toJSON(),
        deviceName,
      });

      setIsSubscribed(true);
      return true;
    } catch (err: any) {
      console.error("[Push] Subscribe error:", err);
      setError(err.message || "Erreur lors de l'abonnement aux notifications.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, sw, requestPermission]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !sw) return false;
    setIsLoading(true);
    try {
      const existing = await sw.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
        await apiRequest("DELETE", "/api/push/unsubscribe", {
          endpoint: existing.endpoint,
        });
      }
      setIsSubscribed(false);
      return true;
    } catch (err: any) {
      console.error("[Push] Unsubscribe error:", err);
      setError(err.message || "Erreur lors de la désinscription.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, sw]);

  return { isSupported, permission, isSubscribed, isLoading, error, subscribe, unsubscribe, requestPermission };
}
