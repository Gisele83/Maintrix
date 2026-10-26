import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { peutCreerEquipement } from "@shared/creation-equipement";

/**
 * Le droit d'inscrire un équipement, lu une seule fois pour toute l'interface.
 *
 * Deux écrans l'offraient : le registre du parc (`equipment-management`) et la
 * création rapide posée dans le formulaire d'ordre de travail. Chacun décidant
 * pour lui-même, le premier oubli passait inaperçu — le bouton restait offert
 * et le serveur répondait 403 sans que l'utilisateur comprenne pourquoi. Un
 * seul point de lecture, partagé avec le serveur via
 * `shared/creation-equipement.ts`.
 */
export function usePeutCreerEquipement(): boolean {
  const { user } = useAuth();
  return peutCreerEquipement(user?.role);
}

/**
 * Ce qui s'affiche À LA PLACE du bouton d'inscription, jamais rien.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI REMPLACER ET NON MASQUER
 * ═══════════════════════════════════════════════════════════════════
 * Un bouton simplement retiré laisse croire que la fonction n'existe pas, ou
 * qu'elle est en panne. Le bloc nomme la règle — l'inscription au référentiel
 * est définitive, faute de toute suppression — et renvoie vers le geste qui
 * reste ouvert à tous : la demande d'intervention, que la maintenance
 * arbitrera.
 */
export function CreationEquipementReservee({ compact = false }: { compact?: boolean }) {
  return (
    <div className="border border-rule bg-paper p-3 text-sm max-w-xl">
      <p className="text-ink">
        Inscrire un équipement au référentiel du parc demande au moins un responsable
        maintenance : aucune suppression n'existe, une inscription erronée est donc
        définitive.
      </p>
      {!compact && (
        <p className="text-ink-mute mt-1">
          Pour signaler une machine à inscrire,{" "}
          <Link
            href="/demandes-intervention"
            className="text-signal underline underline-offset-2 hover:text-ink"
          >
            créez une demande d'intervention
          </Link>{" "}
          — la maintenance l'arbitrera.
        </p>
      )}
    </div>
  );
}
