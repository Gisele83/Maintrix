import { Link } from "wouter";
import { ArrowRight, BarChart3, Brain, Cpu, HelpCircle, Settings, Shield, Zap } from "lucide-react";

/**
 * Sommaire des modules de la plateforme.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI A CHANGÉ, ET POURQUOI
 * ═══════════════════════════════════════════════════════════════════
 * Chaque carte portait un dégradé de couleurs qui lui était propre
 * (violet-rose, bleu-cyan, orange-rouge…), une pastille de catégorie et une
 * ligne « Performance » affichant un chiffre : « 98% précision »,
 * « 99% conformité », « 15+ métriques », « 120+ cas industriels ».
 *
 * Aucun de ces chiffres n'est mesuré. Ils décoraient. Devant un responsable
 * maintenance, un chiffre invérifiable coûte plus cher qu'il ne rapporte : il
 * suffit d'une question pour que tout le reste devienne suspect.
 *
 * Les cartes disent donc maintenant ce que chaque module FAIT, avec les mêmes
 * filets et la même typographie que le reste de la plateforme.
 */

const MODULES = [
  {
    titre: "Supervision et contrôle adaptatif",
    description:
      "Suivi des installations en temps réel, alertes contextualisées, et actions de pilotage dont vous réglez le degré d'autonomie.",
    icone: Brain,
    href: "/cognitive-infrastructure",
    points: ["Connexion aux capteurs", "Graphe causal", "Autonomie réglable", "Verrouillage par permis"],
  },
  {
    titre: "Diagnostic",
    description:
      "Causes probables classées, chacune rattachée à sa source : règle de maintenance, cas passé ou assistance IA.",
    icone: Cpu,
    href: "/smart-diagnostic",
    points: ["Règles de maintenance", "Cas similaires", "Historique de la machine", "Aide à la formulation"],
  },
  {
    titre: "GMAO",
    description:
      "Équipements, ordres de travail, maintenance préventive et pièces détachées : le quotidien du service.",
    icone: Settings,
    href: "/gmao",
    points: ["Parc et historique", "Ordres de travail", "Plans préventifs", "Pièces détachées"],
  },
  {
    titre: "Capteurs et maintenance prédictive",
    description:
      "État de santé par équipement, dérives détectées avant la panne, estimation de la durée de vie restante.",
    icone: Zap,
    href: "/predictive-insights",
    points: ["Mesures en continu", "Détection d'anomalies", "Durée de vie résiduelle", "Jumeau numérique"],
  },
  {
    titre: "Analyses et rapports",
    description:
      "Disponibilité, OEE, coûts et tendances, exportables pour vos comités et vos audits.",
    icone: BarChart3,
    href: "/advanced-reporting",
    points: ["Indicateurs de parc", "Suivi budgétaire", "Export PDF et Excel", "Tendances"],
  },
  {
    titre: "Administration et sécurité",
    description:
      "Comptes, rôles et traçabilité : qui a fait quoi, quand, et avec quelles permissions.",
    icone: Shield,
    href: "/user-management",
    points: ["Comptes et rôles", "Journal d'audit", "Contrôle d'accès", "Permis de travail"],
  },
  {
    titre: "Documentation et formation",
    description:
      "Prise en main, procédures et assistance, accessibles depuis l'application.",
    icone: HelpCircle,
    href: "/documentation",
    points: ["Guides d'utilisation", "Assistance", "Formation", "Import et export"],
  },
];

export default function FeatureCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-rule border border-rule">
      {MODULES.map((module) => {
        const Icone = module.icone;
        return (
          <Link key={module.titre} href={module.href}>
            <article className="group h-full bg-white p-6 flex flex-col transition-colors hover:bg-paper">
              <Icone className="h-5 w-5 text-ink-mute" />

              <h3 className="font-serif text-title font-medium text-ink mt-4">{module.titre}</h3>
              <p className="text-sm text-ink-soft leading-relaxed mt-2">{module.description}</p>

              <ul className="mt-5 space-y-1.5 flex-1">
                {module.points.map((point) => (
                  <li key={point} className="text-sm text-ink-soft border-t border-rule pt-1.5">
                    {point}
                  </li>
                ))}
              </ul>

              <span className="mt-6 inline-flex items-center gap-1.5 text-sm text-signal group-hover:text-signal-deep transition-colors">
                Ouvrir
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </article>
          </Link>
        );
      })}
    </div>
  );
}
