import { WorkOrderManagement } from "@/components/work-order-management";
import { AppShell, EnTetePage } from "@/components/app-shell";

/**
 * ═══════════════════════════════════════════════════════════════════
 * ORDRES DE TRAVAIL — page autonome
 * ═══════════════════════════════════════════════════════════════════
 *
 * Deux implémentations servaient les ordres de travail : cette page, et
 * l'onglet « Ordres de travail » de la GMAO, qui montait un composant
 * distinct de 820 lignes. Elles n'avaient ni les mêmes capacités, ni le
 * même vocabulaire, ni le même contrat de champs — un ordre suspendu
 * depuis l'onglet ressortait ici avec une pastille grise « on_hold ».
 *
 * Il n'en reste qu'une : `components/work-order-management.tsx`, montée
 * ici comme dans la GMAO. Le raisonnement et les mesures qui ont décidé
 * de chaque capacité conservée sont dans l'en-tête de ce composant.
 *
 * Cette page ne fait plus que poser le cadre : fil d'Ariane, en-tête, et
 * la largeur « large » qui laisse trois colonnes de cartes.
 */
export default function WorkOrdersPage() {
  return (
    <AppShell
      filAriane={[{ libelle: "GMAO", href: "/gmao" }, { libelle: "Ordres de travail" }]}
      largeur="large"
    >
      <WorkOrderManagement
        enTete={
          <EnTetePage
            surTitre="GMAO"
            titre="Ordres de travail"
            phrase="Les interventions demandées, leur priorité, leur responsable et leur avancement."
          />
        }
      />
    </AppShell>
  );
}
