import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Monitor, Apple, Smartphone, Globe, Download, CheckCircle2,
  Shield, Zap, Clock, ArrowRight, Star, Package, Cpu, HardDrive,
  Wifi, Lock, RefreshCw, ChevronRight, ExternalLink
} from "lucide-react";

const VERSION = "2.4.1";
const RELEASE_DATE = "Mai 2025";

interface Platform {
  id: string;
  name: string;
  icon: any;
  color: string;
  bg: string;
  files: DownloadFile[];
  requirements: string[];
  installSteps: string[];
}

interface DownloadFile {
  label: string;
  filename: string;
  size: string;
  arch?: string;
  recommended?: boolean;
  url: string;
}

const platforms: Platform[] = [
  {
    id: "windows",
    name: "Windows",
    icon: Monitor,
    color: "text-blue-600",
    bg: "from-blue-500 to-cyan-600",
    files: [
      { label: "Installateur Windows", filename: `Maintrix-${VERSION}-Setup-x64.exe`, size: "142 MB", arch: "64-bit", recommended: true, url: "#" },
      { label: "Installateur Windows (32-bit)", filename: `Maintrix-${VERSION}-Setup-x86.exe`, size: "138 MB", arch: "32-bit", url: "#" },
      { label: "Archive portable (.zip)", filename: `Maintrix-${VERSION}-Windows-portable.zip`, size: "156 MB", arch: "64-bit", url: "#" },
    ],
    requirements: ["Windows 10 / 11 (64-bit recommandé)", "4 Go de RAM minimum (8 Go recommandés)", "2 Go d'espace disque", "Connexion internet pour la synchronisation cloud", ".NET 6+ (inclus dans l'installateur)"],
    installSteps: ["Téléchargez le fichier .exe ci-dessous", "Double-cliquez sur l'installateur", "Suivez l'assistant d'installation", "Lancez Maintrix et connectez-vous avec vos identifiants"],
  },
  {
    id: "mac",
    name: "macOS",
    icon: Apple,
    color: "text-slate-700",
    bg: "from-slate-600 to-slate-800",
    files: [
      { label: "Mac Apple Silicon (M1/M2/M3)", filename: `Maintrix-${VERSION}-arm64.dmg`, size: "128 MB", arch: "Apple Silicon", recommended: true, url: "#" },
      { label: "Mac Intel", filename: `Maintrix-${VERSION}-x64.dmg`, size: "134 MB", arch: "Intel x64", url: "#" },
      { label: "Universal (Intel + Apple Silicon)", filename: `Maintrix-${VERSION}-universal.dmg`, size: "248 MB", url: "#" },
    ],
    requirements: ["macOS 12 Monterey ou supérieur", "4 Go de RAM (8 Go recommandés)", "1,5 Go d'espace disque", "Connexion internet requise"],
    installSteps: ["Téléchargez le fichier .dmg adapté à votre processeur", "Montez le disque image (.dmg)", "Glissez Maintrix dans Applications", "Ouvrez Maintrix et acceptez les permissions Gatekeeper"],
  },
  {
    id: "linux",
    name: "Linux",
    icon: Cpu,
    color: "text-orange-600",
    bg: "from-orange-500 to-red-600",
    files: [
      { label: "Debian / Ubuntu (.deb)", filename: `maintrix_${VERSION}_amd64.deb`, size: "119 MB", recommended: true, url: "#" },
      { label: "Red Hat / Fedora (.rpm)", filename: `maintrix-${VERSION}.x86_64.rpm`, size: "121 MB", url: "#" },
      { label: "AppImage (universel)", filename: `Maintrix-${VERSION}.AppImage`, size: "145 MB", url: "#" },
      { label: "Archive (.tar.gz)", filename: `Maintrix-${VERSION}-linux-x64.tar.gz`, size: "116 MB", url: "#" },
    ],
    requirements: ["Ubuntu 20.04+ / Debian 11+ / Fedora 36+", "Kernel Linux 5.4+", "4 Go de RAM", "glibc 2.31+"],
    installSteps: [
      "Debian/Ubuntu : sudo dpkg -i maintrix_*.deb",
      "Fedora/RHEL : sudo rpm -i maintrix-*.rpm",
      "AppImage : chmod +x Maintrix-*.AppImage && ./Maintrix-*.AppImage",
      "Connectez-vous avec vos identifiants Maintrix",
    ],
  },
  {
    id: "android",
    name: "Android",
    icon: Smartphone,
    color: "text-green-600",
    bg: "from-green-500 to-emerald-600",
    files: [
      { label: "Google Play Store", filename: "com.maintrix.app", size: "Automatique", recommended: true, url: "https://play.google.com/store" },
      { label: "APK Direct (Android 8+)", filename: `Maintrix-${VERSION}.apk`, size: "48 MB", url: "#" },
    ],
    requirements: ["Android 8.0 (Oreo) ou supérieur", "2 Go de RAM", "200 Mo d'espace disponible", "Accès internet pour la synchronisation", "Caméra pour lecture QR (optionnel)"],
    installSteps: ["Téléchargez depuis le Google Play Store", "Ou activez 'Sources inconnues' et installez l'APK", "Ouvrez l'app et connectez-vous", "Synchronisation automatique avec votre compte web"],
  },
  {
    id: "ios",
    name: "iOS / iPadOS",
    icon: Smartphone,
    color: "text-purple-600",
    bg: "from-purple-500 to-pink-600",
    files: [
      { label: "App Store", filename: "com.maintrix.ios", size: "Automatique", recommended: true, url: "https://apps.apple.com" },
    ],
    requirements: ["iOS 15 / iPadOS 15 ou supérieur", "iPhone 8 / iPad (6e gen.) ou plus récent", "Connexion internet pour la synchronisation"],
    installSteps: ["Ouvrez l'App Store sur votre iPhone ou iPad", "Recherchez 'Maintrix'", "Appuyez sur 'Obtenir'", "Connectez-vous avec vos identifiants Maintrix"],
  },
  {
    id: "web",
    name: "Version Web",
    icon: Globe,
    color: "text-indigo-600",
    bg: "from-indigo-500 to-blue-600",
    files: [
      { label: "Accès Web Direct", filename: "app.maintrix.io", size: "—", recommended: true, url: "/gmao-dashboard" },
    ],
    requirements: ["Navigateur moderne (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)", "Connexion internet", "Aucune installation requise"],
    installSteps: ["Connectez-vous sur app.maintrix.io", "Ajoutez le raccourci à votre écran d'accueil (mobile)", "Toutes vos données synchronisées automatiquement"],
  },
];

const features = [
  { icon: RefreshCw, label: "Sync temps réel", desc: "Données synchronisées entre toutes vos installations" },
  { icon: Wifi, label: "Mode hors ligne", desc: "Continuez à travailler sans connexion, sync automatique à la reconnexion" },
  { icon: Lock, label: "Chiffrement E2E", desc: "Vos données industrielles protégées de bout en bout" },
  { icon: Zap, label: "Mises à jour auto", desc: "Toujours à jour avec les dernières fonctionnalités" },
];

function DownloadButton({ file, isSubscribed }: { file: DownloadFile; isSubscribed: boolean }) {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    if (!isSubscribed) return;
    setClicked(true);
    setTimeout(() => setClicked(false), 2000);
  };

  if (!isSubscribed) {
    return (
      <Link href="/register">
        <Button variant="outline" className="w-full justify-between gap-2 h-auto py-3 px-4 hover:bg-blue-50 border-blue-200 group">
          <div className="flex items-center gap-3">
            <Lock className="h-4 w-4 text-blue-500" />
            <div className="text-left">
              <p className="text-sm font-medium text-slate-700">{file.label}</p>
              <p className="text-xs text-slate-400">{file.filename}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {file.recommended && <Badge className="bg-blue-100 text-blue-700 text-xs">Recommandé</Badge>}
            <span className="text-xs text-blue-600 font-medium group-hover:underline">S'abonner</span>
          </div>
        </Button>
      </Link>
    );
  }

  return (
    <Button
      variant="outline"
      className={`w-full justify-between gap-2 h-auto py-3 px-4 transition-all ${clicked ? "bg-green-50 border-green-300" : "hover:bg-slate-50"}`}
      onClick={handleClick}
      asChild={file.url !== "#"}
    >
      {file.url !== "#" ? (
        <a href={file.url} download={file.filename !== "com.maintrix.app" && file.filename !== "com.maintrix.ios" && file.filename !== "app.maintrix.io"} target={file.url.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
          <div className="flex items-center gap-3">
            {clicked ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <Download className="h-4 w-4 text-slate-500 shrink-0" />}
            <div className="text-left">
              <p className="text-sm font-medium text-slate-800">{file.label}</p>
              <p className="text-xs text-slate-400">{file.filename} {file.arch ? `· ${file.arch}` : ""} · {file.size}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {file.recommended && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Recommandé</Badge>}
            {clicked ? <span className="text-xs text-green-600 font-medium">Démarré ✓</span> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </div>
        </a>
      ) : (
        <span className="flex w-full items-center justify-between">
          <div className="flex items-center gap-3">
            {clicked ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <Download className="h-4 w-4 text-slate-500 shrink-0" />}
            <div className="text-left">
              <p className="text-sm font-medium text-slate-800">{file.label}</p>
              <p className="text-xs text-slate-400">{file.filename} {file.arch ? `· ${file.arch}` : ""} · {file.size}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {file.recommended && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Recommandé</Badge>}
            {clicked ? <span className="text-xs text-green-600 font-medium">Démarré ✓</span> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </div>
        </span>
      )}
    </Button>
  );
}

export default function DownloadCenterPage() {
  const { user } = useAuth();
  const isSubscribed = !!user;
  const [activePlatform, setActivePlatform] = useState("windows");
  const platform = platforms.find(p => p.id === activePlatform)!;
  const PlatformIcon = platform.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]" />
        <div className="relative max-w-6xl mx-auto px-6 py-20 text-center">
          <Badge className="mb-6 bg-blue-500/20 text-blue-300 border-blue-500/30 text-sm px-4 py-1.5">
            🚀 Version {VERSION} — {RELEASE_DATE}
          </Badge>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Télécharger <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Maintrix</span>
          </h1>
          <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
            Disponible sur toutes vos plateformes — Windows, macOS, Linux, Android et iOS. Une seule licence, tous vos appareils.
          </p>

          {!isSubscribed && (
            <div className="inline-flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-6 py-3 mb-8">
              <Lock className="h-5 w-5 text-amber-400" />
              <span className="text-amber-300 text-sm">Un abonnement actif est requis pour télécharger</span>
              <Link href="/register">
                <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold ml-2">
                  S'abonner maintenant <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          )}

          {isSubscribed && (
            <div className="inline-flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-6 py-3 mb-8">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              <span className="text-green-300 text-sm">Abonnement actif — tous les téléchargements déverrouillés</span>
            </div>
          )}

          {/* Platform pills */}
          <div className="flex flex-wrap justify-center gap-3">
            {platforms.map(p => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePlatform(p.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border transition-all ${activePlatform === p.id ? `bg-gradient-to-r ${p.bg} text-white border-transparent shadow-lg shadow-blue-500/25` : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"}`}
                >
                  <Icon className="h-4 w-4" />
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Download panel */}
          <div className="lg:col-span-2">
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${platform.bg} shadow-lg`}>
                    <PlatformIcon className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-white text-xl">{platform.name}</CardTitle>
                    <p className="text-slate-400 text-sm">Version {VERSION} · {RELEASE_DATE}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-400 text-sm mb-4">Choisissez le fichier adapté à votre configuration :</p>
                {platform.files.map((file, i) => (
                  <DownloadButton key={i} file={file} isSubscribed={isSubscribed} />
                ))}
              </CardContent>
            </Card>

            {/* Installation steps */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm mt-4">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-400" />
                  Guide d'installation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {platform.installSteps.map((step, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className={`shrink-0 w-6 h-6 rounded-full bg-gradient-to-br ${platform.bg} text-white text-xs flex items-center justify-center font-bold`}>{i + 1}</span>
                      <p className="text-slate-300 text-sm pt-0.5">{step}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Requirements */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-purple-400" />
                  Configuration requise
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {platform.requirements.map((req, i) => (
                    <li key={i} className="flex gap-2 items-start text-sm text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      {req}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Features */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-400" />
                  Inclus dans toutes les versions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {features.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                      <Icon className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{label}</p>
                      <p className="text-slate-400 text-xs">{desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Version info */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Version</span><span className="text-white font-mono">{VERSION}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Date de sortie</span><span className="text-white">{RELEASE_DATE}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Licence</span><span className="text-emerald-400">SaaS · Multi-plateforme</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Mises à jour</span><span className="text-blue-400">Automatiques</span></div>
                </div>
                <a href="#changelog" className="mt-4 flex items-center gap-1 text-xs text-blue-400 hover:underline">
                  <ExternalLink className="h-3 w-3" /> Voir les notes de version
                </a>
              </CardContent>
            </Card>

            {/* Web access */}
            <Card className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border-blue-500/30 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <Globe className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                <p className="text-white font-semibold text-sm mb-1">Version Web toujours disponible</p>
                <p className="text-slate-400 text-xs mb-3">Sans installation, depuis n'importe quel navigateur</p>
                <Link href={isSubscribed ? "/gmao-dashboard" : "/register"}>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white w-full">
                    {isSubscribed ? "Accéder à l'application" : "Essayer gratuitement"}
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Changelog section */}
        <div id="changelog" className="mt-10">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-400" />
            Notes de version — v{VERSION}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { tag: "Nouveau", color: "bg-green-500/20 text-green-300 border-green-500/30", items: ["Plan de Maintenance Annuel (PMA)", "Portail Fournisseurs & sous-traitants", "Gestion budgétaire avec suivi des dépenses", "Gestion des garanties équipements"] },
              { tag: "Amélioré", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", items: ["Performance du moteur de diagnostic IA", "Synchronisation hors-ligne sur mobile", "Tableau de bord GMAO unifié", "Module calibration & habilitations"] },
              { tag: "Corrigé", color: "bg-amber-500/20 text-amber-300 border-amber-500/30", items: ["Limitation de requêtes en développement", "Affichage des modules dans la navigation", "Synchronisation des alertes IoT", "Rapports PDF sur macOS"] },
            ].map(({ tag, color, items }) => (
              <Card key={tag} className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <Badge className={`${color} border text-xs w-fit`}>{tag}</Badge>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {items.map((item, i) => (
                      <li key={i} className="text-slate-300 text-sm flex gap-2">
                        <span className="text-slate-500 shrink-0">·</span>{item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
