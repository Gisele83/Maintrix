import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, Trash2, TestTube, Send, MessageSquare,
  CheckCircle, XCircle, Wifi, WifiOff, Bell, BarChart3,
  Clock, AlertTriangle, Settings, Hash, Bot
} from "lucide-react";

type CommunicationChannel = {
  id: number;
  name: string;
  platform: string;
  webhookUrl?: string;
  botToken?: string;
  channelId?: string;
  chatId?: string;
  isEnabled: boolean;
  severityFilter: string[];
  eventFilter: string[];
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
};

type DeliveryLog = {
  id: number;
  channelId: number;
  platform: string;
  eventType: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  errorMessage?: string;
  responseCode?: number;
  sentAt: string;
};

const PLATFORMS = [
  { value: "slack", label: "Slack", icon: "💬", color: "from-purple-500 to-violet-600", description: "Envoyez des alertes vers vos canaux Slack via webhook" },
  { value: "teams", label: "Microsoft Teams", icon: "💼", color: "from-blue-500 to-indigo-600", description: "Notifications vers vos équipes Teams via connecteur webhook" },
  { value: "telegram", label: "Telegram", icon: "✈️", color: "from-sky-400 to-blue-500", description: "Messages instantanés via bot Telegram" },
  { value: "whatsapp", label: "WhatsApp", icon: "📱", color: "from-green-500 to-emerald-600", description: "Alertes WhatsApp Business via API webhook" },
  { value: "webhook", label: "Webhook Personnalisé", icon: "🔗", color: "from-gray-500 to-slate-600", description: "Envoi JSON vers n'importe quelle URL webhook" }
];

const SEVERITIES = [
  { value: "info", label: "Info", color: "bg-blue-100 text-blue-700" },
  { value: "warning", label: "Warning", color: "bg-amber-100 text-amber-700" },
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-700" },
  { value: "emergency", label: "Emergency", color: "bg-red-200 text-red-800" }
];

const EVENT_TYPES = [
  { value: "threshold_breach", label: "Seuil dépassé" },
  { value: "predictive_alert", label: "Alerte prédictive" },
  { value: "maintenance_due", label: "Maintenance due" },
  { value: "work_order_update", label: "Mise à jour OT" },
  { value: "equipment_failure", label: "Panne équipement" },
  { value: "iot_anomaly", label: "Anomalie IoT" }
];

function getPlatformInfo(platform: string) {
  return PLATFORMS.find(p => p.value === platform) || PLATFORMS[4];
}

export default function CommunicationIntegrations() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newChannel, setNewChannel] = useState({
    name: "", platform: "slack", webhookUrl: "", botToken: "", channelId: "", chatId: "",
    severityFilter: ["critical", "warning"],
    eventFilter: ["threshold_breach", "predictive_alert", "maintenance_due"]
  });

  const { data: channels = [], isLoading } = useQuery<CommunicationChannel[]>({
    queryKey: ["/api/communication-channels"]
  });

  const { data: deliveryLogs = [] } = useQuery<DeliveryLog[]>({
    queryKey: ["/api/communication-channels/delivery/logs"]
  });

  const { data: stats } = useQuery<{ total: number; sent: number; failed: number; byPlatform: Record<string, { sent: number; failed: number }> }>({
    queryKey: ["/api/communication-channels/delivery/stats"]
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/communication-channels", { method: "POST", body: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communication-channels"] });
      setShowAddDialog(false);
      setNewChannel({ name: "", platform: "slack", webhookUrl: "", botToken: "", channelId: "", chatId: "", severityFilter: ["critical", "warning"], eventFilter: ["threshold_breach", "predictive_alert", "maintenance_due"] });
      toast({ title: "Canal créé", description: "Le canal de communication a été ajouté avec succès." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/communication-channels/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communication-channels"] });
      toast({ title: "Canal supprimé" });
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: number; isEnabled: boolean }) => {
      return await apiRequest(`/api/communication-channels/${id}`, { method: "PATCH", body: { isEnabled } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communication-channels"] });
    }
  });

  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/communication-channels/${id}/test`, { method: "POST" });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/communication-channels/delivery/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communication-channels/delivery/stats"] });
      if (data.status === 'sent') {
        toast({ title: "Test réussi", description: "Le message de test a été envoyé avec succès." });
      } else {
        toast({ title: "Test échoué", description: data.error || "Vérifiez la configuration du canal.", variant: "destructive" });
      }
    },
    onError: (e: any) => toast({ title: "Erreur de test", description: e.message, variant: "destructive" })
  });

  function toggleSeverity(severity: string) {
    setNewChannel(prev => ({
      ...prev,
      severityFilter: prev.severityFilter.includes(severity)
        ? prev.severityFilter.filter(s => s !== severity)
        : [...prev.severityFilter, severity]
    }));
  }

  function toggleEvent(event: string) {
    setNewChannel(prev => ({
      ...prev,
      eventFilter: prev.eventFilter.includes(event)
        ? prev.eventFilter.filter(e => e !== event)
        : [...prev.eventFilter, event]
    }));
  }

  const enabledCount = channels.filter(c => c.isEnabled).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/gmao">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Intégrations Communication
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Connectez vos plateformes pour recevoir des alertes instantanées et collaborer
            </p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <Plus className="h-4 w-4 mr-2" /> Ajouter un canal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ajouter un canal de communication</DialogTitle>
                <DialogDescription>Configurez un nouveau canal pour recevoir les alertes Maintrix</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nom du canal</Label>
                  <Input placeholder="Ex: Alertes Maintenance" value={newChannel.name} onChange={e => setNewChannel(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Plateforme</Label>
                  <Select value={newChannel.platform} onValueChange={v => setNewChannel(p => ({ ...p, platform: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.icon} {p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">{getPlatformInfo(newChannel.platform).description}</p>
                </div>

                {(newChannel.platform === 'slack' || newChannel.platform === 'teams' || newChannel.platform === 'whatsapp' || newChannel.platform === 'webhook') && (
                  <div>
                    <Label>URL Webhook</Label>
                    <Input placeholder={newChannel.platform === 'slack' ? 'https://hooks.slack.com/services/...' : newChannel.platform === 'teams' ? 'https://outlook.office.com/webhook/...' : 'https://...'} value={newChannel.webhookUrl} onChange={e => setNewChannel(p => ({ ...p, webhookUrl: e.target.value }))} />
                  </div>
                )}

                {newChannel.platform === 'telegram' && (
                  <>
                    <div>
                      <Label>Bot Token</Label>
                      <Input placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" value={newChannel.botToken} onChange={e => setNewChannel(p => ({ ...p, botToken: e.target.value }))} />
                      <p className="text-xs text-gray-500 mt-1">Obtenez un token via @BotFather sur Telegram</p>
                    </div>
                    <div>
                      <Label>Chat ID</Label>
                      <Input placeholder="-1001234567890" value={newChannel.chatId} onChange={e => setNewChannel(p => ({ ...p, chatId: e.target.value }))} />
                    </div>
                  </>
                )}

                {newChannel.platform === 'whatsapp' && (
                  <div>
                    <Label>Chat ID (optionnel)</Label>
                    <Input placeholder="Identifiant de conversation" value={newChannel.chatId} onChange={e => setNewChannel(p => ({ ...p, chatId: e.target.value }))} />
                  </div>
                )}

                <div>
                  <Label className="mb-2 block">Filtres de sévérité</Label>
                  <div className="flex flex-wrap gap-2">
                    {SEVERITIES.map(s => (
                      <Badge key={s.value} variant={newChannel.severityFilter.includes(s.value) ? "default" : "outline"}
                        className={`cursor-pointer ${newChannel.severityFilter.includes(s.value) ? s.color : ''}`}
                        onClick={() => toggleSeverity(s.value)}>{s.label}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Types d'événements</Label>
                  <div className="flex flex-wrap gap-2">
                    {EVENT_TYPES.map(e => (
                      <Badge key={e.value} variant={newChannel.eventFilter.includes(e.value) ? "default" : "outline"}
                        className="cursor-pointer" onClick={() => toggleEvent(e.value)}>{e.label}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuler</Button>
                <Button onClick={() => createMutation.mutate(newChannel)} disabled={!newChannel.name || createMutation.isPending}>
                  {createMutation.isPending ? "Création..." : "Créer le canal"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg"><MessageSquare className="h-5 w-5 text-blue-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{channels.length}</p>
                  <p className="text-xs text-gray-500">Canaux configurés</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg"><Wifi className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{enabledCount}</p>
                  <p className="text-xs text-gray-500">Canaux actifs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/40 dark:to-violet-950/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg"><Send className="h-5 w-5 text-purple-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats?.sent || 0}</p>
                  <p className="text-xs text-gray-500">Messages envoyés</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-950/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats?.failed || 0}</p>
                  <p className="text-xs text-gray-500">Échecs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="channels" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="channels"><MessageSquare className="h-4 w-4 mr-1" /> Canaux</TabsTrigger>
            <TabsTrigger value="logs"><Clock className="h-4 w-4 mr-1" /> Historique</TabsTrigger>
            <TabsTrigger value="platforms"><Settings className="h-4 w-4 mr-1" /> Plateformes</TabsTrigger>
          </TabsList>

          <TabsContent value="channels">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="border-0 shadow-md animate-pulse">
                    <CardContent className="p-6"><div className="h-32 bg-gray-200 rounded" /></CardContent>
                  </Card>
                ))}
              </div>
            ) : channels.length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-12 text-center">
                  <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Aucun canal configuré</h3>
                  <p className="text-gray-500 mb-6">Ajoutez votre premier canal pour recevoir des alertes instantanées sur vos plateformes préférées.</p>
                  <Button onClick={() => setShowAddDialog(true)} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                    <Plus className="h-4 w-4 mr-2" /> Ajouter un canal
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {channels.map((channel) => {
                  const platform = getPlatformInfo(channel.platform);
                  return (
                    <Card key={channel.id} className="border-0 shadow-md hover:shadow-lg transition-all">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${platform.color} text-white text-lg`}>
                              {platform.icon}
                            </div>
                            <div>
                              <CardTitle className="text-base">{channel.name}</CardTitle>
                              <CardDescription className="text-xs">{platform.label}</CardDescription>
                            </div>
                          </div>
                          <Switch checked={channel.isEnabled} onCheckedChange={(checked) => toggleMutation.mutate({ id: channel.id, isEnabled: checked })} />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-3">
                        <div className="flex items-center gap-1.5">
                          {channel.isEnabled ? <Wifi className="h-3.5 w-3.5 text-green-500" /> : <WifiOff className="h-3.5 w-3.5 text-gray-400" />}
                          <span className={`text-xs ${channel.isEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                            {channel.isEnabled ? 'Actif' : 'Désactivé'}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Sévérités:</p>
                          <div className="flex flex-wrap gap-1">
                            {(channel.severityFilter || []).map((s: string) => {
                              const sev = SEVERITIES.find(sv => sv.value === s);
                              return <Badge key={s} variant="secondary" className={`text-[10px] ${sev?.color || ''}`}>{sev?.label || s}</Badge>;
                            })}
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="outline" className="flex-1 text-xs"
                            onClick={() => testMutation.mutate(channel.id)} disabled={testMutation.isPending}>
                            <TestTube className="h-3 w-3 mr-1" /> Tester
                          </Button>
                          <Button size="sm" variant="destructive" className="text-xs"
                            onClick={() => deleteMutation.mutate(channel.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5" /> Historique des envois</CardTitle>
              </CardHeader>
              <CardContent>
                {deliveryLogs.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Aucun envoi enregistré</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {deliveryLogs.map((log) => (
                      <div key={log.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        {log.status === 'sent' ? (
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{log.title}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{getPlatformInfo(log.platform).icon} {getPlatformInfo(log.platform).label}</span>
                            <span>•</span>
                            <Badge variant="outline" className="text-[10px]">{log.severity}</Badge>
                            <span>•</span>
                            <span>{new Date(log.sentAt).toLocaleString('fr-FR')}</span>
                          </div>
                          {log.errorMessage && (
                            <p className="text-xs text-red-500 mt-1 truncate">{log.errorMessage}</p>
                          )}
                        </div>
                        <Badge variant={log.status === 'sent' ? 'default' : 'destructive'} className="text-[10px] shrink-0">
                          {log.status === 'sent' ? 'Envoyé' : 'Échoué'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="platforms">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PLATFORMS.map((platform) => {
                const channelCount = channels.filter(c => c.platform === platform.value).length;
                const platformStats = stats?.byPlatform?.[platform.value];
                return (
                  <Card key={platform.value} className="border-0 shadow-md hover:shadow-lg transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${platform.color} text-white text-2xl`}>
                          {platform.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold">{platform.label}</h3>
                          <p className="text-xs text-gray-500">{channelCount} canal{channelCount !== 1 ? 'x' : ''} configuré{channelCount !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{platform.description}</p>
                      {platformStats && (
                        <div className="flex gap-4 text-xs">
                          <span className="text-green-600">{platformStats.sent} envoyés</span>
                          <span className="text-red-600">{platformStats.failed} échoués</span>
                        </div>
                      )}
                      <div className="mt-4">
                        <Button size="sm" variant="outline" className="w-full" onClick={() => { setNewChannel(p => ({ ...p, platform: platform.value })); setShowAddDialog(true); }}>
                          <Plus className="h-3 w-3 mr-1" /> Configurer
                        </Button>
                      </div>

                      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-xs font-medium mb-2">Guide de configuration:</p>
                        {platform.value === 'slack' && (
                          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                            <li>Créez une app Slack sur api.slack.com</li>
                            <li>Activez "Incoming Webhooks"</li>
                            <li>Copiez l'URL webhook générée</li>
                          </ol>
                        )}
                        {platform.value === 'teams' && (
                          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                            <li>Ouvrez le canal Teams souhaité</li>
                            <li>Ajoutez le connecteur "Incoming Webhook"</li>
                            <li>Copiez l'URL webhook fournie</li>
                          </ol>
                        )}
                        {platform.value === 'telegram' && (
                          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                            <li>Contactez @BotFather sur Telegram</li>
                            <li>Créez un nouveau bot et récupérez le token</li>
                            <li>Ajoutez le bot à votre groupe/canal</li>
                            <li>Récupérez le Chat ID du groupe</li>
                          </ol>
                        )}
                        {platform.value === 'whatsapp' && (
                          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                            <li>Configurez l'API WhatsApp Business</li>
                            <li>Obtenez votre URL webhook</li>
                            <li>Collez l'URL dans la configuration</li>
                          </ol>
                        )}
                        {platform.value === 'webhook' && (
                          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                            <li>Préparez un endpoint HTTP POST</li>
                            <li>Il recevra un JSON structuré</li>
                            <li>Collez l'URL de votre endpoint</li>
                          </ol>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
