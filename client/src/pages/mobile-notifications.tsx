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
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

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
  critical_alert:    { label: "Alerte critique",      icon: AlertTriangle,  color: "text-etat-critique-texte",    bg: "bg-etat-critique-fond border-etat-critique-filet" },
  task_assigned:     { label: "Tâche affectée",        icon: ClipboardList,  color: "text-etat-encours-texte",    bg: "bg-etat-encours-fond border-etat-encours-filet" },
  maintenance_due:   { label: "Maintenance planifiée", icon: Calendar,       color: "text-etat-alerte-texte",   bg: "bg-etat-alerte-fond border-etat-alerte-filet" },
  work_order_update: { label: "Mise à jour OT",        icon: Wrench,         color: "text-signal-deep",  bg: "bg-paper-deep border-rule" },
  system:            { label: "Système",               icon: Info,           color: "text-ink-mute",   bg: "bg-paper border-rule" },
};

const SEV_DOT: Record<string, string> = {
  emergency: "bg-etat-critique-vif animate-pulse",
  critical:  "bg-etat-critique-vif animate-pulse",
  high:      "bg-etat-alerte-vif",
  medium:    "bg-etat-alerte-vif",
  low:       "bg-etat-nominal-vif",
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
    mutationFn: () => apiRequest("/api/push/test", { method: "POST", body: {} }),
    onSuccess: (data: any) => {
      if (data.pushSent) {
        toast({ title: "Notification envoyée", description: "Vérifiez vos notifications système." });
      } else {
        toast({ title: "Enregistrée", description: "Notification créée mais push non confirmé (vérifiez les permissions)." });
      }
      qc.invalidateQueries({ queryKey: ["/api/mobile/notifications"] });
    },
    onError: () => toast({ title: "Erreur", description: "Test échoué", variant: "destructive" }),
  });

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      const ok = await push.subscribe();
      if (ok) {
        toast({ title: "Notifications activées", description: "Vous recevrez les alertes sur cet appareil." });
        refetchDevices();
      } else {
        toast({ title: "Impossible d'activer", description: push.error || "Vérifiez les permissions du navigateur.", variant: "destructive" });
      }
    } else {
      await push.unsubscribe();
      toast({ title: "Notifications désactivées", description: "Cet appareil ne recevra plus d'alertes push." });
      refetchDevices();
    }
  };

  return (
    <div className="space-y-5">
      {/* Status Card */}
      <Card className={`border-2 ${push.isSubscribed ? "border-etat-nominal-filet bg-etat-nominal-fond" : "border-rule bg-white"}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-none flex items-center justify-center ${push.isSubscribed ? "bg-etat-nominal-fond" : "bg-paper-deep"}`}>
                {push.isSubscribed ? <BellRing className="w-5 h-5 text-etat-nominal-texte" /> : <BellOff className="w-5 h-5 text-ink-mute" />}
              </div>
              <div>
                <div className="font-semibold text-ink">
                  {push.isSubscribed ? "Notifications actives" : "Notifications désactivées"}
                </div>
                <div className="text-xs text-ink-mute">
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
        <div className="bg-etat-critique-fond border border-etat-critique-filet rounded-none p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-etat-critique-texte flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-etat-critique-texte">Permission refusée</div>
            <div className="text-xs text-etat-critique-texte mt-1">
              Autorisez les notifications dans les paramètres de votre navigateur, puis revenez ici pour activer.
            </div>
          </div>
        </div>
      )}

      {/* What you'll receive */}
      <Card className="border border-rule">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-ink-soft">Événements notifiés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { icon: AlertTriangle, color: "text-etat-critique-texte", label: "Alertes critiques", desc: "Pannes, seuils dépassés, urgences" },
            { icon: ClipboardList, color: "text-etat-encours-texte", label: "Affectation de tâches", desc: "Nouvel OT assigné à votre compte" },
            { icon: Calendar, color: "text-etat-alerte-texte", label: "Maintenance imminente", desc: "Rappels de planification préventive" },
            { icon: Wrench, color: "text-signal-deep", label: "Mises à jour d'OT", desc: "Changements de statut et validations" },
          ].map(({ icon: Icon, color, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon className={`w-4 h-4 ${color} flex-shrink-0 mt-0.5`} />
              <div>
                <div className="text-sm font-medium text-ink-soft">{label}</div>
                <div className="text-xs text-ink-mute">{desc}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Test button */}
      {push.isSubscribed && (
        <Button
          variant="outline"
          className="w-full border-etat-encours-filet text-etat-encours-texte hover:bg-etat-encours-fond rounded-none"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending}
        >
          <Zap className="w-4 h-4 mr-2" />
          {testMutation.isPending ? "Envoi en cours…" : "Envoyer une notification de test"}
        </Button>
      )}

      {/* Registered devices */}
      {devices.length > 0 && (
        <Card className="border border-rule">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-ink-soft flex items-center gap-2">
              <MonitorSmartphone className="w-4 h-4" />
              Appareils enregistrés ({devices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-2.5 bg-paper rounded-lg">
                <Smartphone className="w-4 h-4 text-ink-mute flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-ink-soft truncate">{d.deviceName}</div>
                  <div className="text-[10px] text-ink-mute">Dernière activité : {timeAgo(d.lastUsedAt)}</div>
                </div>
                <div className="w-2 h-2 bg-etat-nominal-vif rounded-full flex-shrink-0" />
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
    <div className={`relative border rounded-none p-4 transition-all duration-200 ${notif.isRead ? "bg-white border-slate-100 opacity-80" : `${cfg.bg} shadow-sm`}`}>
      {/* Unread dot */}
      {!notif.isRead && (
        <div className={`absolute top-3.5 right-3.5 w-2.5 h-2.5 ${dot} rounded-full`} />
      )}
      <div className="flex items-start gap-3 pr-4">
        <div className={`w-9 h-9 rounded-none flex items-center justify-center flex-shrink-0 ${notif.isRead ? "bg-paper-deep" : cfg.bg.replace("bg-", "bg-").replace("-50", "-100")}`}>
          <Icon className={`w-4.5 h-4.5 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-ink leading-snug">{notif.title}</span>
            <Badge className={`text-[10px] px-1.5 py-0 ${cfg.bg} ${cfg.color} border`}>{cfg.label}</Badge>
          </div>
          <p className="text-xs text-ink-soft leading-relaxed mb-2">{notif.body}</p>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[11px] text-ink-mute">
              <Clock className="w-3 h-3" />
              {timeAgo(notif.createdAt)}
            </span>
            <div className="flex gap-1.5">
              {notif.actionUrl && (
                <Link href={notif.actionUrl}>
                  <Button size="sm" variant="ghost" className={`h-6 text-[11px] px-2 ${cfg.color} hover:bg-white`}>
                    Voir <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              )}
              {!notif.isRead && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] px-2 text-ink-mute hover:text-etat-nominal-texte"
                  onClick={() => onRead(notif.id)}
                >
                  <CheckCircle className="w-3 h-3" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] px-2 text-ink-mute hover:text-etat-critique-texte"
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
    mutationFn: (id: number) => apiRequest(`/api/mobile/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/mobile/notifications"] }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/mobile/notifications/${id}/dismiss`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/mobile/notifications"] }),
  });

  const readAllMutation = useMutation({
    mutationFn: () => apiRequest("/api/mobile/notifications/read-all", { method: "POST" }),
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
        <CheckCircle className="w-10 h-10 text-etat-nominal-texte mx-auto mb-3" />
        <p className="text-ink-mute text-sm">Aucune notification dans cette catégorie</p>
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
    <AppShell filAriane={[{ libelle: "Ressources" }, { libelle: "Notifications" }]} largeur="large">
    <div className="space-y-6">
      <ModernNavigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-paper-deep rounded-none flex items-center justify-center shadow-blue-500/20">
                <Bell className="w-5 h-5 text-ink" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
                  Notifications mobiles
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-etat-critique-vif text-white text-xs font-bold rounded-full">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </h1>
              </div>
            </div>
            <p className="text-ink-mute text-sm">
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
                className="border-rule text-ink-soft rounded-none text-xs"
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
              className="border-rule text-ink-soft rounded-none"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* ── Summary row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Non lues", val: unreadCount, color: "text-etat-encours-texte", bg: "bg-etat-encours-fond border-etat-encours-filet" },
            { label: "Critiques", val: critical.length, color: "text-etat-critique-texte", bg: "bg-etat-critique-fond border-etat-critique-filet" },
            { label: "Tâches",    val: tasks.length,    color: "text-signal-deep", bg: "bg-paper-deep border-paper-deep" },
            { label: "Total",     val: notifications.length, color: "text-ink-soft", bg: "bg-paper border-slate-100" },
          ].map(({ label, val, color, bg }) => (
            <div key={label} className={`${bg} border rounded-none p-4 text-center`}>
              <div className={`text-2xl font-bold ${color}`}>{val}</div>
              <div className="text-xs text-ink-mute mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* ── Push subscription prompt ─────────────────────────────── */}
        {push.isSupported && !push.isSubscribed && push.permission !== "denied" && (
          <div className="mb-6 bg-paper-deep border border-etat-encours-filet rounded-none p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-etat-encours-fond rounded-none flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-etat-encours-texte" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-etat-encours-texte">Activez les notifications push</div>
              <div className="text-xs text-etat-encours-texte mt-0.5">Recevez les alertes critiques même quand vous n'êtes pas sur la page</div>
            </div>
            <Button
              size="sm"
              className="bg-etat-encours-vif hover:bg-etat-encours-vif rounded-none flex-shrink-0"
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
                  <div key={i} className="h-24 bg-paper-deep rounded-none animate-pulse" />
                ))}
              </div>
            ) : (
              <Tabs defaultValue="all">
                <TabsList className="bg-white border border-rule rounded-none p-1 mb-4 w-full">
                  <TabsTrigger value="all" className="flex-1 rounded-lg text-xs">
                    Toutes {notifications.length > 0 && `(${notifications.length})`}
                  </TabsTrigger>
                  {critical.length > 0 && (
                    <TabsTrigger value="critical" className="flex-1 rounded-lg text-xs text-etat-critique-texte">
                      Critiques ({critical.length})
                    </TabsTrigger>
                  )}
                  {tasks.length > 0 && (
                    <TabsTrigger value="tasks" className="flex-1 rounded-lg text-xs">
                      Tâches ({tasks.length})
                    </TabsTrigger>
                  )}
                  {maintenance.length > 0 && (
                    <TabsTrigger value="maintenance" className="flex-1 rounded-lg text-xs">
                      Maintenance ({maintenance.length})
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
            <div className="bg-white border border-rule rounded-none p-4">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-ink-soft" />
                <h3 className="text-sm font-semibold text-ink-soft">Paramètres push</h3>
              </div>
              <PushSettingsPanel />
            </div>

            {/* Quick links */}
            <div className="bg-paper border border-rule rounded-none p-4 space-y-2">
              <h3 className="text-xs font-semibold text-ink-mute uppercase tracking-wider mb-3">Accès rapides</h3>
              {[
                { href: "/work-orders", icon: ClipboardList, label: "Mes ordres de travail", color: "text-etat-encours-texte" },
                { href: "/mobile-notifications", icon: AlertTriangle, label: "Alertes actives", color: "text-etat-critique-texte" },
                { href: "/maintenance-recommendations", icon: Calendar, label: "Recommandations", color: "text-etat-alerte-texte" },
                { href: "/gmao", icon: Wrench, label: "GMAO", color: "text-signal-deep" },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link key={href} href={href}>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-none hover:bg-white transition-colors cursor-pointer">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-sm text-ink-soft">{label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-ink-mute ml-auto" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
    </AppShell>
  );
}
