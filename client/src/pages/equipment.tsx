import { EquipmentManagement } from "@/components/equipment-management";
import { AppShell, EnTetePage } from "@/components/app-shell";

/**
 * ═══════════════════════════════════════════════════════════════════
 * ÉQUIPEMENTS — page autonome
 * ═══════════════════════════════════════════════════════════════════
 *
 * `EquipmentManagement` est un COMPOSANT, et il était branché directement
 * sur les routes `/equipment` et `/equipment-management` depuis `App.tsx`.
 * Deux conséquences, mesurées le 19/10/2026 :
 *
 *   • aucune barre de navigation — le registre des équipements est pourtant
 *     la destination de la tuile « Équipements » de la GMAO et de celle de
 *     l'écran d'ingénierie : on y arrivait en un clic, on n'en repartait
 *     plus ;
 *   • aucun `<h1>` — son titre est un `<h2>`, parce que le composant est
 *     aussi monté comme onglet à l'intérieur de la GMAO, où un `<h1>` aurait
 *     fait doublon.
 *
 * Cette page résout les deux : elle pose le gabarit et le titre de niveau 1,
 * et le composant garde sa forme d'onglet quand la GMAO l'intègre.
 */
export default function EquipmentPage() {
  return (
    <AppShell filAriane={[{ libelle: "GMAO", href: "/gmao" }, { libelle: "Équipements" }]} largeur="large">
      <EquipmentManagement
        enTete={
          <EnTetePage
            surTitre="Actifs"
            titre="Équipements"
            phrase="Le registre du parc : identification, emplacement, criticité et état de service."
          />
        }
      />
    </AppShell>
  );
}
