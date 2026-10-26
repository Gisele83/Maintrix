import { useAuth } from "@/hooks/useAuth";
import { peutImporterEnMasse } from "@shared/import-en-masse";

/**
 * Le droit de charger un fichier, lu une seule fois pour toute l'interface.
 *
 * Cinq écrans offrent un import (inventaire, historique de maintenance,
 * import/export de données, poste de diagnostic, import Excel). Chacun
 * réécrivant son propre test de rôle, le premier oubli passait inaperçu : le
 * bouton restait offert et le serveur répondait 403 sans que l'utilisateur
 * comprenne pourquoi. Un seul point de lecture, partagé avec le serveur via
 * `shared/import-en-masse.ts`.
 */
export function usePeutImporterEnMasse(): boolean {
  const { user } = useAuth();
  return peutImporterEnMasse(user?.role);
}

/**
 * Ce qui s'affiche À LA PLACE du contrôle d'import, jamais rien.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI REMPLACER ET NON MASQUER
 * ═══════════════════════════════════════════════════════════════════
 * Un bouton simplement retiré laisse croire que la fonction n'existe pas, ou
 * qu'elle est en panne : l'utilisateur cherche, recharge, finit par demander.
 * Le bloc nomme donc la règle (le volume, et l'absence d'annulation en masse),
 * le niveau attendu, et ce qui reste faisable tout de suite — préparer et
 * vérifier le fichier, que personne n'interdit puisque la vérification n'écrit
 * rien.
 *
 * `quoi` sert à dire de QUEL import il s'agit sur l'écran où le bloc apparaît
 * (« l'inventaire », « l'historique de maintenance »…) : un message générique
 * sur un écran précis donne l'impression d'un refus mal ciblé.
 */
export function ImportReserve({ quoi }: { quoi?: string }) {
  return (
    <div className="border border-rule bg-paper p-3 text-sm max-w-xl">
      <p className="text-ink">
        Charger {quoi ? `${quoi} ` : "un fichier "}crée des données en masse, et aucune
        annulation en masse n'existe : cela demande au moins un responsable maintenance.
      </p>
      <p className="text-ink-mute mt-1">
        Vous pouvez préparer et vérifier le fichier — la vérification de format n'écrit rien —
        puis le faire charger par un responsable.
      </p>
    </div>
  );
}
