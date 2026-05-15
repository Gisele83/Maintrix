import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ModernNavigation } from "@/components/modern-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  X,
  Wrench,
  AlertTriangle,
  ClipboardList,
  Calendar,
  Info,
  Smartphone,
  Settings,
  RefreshCw,
  ArrowRight,
  Zap,
  Shield,
  CheckCircle,
  Trash2,
  Clock,
  Activity,
  MonitorSmartphone,
  Plus,
  WifiOff,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────────
interface MobileNotification {
  id: number;
  type: "critical_alert" | "task_assigned" | "maintenance_due" | "work_order_update" | "system";
  severity: "low" | "medium" | "high" | "critical" | "emergency";
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
  actionUrl?: string;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
  readAt?: string;
}

interface NotifData {
  notifications: MobileNotification[];
  unreadCount: number;
}

interface DeviceInfo {
  id: number;
  deviceName: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string;
}

// ── Config ──────────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  critical_alert:    { label: "Alerte critique",      icon: AlertTriangle,  color: "text-rose-600",    bg: "bg-rose-50 border-rose-200" },
  task_assigned:     { label: "Tâche affectée",        icon: ClipboardList,  color: "text-blue-600",    bg: "bg-blue-50 border-blue-200" },
  maintenance_due:   { label: "Maintenance planifiée", icon: Calendar,       color: "text-amber-600",   bg: "bg-amber-50 border-amber-200" },
  work_order_update: { label: "Mise à jour OT",        icon: Wrench,         color: "text-violet-600",  bg: "bg-violet-50 border-violet-200" },
  system:            { label: "Système",               icon: Info,           color: "text-slate-500",   bg: "bg-slate-50 border-slate-200" },
};

const SEV_DOT: Record<string, string> = {
  emergency: "bg-red-600 animate-pulse",
  critical:  "bg-rose-500 animate-pulse",
  high:      "bg-orange-500",
  medium:    "bg-amber-400",
  low:       "bg-emerald-400",
};

function timeAgo(d: string) {
  const diff = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60)   return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ── Push Settings Panel ─────────────────────────────────────────────────────────
function PushSettingsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const push = usePushNotifications();

  const { data: devicesData, refetch: refetchDevices } = useQuery<{ subscriptions: DeviceInfo[] }>({
    queryKey: ["/api/push/subscriptions"],
    enabled: push.isSubscribed,
  });
  const devices = devicesData?.subscriptions || [];

  const testMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/push/test", {}),
    onSuccess: (data: any) => {
      if (data.pushSent) {
        toast({ title: "✅ Notification envoyée", description: "Vérifiez vos notifications système." });
      } else {
        toast({ title: "📬 Enregistrée", description: "Notification créée mais push non confirmé (vérifiez les permissions)." });
      }
      qc.invalidateQueries({ queryKey: ["/api/mobile/notifications"] });
    },
    onError: () => toast({ title: "Erreur", description: "Test échoué", variant: "destructive" }),
  });

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      const ok = await push.subscribe();
      if (ok) {
        toast({ title: "🔔 Notifications activées", description: "Vous recevrez les alertes sur cet appareil." });
        refetchDevices();
      } else {
        toast({ title: "Impossible d'activer", description: push.error || "Vérifiez les permissions du navigateur.", variant: "destructive" });
      }
    } else {
      await push.unsubscribe();
      toast({ title: "🔕 Notifications désactivées", description: "Cet appareil ne recevra plus d'alertes push." });
      refetchDevices();
    }
  };

  return (
    <div className="space-y-5">
      {/* Status Card */}
      <Card className={`border-2 ${push.isSubscribed ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${push.isSubscribed ? "bg-emerald-100" : "bg-slate-100"}`}>
                {push.isSubscribed ? <BellRing className="w-5 h-5 text-emerald-600" /> : <BellOff className="w-5 h-5 text-slate-400" />}
              </div>
              <div>
                <div className="font-semibold text-slate-800">
                  {push.isSubscribed ? "Notifications actives" : "Notifications désactivées"}
                </div>
                <div className="text-xs text-slate-500">
                  {!push.isSupported
                    ? "Navigateur non supporté"
                    : push.permission === "denied"
                    ? "Permission refusée — modifiez les paramètres du navigateur"
                    : push.isSubscribed
                    ? "Alertes push activées sur cet appareil"
                    : "Activez pour recevoir les alertes critiques"}
                </div>
              </div>
            </div>
            {push.isSupported && push.permission !== "denied" && (
              <Switch
                checked={push.isSubscribed}
                onCheckedChange={handleToggle}
                disabled={push.isLoading}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Permission denied warning */}
      {push.permission === "denied" && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-rose-700">Permission refusée</div>
            <div className="text-xs text-rose-600 mt-1">
              Autorisez les notifications dans les paramètres de votre navigateur, puis revenez ici pour activer.
            </div>
          </div>
        </div>
      )}

      {/* What you'll receive */}
      <Card className="border border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-slate-700">Événements notifiés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { icon: AlertTriangle, color: "text-rose-500", label: "Alertes critiques", desc: "Pannes, seuils dépassés, urgences" },
            { icon: ClipboardList, color: "text-blue-500", label: "Affectation de tâches", desc: "Nouvel OT assigné à votre compte" },
            { icon: Calendar, color: "text-amber-500", label: "Maintenance imminente", desc: "Rappels de planification préventive" },
            { icon: Wrench, color: "text-violet-500", label: "Mises à jour d'OT", desc: "Changements de statut et validations" },
          ].map(({ icon: Icon, color, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon className={`w-4 h-4 ${color} flex-shrink-0 mt-0.5`} />
              <div>
                <div className="text-sm font-medium text-slate-700">{label}</div>
                <div className="text-xs text-slate-400">{desc}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Test button */}
      {push.isSubscribed && (
        <Button
          variant="outline"
          className="w-full border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending}
        >
          <Zap className="w-4 h-4 mr-2" />
          {testMutation.isPending ? "Envoi en cours…" : "Envoyer une notification de test"}
        </Button>
      )}

      {/* Registered devices */}
      {devices.length > 0 && (
        <Card className="border border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
              <MonitorSmartphone className="w-4 h-4" />
              Appareils enregistrés ({devices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                <Smartphone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-700 truncate">{d.deviceName}</div>
                  <div className="text-[10px] text-slate-400">Dernière activité : {timeAgo(d.lastUsedAt)}</div>
                </div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Notification Item ───────────────────────────────────────────────────────────
function NotifItem({
  notif,
  onRead,
  onDismiss,
}: {
  notif: MobileNotification;
  onRead: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
  const Icon = cfg.icon;
  const dot = SEV_DOT[notif.severity] || "bg-slate-300";

  return (
    <div className={`relative border rounded-2xl p-4 transition-all duration-200 ${notif.isRead ? "bg-white border-slate-100 opacity-80" : `${cfg.bg} shadow-sm`}`}>
      {/* Unread dot */}
      {!notif.isRead && (
        <div className={`absolute top-3.5 right-3.5 w-2.5 h-2.5 ${dot} rounded-full`} />
      )}
      <div className="flex items-start gap-3 pr-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${notif.isRead ? "bg-slate-100" : cfg.bg.replace("bg-", "bg-").replace("-50", "-100")}`}>
          <Icon className={`w-4.5 h-4.5 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-slate-800 leading-snug">{notif.title}</span>
            <Badge className={`text-[10px] px-1.5 py-0 ${cfg.bg} ${cfg.color} border`}>{cfg.label}</Badge>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-2">{notif.body}</p>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Clock className="w-3 h-3" />
              {timeAgo(notif.createdAt)}
            </span>
            <div className="flex gap-1.5">
              {notif.actionUrl && (
                <Link href={notif.actionUrl}>
                  <Button size="sm" variant="ghost" className={`h-6 text-[11px] px-2 ${cfg.color} hover:bg-white/60`}>
                    Voir <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              )}
              {!notif.isRead && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] px-2 text-slate-500 hover:text-emerald-600"
                  onClick={() => onRead(notif.id)}
                >
                  <CheckCircle className="w-3 h-3" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] px-2 text-slate-400 hover:text-rose-500"
                onClick={() => onDismiss(notif.id)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────────
export default function MobileNotificationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const push = usePushNotifications();

  const { data, isLoading, refetch, isFetching } = useQuery<NotifData>({
    queryKey: ["/api/mobile/notifications"],
    refetchInterval: 30_000,
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const critical = notifications.filter(n => n.severity === "critical" || n.severity === "emergency");
  const tasks = notifications.filter(n => n.type === "task_assigned");
  const maintenance = notifications.filter(n => n.type === "maintenance_due");
  const others = notifications.filter(n => !["task_assigned", "maintenance_due"].includes(n.type) && n.severity !== "critical" && n.severity !== "emergency");

  const readMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/mobile/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/mobile/notifications"] }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/mobile/notifications/${id}/dismiss`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/mobile/notifications"] }),
  });

  const readAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/mobile/notifications/read-all", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/mobile/notifications"] });
      toast({ title: "Tout marqué comme lu" });
    },
  });

  // Listen to SW messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "NOTIFICATION_CLICK") {
        refetch();
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, [refetch]);

  const renderList = (items: MobileNotification[]) =>
    items.length === 0 ? (
      <div className="text-center py-12">
        <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Aucune notification dans cette catégorie</p>
      </div>
    ) : (
      <div className="space-y-3">
        {items.map(n => (
          <NotifItem
            key={n.id}
            notif={n}
            onRead={id => readMutation.mutate(id)}
            onDismiss={id => dismissMutation.mutate(id)}
          />
        ))}
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80">
      <ModernNavigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  Notifications mobiles
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-rose-500 text-white text-xs font-bold rounded-full">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </h1>
              </div>
            </div>
            <p className="text-slate-500 text-sm">
              Alertes critiques, affectations de tâches et rappels de maintenance en temps réel
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => readAllMutation.mutate()}
                disabled={readAllMutation.isPending}
                className="border-slate-200 text-slate-600 rounded-xl text-xs"
              >
                <CheckCheck className="w-4 h-4 mr-1.5" />
                Tout lire
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="border-slate-200 text-slate-600 rounded-xl"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* ── Summary row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Non lues", val: unreadCount, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
            { label: "Critiques", val: critical.length, color: "text-rose-600", bg: "bg-rose-50 border-rose-100" },
            { label: "Tâches",    val: tasks.length,    color: "text-violet-600", bg: "bg-violet-50 border-violet-100" },
            { label: "Total",     val: notifications.length, color: "text-slate-700", bg: "bg-slate-50 border-slate-100" },
          ].map(({ label, val, color, bg }) => (
            <div key={label} className={`${bg} border rounded-2xl p-4 text-center`}>
              <div className={`text-2xl font-bold ${color}`}>{val}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* ── Push subscription prompt ─────────────────────────────── */}
        {push.isSupported && !push.isSubscribed && push.permission !== "denied" && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-blue-800">Activez les notifications push</div>
              <div className="text-xs text-blue-600 mt-0.5">Recevez les alertes critiques même quand vous n'êtes pas sur la page</div>
            </div>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 rounded-xl flex-shrink-0"
              onClick={() => push.subscribe()}
              disabled={push.isLoading}
            >
              {push.isLoading ? "…" : <><Bell className="w-4 h-4 mr-1.5" />Activer</>}
            </Button>
          </div>
        )}

        {/* ── Main content ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notification feed */}
          <div className="lg:col-span-2">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : (
              <Tabs defaultValue="all">
                <TabsList className="bg-white border border-slate-200 rounded-xl p-1 mb-4 w-full">
                  <TabsTrigger value="all" className="flex-1 rounded-lg text-xs">
                    Toutes {notifications.length > 0 && `(${notifications.length})`}
                  </TabsTrigger>
                  {critical.length > 0 && (
                    <TabsTrigger value="critical" className="flex-1 rounded-lg text-xs text-rose-600">
                      🚨 Critiques ({critical.length})
                    </TabsTrigger>
                  )}
                  {tasks.length > 0 && (
                    <TabsTrigger value="tasks" className="flex-1 rounded-lg text-xs">
                      📋 Tâches ({tasks.length})
                    </TabsTrigger>
                  )}
                  {maintenance.length > 0 && (
                    <TabsTrigger value="maintenance" className="flex-1 rounded-lg text-xs">
                      📅 Maintenance ({maintenance.length})
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="all">{renderList(notifications)}</TabsContent>
                <TabsContent value="critical">{renderList(critical)}</TabsContent>
                <TabsContent value="tasks">{renderList(tasks)}</TabsContent>
                <TabsContent value="maintenance">{renderList(maintenance)}</TabsContent>
              </Tabs>
            )}
          </div>

          {/* Settings sidebar */}
          <div className="space-y-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-700">Paramètres push</h3>
              </div>
              <PushSettingsPanel />
            </div>

            {/* Quick links */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Accès rapides</h3>
              {[
                { href: "/work-orders", icon: ClipboardList, label: "Mes ordres de travail", color: "text-blue-600" },
                { href: "/mobile-notifications", icon: AlertTriangle, label: "Alertes actives", color: "text-rose-600" },
                { href: "/maintenance-recommendations", icon: Calendar, label: "Recommandations", color: "text-amber-600" },
                { href: "/gmao", icon: Wrench, label: "GMAO", color: "text-violet-600" },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link key={href} href={href}>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white transition-colors cursor-pointer">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-sm text-slate-700">{label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 ml-auto" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
