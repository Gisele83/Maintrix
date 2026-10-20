import { PreventiveMaintenance } from "@/components/preventive-maintenance";
import { AppShell, EnTetePage } from "@/components/app-shell";

/**
 * ═══════════════════════════════════════════════════════════════════
 * MAINTENANCE PRÉVENTIVE — page autonome
 * ═══════════════════════════════════════════════════════════════════
 *
 * Il existait TROIS écrans pour la maintenance planifiée, lisant DEUX
 * tables différentes :
 *
 *   • l'onglet « Maintenance préventive » de la GMAO   → preventive_maintenance_plans
 *   • la page /preventive-maintenance (1 172 lignes)   → maintenance_plans
 *   • la page /maintenance-plan (378 lignes)           → maintenance_plans
 *
 * Un plan créé d'un côté était invisible de l'autre. Mesuré le 20/10/2026
 * sur le même locataire, au même instant : 12 plans dans la première table,
 * zéro dans la seconde. Les deux pages comblaient ce vide — l'une avec cinq
 * plans fabriqués (retirés depuis), l'autre en affichant simplement une
 * liste vide à une organisation qui a pourtant douze plans actifs.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI C'EST `preventive_maintenance_plans` QUI RESTE
 * ═══════════════════════════════════════════════════════════════════
 * Pas pour son nombre de lignes — un comptage sur un seul locataire de
 * test ne prouve rien. Parce qu'elle est la seule des deux à être câblée
 * au reste du système :
 *
 *   • le bloc « À traiter » de la GMAO en tire `preventifEnRetard` et
 *     `preventifSous7Jours` (gmao-storage.ts, getDashboardContexte) ;
 *   • les agents fonctionnels y comptent les préventifs en retard ;
 *   • l'import/export de données la traverse — ce qu'un client importe
 *     atterrit donc ici ;
 *   • 45 références réparties sur 6 fichiers serveur, contre 12 sur 4
 *     pour `maintenance_plans`, dont la moitié ne sont que sa propre CRUD.
 *
 * `maintenance_plans` est un îlot : sa table, ses routes, ses deux écrans,
 * et rien qui la relie au tableau de bord, aux agents ou aux imports.
 *
 * Les deux pages qui la lisaient sont retirées, et leurs routes mènent
 * ici. Rien n'est perdu côté capacités : elles n'ajoutaient qu'un onglet
 * « Analyses » dont le code portait déjà la mention « Cet export
 * fabriquait ses chiffres », et des statistiques calculées sur une table
 * vide. La recherche, le filtre par statut et les compteurs d'usage —
 * que `/maintenance-plan` n'avait pas — sont ici.
 *
 * La fusion des deux tables reste un chantier serveur ouvert.
 */
export default function PreventivePage() {
  return (
    <AppShell
      filAriane={[{ libelle: "GMAO", href: "/gmao" }, { libelle: "Maintenance préventive" }]}
      largeur="large"
    >
      <PreventiveMaintenance
        enTete={
          <EnTetePage
            surTitre="GMAO"
            titre="Maintenance préventive"
            phrase="Les plans d'entretien périodiques, leurs échéances et leurs compteurs d'usage."
          />
        }
      />
    </AppShell>
  );
}
