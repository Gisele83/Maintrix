/**
 * Replanification d'un plan de maintenance préventive après exécution.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE
 * ═══════════════════════════════════════════════════════════════════
 * `preventive_maintenance_plans.nextDue` et `lastExecuted` n'étaient écrits
 * nulle part ailleurs que par l'édition manuelle d'un plan. Un préventif
 * exécuté restait donc à son échéance d'origine : il basculait en retard et y
 * demeurait, et le taux de respect du préventif — un indicateur affiché —
 * cessait de vouloir dire quoi que ce soit.
 *
 * Le calcul est ISOLÉ ici, hors de toute base et de toute requête, pour une
 * raison précise : c'est la partie du correctif où une erreur ne se voit pas.
 * Une consommation de pièces qui échoue se lit tout de suite ; une échéance
 * décalée d'un jour à chaque cycle ne se remarque qu'après un an de dérive.
 * Une fonction pure s'éprouve sur des dates choisies, sans serveur.
 *
 * ═══════════════════════════════════════════════════════════════════
 * LA DÉCISION QUI COMPTE : ON REPART DE L'ÉCHÉANCE PRÉVUE
 * ═══════════════════════════════════════════════════════════════════
 * Le réflexe est d'écrire `nextDue = date de réalisation + période`. C'est
 * faux, et le défaut est cumulatif : un graissage mensuel dû le 1er, fait le
 * 8 parce que l'atelier était pris, repasserait au 8 du mois suivant, puis au
 * 15, puis au 22. Au bout d'un an le plan a glissé d'un trimestre, sans que
 * personne n'ait rien décidé — et les deux lectures possibles de l'historique
 * (« cette gamme se fait le 1er » / « elle se fait quand on peut ») deviennent
 * indiscernables.
 *
 * L'ancre est donc l'échéance PRÉVUE, pas la date de réalisation. Un retard se
 * rattrape au cycle suivant au lieu de se propager.
 *
 * Conséquence à traiter explicitement : si le retard dépasse une période
 * entière, « ancre + une période » tombe DANS LE PASSÉ, et le plan ressortirait
 * en retard immédiatement après avoir été exécuté. On avance donc par périodes
 * entières jusqu'à dépasser la date de réalisation — ce qui conserve le rythme
 * (les échéances restent sur la grille d'origine) tout en remettant le plan
 * devant soi. Les cycles sautés ne sont pas « rattrapés » : ils n'ont pas eu
 * lieu, et créer des échéances dans le passé ne ferait pas apparaître le
 * travail qui n'a pas été fait.
 */

/** Unité de base d'une période, et combien d'unités la fréquence nommée vaut. */
interface Periode {
  unite: 'jour' | 'mois';
  facteur: number;
}

/**
 * Les DEUX vocabulaires de fréquence qui coexistent réellement en base.
 *
 * Ce n'est pas une précaution : c'est un relevé. Le formulaire web
 * (`client/src/components/preventive-maintenance.tsx`) écrit `days` / `weeks` /
 * `months` / `years`, tandis que l'injecteur de démonstration
 * (`scripts/jeu-de-demonstration.ts`) et le générateur de données de test
 * écrivent `monthly` / `quarterly` / `weekly` / `annually` — et le commentaire
 * du schéma annonce, lui, une troisième liste. Ne reconnaître qu'un seul de ces
 * vocabulaires suffirait à ce que la replanification reste muette sur la moitié
 * du parc, en rendant `null` sans que rien ne le signale.
 *
 * `frequencyValue` est un MULTIPLICATEUR de la période nommée dans les deux
 * conventions : `{ weekly, 2 }` vaut deux semaines, `{ days, 30 }` trente
 * jours. Les deux se ramènent donc à « unité × facteur × valeur ».
 */
const PERIODES: Record<string, Periode> = {
  // Vocabulaire du formulaire web : l'unité est nommée, la valeur la compte.
  days: { unite: 'jour', facteur: 1 },
  weeks: { unite: 'jour', facteur: 7 },
  months: { unite: 'mois', facteur: 1 },
  years: { unite: 'mois', facteur: 12 },
  // Vocabulaire des jeux de données : la période est nommée en entier.
  daily: { unite: 'jour', facteur: 1 },
  weekly: { unite: 'jour', facteur: 7 },
  biweekly: { unite: 'jour', facteur: 14 },
  monthly: { unite: 'mois', facteur: 1 },
  quarterly: { unite: 'mois', facteur: 3 },
  semiannually: { unite: 'mois', facteur: 6 },
  annually: { unite: 'mois', facteur: 12 },
  annual: { unite: 'mois', facteur: 12 },
  yearly: { unite: 'mois', facteur: 12 },
};

/**
 * Fréquences qui ne se comptent PAS en calendrier : elles dépendent d'un
 * compteur d'usage (heures de fonctionnement, cycles, kilomètres). Un plan
 * ainsi réglé n'a pas d'échéance de date à recalculer — son échéance est une
 * valeur de compteur, et `maintenance_counters` porte déjà ce suivi.
 *
 * Elles sont listées, et non simplement absentes de `PERIODES`, pour que
 * l'appelant puisse distinguer « fréquence inconnue, c'est peut-être un défaut
 * de saisie » de « fréquence connue mais hors calendrier, il n'y a rien à
 * replanifier ici ». Les deux rendent `null`, mais pas pour la même raison, et
 * seule la première mérite une trace.
 */
const FREQUENCES_SUR_COMPTEUR = new Set(['hours_based', 'usage_based', 'hours', 'cycles', 'kilometers', 'units']);

export type MotifSansEcheance = 'frequence_sur_compteur' | 'frequence_inconnue' | 'periode_non_positive';

export interface ResultatReplanification {
  /** La nouvelle échéance, ou `null` s'il n'y a rien à replanifier. */
  nextDue: Date | null;
  /** Renseigné uniquement quand `nextDue` est `null`. */
  motif?: MotifSansEcheance;
  /** Nombre de périodes entières ajoutées à l'ancre. 0 si `nextDue` est `null`. */
  periodesAjoutees: number;
}

/**
 * Ajoute `n` périodes à une date.
 *
 * Le multiplicateur est appliqué EN UNE FOIS plutôt qu'en additionnant n fois
 * une période : avec le rabattement de fin de mois ci-dessous, n additions
 * successives dériveraient (31 janvier → 28 février → 28 mars), alors qu'un
 * seul calcul depuis l'ancre garde le 31 partout où il existe.
 */
function ajouterPeriodes(ancre: Date, periode: Periode, valeur: number, n: number): Date {
  const resultat = new Date(ancre.getTime());
  const quantite = periode.facteur * valeur * n;

  if (periode.unite === 'jour') {
    // En millisecondes, et non `setDate` : `setDate` travaille en heure locale
    // et un passage à l'heure d'été ferait glisser l'échéance d'une heure.
    // Les colonnes sont des `timestamp` sans fuseau, écrites et relues en UTC.
    return new Date(ancre.getTime() + quantite * 86_400_000);
  }

  // Mois : le jour du mois peut ne pas exister dans le mois d'arrivée (le 31
  // mars + 1 mois n'est pas le 31 avril). `setMonth` déborderait alors sur le
  // mois suivant — un contrôle mensuel dû le 31 janvier tomberait le 3 mars.
  // On rabat sur le DERNIER JOUR du mois d'arrivée : c'est la convention de
  // toute planification d'échéances, et elle garde l'échéance dans le mois
  // qu'elle était censée couvrir.
  const jour = resultat.getUTCDate();
  resultat.setUTCDate(1);
  resultat.setUTCMonth(resultat.getUTCMonth() + quantite);
  const dernierJourDuMois = new Date(Date.UTC(resultat.getUTCFullYear(), resultat.getUTCMonth() + 1, 0)).getUTCDate();
  resultat.setUTCDate(Math.min(jour, dernierJourDuMois));
  return resultat;
}

/**
 * Calcule la prochaine échéance d'un plan après une exécution.
 *
 * @param frequency       `preventive_maintenance_plans.frequency`
 * @param frequencyValue  son multiplicateur ; `null`/absent vaut 1
 * @param echeancePrevue  `nextDue` AVANT la clôture — l'ancre du calcul
 * @param realiseLe       fin réelle de l'intervention
 */
export function prochaineEcheance(
  frequency: string | null | undefined,
  frequencyValue: number | null | undefined,
  echeancePrevue: Date | null | undefined,
  realiseLe: Date,
): ResultatReplanification {
  const cle = (frequency ?? '').trim().toLowerCase();

  if (FREQUENCES_SUR_COMPTEUR.has(cle)) {
    return { nextDue: null, motif: 'frequence_sur_compteur', periodesAjoutees: 0 };
  }

  const periode = PERIODES[cle];
  if (!periode) {
    return { nextDue: null, motif: 'frequence_inconnue', periodesAjoutees: 0 };
  }

  // `frequencyValue` est nullable en base et vaut 1 par convention quand la
  // fréquence se nomme entièrement (`monthly` sans valeur = tous les mois).
  const valeur = frequencyValue ?? 1;
  // Une valeur nulle ou négative ne décrit aucune période. On REFUSE de
  // replanifier plutôt que de corriger en douce vers 1 : une saisie à 0 est une
  // erreur de saisie, et lui inventer un sens la rendrait indétectable. C'est
  // aussi ce qui garantit que la boucle ci-dessous termine.
  if (!Number.isFinite(valeur) || valeur <= 0) {
    return { nextDue: null, motif: 'periode_non_positive', periodesAjoutees: 0 };
  }

  // L'ancre : l'échéance PRÉVUE. Un plan jamais planifié (`nextDue` nul) n'a
  // pas de grille à préserver — on part alors de la réalisation, qui devient
  // sa première référence.
  const ancre = echeancePrevue ?? realiseLe;

  // Nombre de périodes entières à ajouter pour dépasser la réalisation.
  //
  // Il est ESTIMÉ puis corrigé, et non trouvé en avançant d'une période à la
  // fois : une ancre vieille de trois ans sur un plan quotidien demanderait un
  // millier d'itérations, et un plan mal saisi pourrait en demander beaucoup
  // plus. L'estimation est exacte pour les périodes en jours ; pour les mois
  // elle peut manquer d'une unité (durée des mois inégale), ce que la
  // correction bornée ci-dessous rattrape.
  const dureeApprochee = periode.unite === 'jour'
    ? periode.facteur * valeur * 86_400_000
    : periode.facteur * valeur * 30.436875 * 86_400_000; // mois grégorien moyen
  const retardMs = realiseLe.getTime() - ancre.getTime();
  let n = retardMs <= 0 ? 1 : Math.max(1, Math.floor(retardMs / dureeApprochee));

  // Correction exacte. Deux boucles bornées, qui ne tournent qu'une poignée de
  // fois puisqu'elles partent d'une estimation : on monte tant que la candidate
  // n'a pas dépassé la réalisation, puis on redescend tant que la période
  // précédente suffisait déjà — sans quoi l'estimation par excès ferait sauter
  // un cycle de plus que nécessaire.
  while (ajouterPeriodes(ancre, periode, valeur, n).getTime() <= realiseLe.getTime()) n += 1;
  while (n > 1 && ajouterPeriodes(ancre, periode, valeur, n - 1).getTime() > realiseLe.getTime()) n -= 1;

  return { nextDue: ajouterPeriodes(ancre, periode, valeur, n), periodesAjoutees: n };
}
