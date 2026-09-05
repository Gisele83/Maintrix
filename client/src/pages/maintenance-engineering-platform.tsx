import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Boxes, Wrench, Gauge, ClipboardList, BookOpen, Box, Brain, BarChart3,
  ArrowRight, Network, Construction, Link2,
} from "lucide-react";
import { useEntitlements } from "@/hooks/useEntitlements";
import { PlatformEditionBadge } from "@/components/platform-edition-badge";
import { PillarCollaborationMap } from "@/components/pillar-collaboration-map";

interface Pillar {
  key: string;
  title: string;
  description: string;
  icon: any;
  status: "disponible" | "a_construire";
  statusDetail: string;
  links: { label: string; href: string }[];
  /**
   * Domaines avec lesquels ce pilier collabore réellement (échanges de données vérifiés dans le
   * code, pas une supposition) — voir chaque fichier:ligne cité dans le plan
   * eager-wandering-thimble.md. Jamais présenté comme une "dépendance", toujours comme une
   * collaboration fonctionnelle.
   */
  connections: string[];
}

const PILLARS: Pillar[] = [
  {
    key: "actifs",
    title: "Gestion des actifs",
    description: "Registre des équipements et cycle de vie (acquisition → exploitation → fin de vie).",
    icon: Boxes,
    status: "disponible",
    statusDetail: "CRUD équipements opérationnel — cycle de vie ISO 55000 complet non encore construit.",
    links: [{ label: "Ouvrir", href: "/asset-lifecycle" }],
    connections: ["digital_twin", "ia", "apm", "analytics"],
  },
  {
    key: "gmao",
    title: "GMAO",
    description: "Ordres de travail, planification, exécution terrain (Réception → ... → REX).",
    icon: Wrench,
    status: "disponible",
    statusDetail: "Cœur historique de Maintrix, désormais un pilier parmi d'autres.",
    links: [
      { label: "Tableau de bord", href: "/gmao-dashboard" },
      { label: "Ordres de travail", href: "/work-orders" },
      { label: "Maintenance Execution", href: "/maintenance-execution" },
    ],
    connections: ["apm", "ia", "smm", "analytics"],
  },
  {
    key: "apm",
    title: "APM — Asset Performance Management",
    description: "Health Score, RUL, détection d'anomalies, prédiction de panne, OT automatique — pipeline unifié.",
    icon: Gauge,
    status: "disponible",
    statusDetail: "Predictive Maintenance Engine unifié : les 5 briques (Health Score → RUL → Anomaly → Failure Prediction → OT auto) tournent maintenant ensemble. Le RUL stochastique est désormais recoupé avec celui du Digital Twin quand un jumeau existe pour l'équipement.",
    links: [
      { label: "Predictive Engine", href: "/predictive-engine" },
      { label: "Health Score (legacy)", href: "/machine-health" },
    ],
    connections: ["gmao", "actifs", "digital_twin"],
  },
  {
    key: "smm",
    title: "SMM — Système de Management de Maintenance",
    description: "Manuels qualité, procédures, checklists, audits, non-conformités, amélioration continue.",
    icon: ClipboardList,
    status: "disponible",
    statusDetail: "Non-conformités auto-créées depuis un contrôle qualité échoué en Maintenance Execution ; procédures publiées synchronisées vers le Knowledge Graph.",
    links: [{ label: "Ouvrir", href: "/smm" }],
    connections: ["gmao", "ia"],
  },
  {
    key: "knowledge_hub",
    title: "Engineering Knowledge Hub",
    description: "Schémas, plans, notices, bulletins techniques, normes IEC/ISO, procédures SAEM.",
    icon: BookOpen,
    status: "disponible",
    statusDetail: "Recherche sémantique (embeddings OpenAI) avec repli automatique par mots-clés ; consulté par le pipeline diagnostic avant l'appel à Claude.",
    links: [{ label: "Ouvrir", href: "/knowledge-hub" }],
    connections: ["ia"],
  },
  {
    key: "digital_twin",
    title: "Digital Twin",
    description: "Jumeau numérique par équipement — propriété de l'actif, pas seulement une fonction IA.",
    icon: Box,
    status: "disponible",
    statusDetail: "Un jumeau par équipement (calibration propre + capteurs IoT réels), consulté par le pipeline diagnostic. Déviation critique → création automatique d'un OT GMAO ; RUL du jumeau recoupé par l'APM.",
    links: [{ label: "Ouvrir", href: "/digital-twin" }],
    connections: ["actifs", "ia", "gmao", "apm"],
  },
  {
    key: "ia",
    title: "IA",
    description: "Pipeline diagnostic hybride (règles + historique + graphe causal + Claude), assistant conversationnel.",
    icon: Brain,
    status: "disponible",
    statusDetail: "Le graphe de connaissances alimente désormais réellement le diagnostic.",
    links: [
      { label: "Diagnostic", href: "/smart-diagnostic" },
      { label: "Assistant IA", href: "/ai-assistant" },
      { label: "Knowledge Graph", href: "/knowledge-graph" },
    ],
    connections: ["actifs", "digital_twin", "gmao", "knowledge_hub", "smm", "analytics"],
  },
  {
    key: "analytics",
    title: "Analytics",
    description: "KPIs, rapports de maintenance, tableaux de bord consolidés.",
    icon: BarChart3,
    status: "disponible",
    statusDetail: "Reporting opérationnel existant, désormais enrichi des statistiques réelles de diagnostic IA (sessions, confiance, taux de complétion).",
    links: [{ label: "Ouvrir", href: "/advanced-reporting" }],
    connections: ["gmao", "actifs", "ia"],
  },
];

export default function MaintenanceEngineeringPlatformPage() {
  const available = PILLARS.filter(p => p.status === "disponible").length;
  const { enabledDomains, minEditionFor } = useEntitlements();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Network className="w-6 h-6 text-blue-600" />
            Maintenance Engineering Platform
          </h1>
          <p className="text-gray-500 mt-1">
            Ce n'est plus une GMAO — c'est une plateforme d'ingénierie de maintenance à 8 piliers.
            La GMAO en est un pilier parmi d'autres, pas le socle unique.
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {available} / {PILLARS.length} piliers ont du code réel aujourd'hui —
            voir <span className="font-mono">ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md</span> pour le détail.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <Card key={pillar.key} className={pillar.status === "a_construire" ? "border-dashed border-gray-300 bg-gray-50/50" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <Icon className={`w-6 h-6 ${pillar.status === "disponible" ? "text-blue-600" : "text-gray-400"}`} />
                    {pillar.status === "disponible" ? (
                      <Badge className="bg-green-100 text-green-700">Disponible</Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-500 border-gray-300">
                        <Construction className="w-3 h-3 mr-1" />À construire
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base mt-2">{pillar.title}</CardTitle>
                  <CardDescription className="text-xs">{pillar.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-gray-400">{pillar.statusDetail}</p>
                  {pillar.links.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {pillar.links.map(link => (
                        <Link key={link.href} href={link.href}>
                          <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                            {link.label}
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full text-xs" disabled>
                      Pas encore disponible
                    </Button>
                  )}

                  <PlatformEditionBadge
                    included={enabledDomains.includes(pillar.key)}
                    edition={minEditionFor(pillar.key)}
                  />

                  {pillar.connections.length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-1.5">
                        <Link2 className="w-3 h-3" />
                        Connecté avec
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {pillar.connections.map(key => {
                          const target = PILLARS.find(p => p.key === key);
                          return (
                            <span key={key} className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
                              {target?.title ?? key}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <PillarCollaborationMap />
      </div>
    </div>
  );
}
