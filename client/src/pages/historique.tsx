import { HistoriqueMaintenance } from "@/components/historique-maintenance";
import { AppShell, EnTetePage } from "@/components/app-shell";

/**
 * ═══════════════════════════════════════════════════════════════════
 * HISTORIQUE DE MAINTENANCE — page autonome
 * ═══════════════════════════════════════════════════════════════════
 *
 * Trois écrans portaient ce nom, sur deux sources de données différentes,
 * et un seul montrait réellement un historique. Il n'en reste qu'une
 * implémentation : `components/historique-maintenance.tsx`, montée ici,
 * dans l'onglet « Historique » de la GMAO et dans celui du tableau de bord.
 * Le raisonnement et les mesures sont dans l'en-tête de ce composant.
 *
 * Cette page portait un `<h1>` écrit à la main — « Historique de
 * Maintenance », en `text-3xl font-bold` — alors qu'elle importait
 * `EnTetePage`, `Indicateur`, `PuceEtat`, `EtatVide` et quatre autres
 * composants de charte : huit imports pour zéro utilisation. Le gabarit
 * commun n'avait jamais été appliqué, seulement importé.
 */
export default function HistoriquePage() {
  return (
    <AppShell
      filAriane={[{ libelle: "GMAO", href: "/gmao" }, { libelle: "Historique" }]}
      largeur="large"
    >
      <HistoriqueMaintenance
        enTete={
          <EnTetePage
            surTitre="GMAO"
            titre="Historique de maintenance"
            phrase="Les interventions réalisées, leur durée, leur coût et les pièces consommées."
          />
        }
      />
    </AppShell>
  );
}
