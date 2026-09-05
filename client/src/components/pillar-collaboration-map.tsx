import { ArrowRight } from "lucide-react";

// Schéma simplifié du pipeline opérationnel de MAINTRIX — représentation purement visuelle,
// construite à partir des échanges de données réellement implémentés entre les domaines
// (voir les badges "Connecté avec" sur chaque carte pour le détail fichier par fichier).
// Chaque étape reste une collaboration fonctionnelle entre domaines, jamais une dépendance logicielle.
const PIPELINE_STAGES = [
  "Actif",
  "Surveillance",
  "Détection d'anomalie",
  "Ordre de travail (GMAO)",
  "Exécution",
  "Contrôle qualité",
  "Retour d'expérience",
  "Knowledge Hub",
  "IA",
  "Maintenance prédictive",
  "Analytics",
];

export function PillarCollaborationMap() {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">Flux opérationnel de la plateforme</h3>
      <p className="text-xs text-slate-400 mb-4">
        Les 8 domaines ci-dessus ne sont pas isolés — ils collaborent le long de ce flux, du signal capté sur l'actif jusqu'à l'analyse.
      </p>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {PIPELINE_STAGES.map((stage, i) => (
          <div key={stage} className="flex items-center">
            <span className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-3 py-1 whitespace-nowrap">
              {stage}
            </span>
            {i < PIPELINE_STAGES.length - 1 && (
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-1 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
