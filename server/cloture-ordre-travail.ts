import { and, eq, ne, notInArray, sql } from "drizzle-orm";
import {
  equipmentRegistry,
  preventiveMaintenancePlans,
  workOrders,
  type WorkOrder,
} from "@shared/schema";
import { prochaineEcheance, type MotifSansEcheance } from "@shared/replanification-preventive";
import { db } from "./db.js";
import { gmaoStorage } from "./gmao-storage";
import { stockManager, StockInsuffisant, type ManquePiece } from "./stock-management.js";

/**
 * ═══════════════════════════════════════════════════════════════════
 * LA CLÔTURE D'UN ORDRE DE TRAVAIL — CE QU'ELLE TRANSMET
 * ═══════════════════════════════════════════════════════════════════
 *
 * CE QUI ÉTAIT, ET CE QUE ÇA COÛTAIT
 * ───────────────────────────────────────────────────────────────────
 * `PUT /api/work-orders/:id` avec `status: 'completed'` déclenchait UNE seule
 * chose : une tentative de génération de rapport HTML qui n'était même pas
 * enregistrée — le commentaire du code le disait lui-même (« On pourrait
 * sauvegarder le rapport en DB ou l'envoyer par email ici »).
 *
 * Mesuré en base avant correctif, sur un OT préventif clôturé avec trois
 * pièces déclarées : HTTP **200**, `next_due` inchangé, `last_executed` resté
 * nul, `current_stock` toujours à 10, **aucun** mouvement de stock,
 * `operational_state` inchangé — et `actual_end` resté **nul**, donc la
 * clôture n'enregistrait même pas quand le travail avait fini.
 *
 * Pour un exploitant, cela veut dire :
 *   • le stock ne décroît jamais, donc le point de commande ne se déclenche
 *     jamais, donc la rupture se découvre devant la machine à l'arrêt ;
 *   • un plan préventif exécuté reste à son échéance d'origine, bascule en
 *     retard et y demeure — le taux de respect du préventif ne mesure plus
 *     rien ;
 *   • un équipement consigné reste « en maintenance » après la réparation.
 *
 * Dans une GMAO professionnelle, la clôture est l'événement qui irrigue tout
 * le reste. C'est ce que ce module rétablit.
 *
 * CE QUI SE PASSE MAINTENANT, ET DANS QUEL ORDRE
 * ───────────────────────────────────────────────────────────────────
 *   1. verrou sur la ligne de l'ordre de travail ;
 *   2. si l'ordre est DÉJÀ clôturé, on ne refait rien (idempotence) ;
 *   3. consommation des pièces déclarées — tout ou rien ;
 *   4. mise à jour de l'ordre (`status`, `actualEnd`) ;
 *   5. replanification du plan préventif ;
 *   6. remise en service de l'équipement, si et seulement si c'était une
 *      intervention avec arrêt machine et qu'il n'en reste aucune autre.
 *
 * Le tout dans UNE transaction. `docs/TRANSACTIONS.md` pose la règle :
 * « Si un handler écrit dans plus d'une table […] il doit être transactionnel »,
 * et la question à se poser : « que voit l'utilisateur si la seconde écriture
 * échoue ? » Ici, un échec à mi-chemin donnerait un OT clôturé dont les pièces
 * n'ont pas bougé, ou un plan replanifié pour une intervention qui n'est pas
 * clôturée. Dans les deux cas un état incohérent que l'utilisateur ne peut pas
 * corriger lui-même : la transaction est obligatoire.
 *
 * Hors transaction, volontairement : la génération du rapport d'intervention,
 * qui reste dans la route. C'est la règle du dépôt — « rien de lent ni de
 * distant dans une transaction ».
 */

/**
 * STOCK INSUFFISANT : LA CLÔTURE EST REFUSÉE. DÉCISION ET MOTIFS.
 * ═══════════════════════════════════════════════════════════════════
 * Les deux conduites se défendaient — refuser la clôture, ou la permettre en
 * enregistrant un écart. Ce qui ne se défend pas est de clôturer en silence
 * sans décrémenter, c'est-à-dire exactement ce que faisait le code. Le choix
 * retenu est le REFUS, pour quatre raisons :
 *
 *   1. Le garde-fou existe déjà et il a raison. `recordStockMovement` refuse
 *      depuis toujours une sortie qui rendrait le stock négatif. Le respecter
 *      plutôt que le contourner laisse UNE seule règle sur ce qu'un stock peut
 *      valoir, au lieu de deux qui se contredisent selon le chemin d'appel.
 *
 *   2. Un stock négatif empoisonnerait précisément la boucle qu'on ferme.
 *      `generateLowStockAlerts()` compare `current_stock <= min_stock` et
 *      recommande une quantité calculée depuis `current_stock` : sur une
 *      valeur négative, l'alerte porte sur des pièces qui n'existent pas et la
 *      recommandation de commande est fausse. On aurait remplacé « le point de
 *      commande ne se déclenche jamais » par « il se déclenche sur un chiffre
 *      faux » — ce qui est pire, parce que ça inspire une confiance imméritée.
 *
 *   3. Le refus est RATTRAPABLE sur place, et par le bon geste. L'écart entre
 *      le magasin physique et le magasin déclaré se régularise par un
 *      ajustement d'inventaire — `POST /api/stock/adjust` existe et journalise
 *      un mouvement `ADJUSTMENT` motivé. La clôture n'est donc pas perdue :
 *      elle est différée d'un acte explicite et tracé. Rien n'est demandé à
 *      l'opérateur qu'il n'aurait dû faire de toute façon.
 *
 *   4. L'échec est bruyant. `docs/TRANSACTIONS.md` le dit : « un écart
 *      silencieux est plus grave qu'un échec visible ».
 *
 * CE QUE LE REFUS NE FAIT PAS : il ne bloque pas les clôtures sans pièces.
 * Une tournée de graissage se clôture comme avant. Le refus ne mord que sur
 * une déclaration que le magasin ne peut pas honorer — c'est-à-dire sur une
 * contradiction que l'utilisateur vient d'énoncer lui-même.
 *
 * LIMITE ASSUMÉE : si le technicien a physiquement monté la pièce, la refuser
 * en base ne la démonte pas. Le stock était déjà faux AVANT la clôture (la
 * pièce est partie du magasin sans mouvement) ; le refus révèle cet écart
 * préexistant au lieu de l'enterrer sous une valeur négative.
 */
export { StockInsuffisant, type ManquePiece };

/** Ce que la clôture a effectivement transmis. Journalisé, et rendu à l'appelant. */
export interface BilanCloture {
  ordre: WorkOrder;
  /** `true` si l'ordre était déjà clôturé : aucun effet n'a été rejoué. */
  dejaCloture: boolean;
  piecesConsommees: Array<{ sparePartId: number; quantity: number }>;
  replanification:
    | { plan: number; nextDue: Date; periodesAjoutees: number }
    | { plan: number; nextDue: null; motif: MotifSansEcheance }
    | null;
  /** Compteurs d'usage remis à leur valeur de départ, avec le relevé effacé. */
  compteursReinitialises: Array<{ compteur: number; valeurAvant: number; type: string }>;
  equipementRemisEnService: boolean;
}

export interface DemandeCloture {
  id: number;
  tenantId: string;
  /** Les champs déjà traduits et convertis par la route (`status` inclus). */
  modifications: Record<string, unknown>;
  /** Pièces déclarées comme consommées pendant l'intervention. */
  pieces: Array<{ sparePartId: number; quantity: number }>;
  /** Auteur de la clôture, pris de la SESSION et jamais du corps de requête. */
  performedBy?: number | null;
}

/**
 * Statuts dans lesquels un ordre de travail est encore « ouvert ».
 *
 * Défini en négatif (tout sauf terminé et annulé) plutôt qu'en énumérant
 * `pending | assigned | in_progress | paused` : c'est la liste des statuts
 * FERMÉS qui est stable, alors que la liste des statuts ouverts s'est déjà
 * enrichie une fois (`paused`, `on_hold`). Une énumération positive oubliée
 * compterait un arrêt machine en cours comme terminé, et remettrait en service
 * une machine encore consignée — un défaut de sécurité, pas d'affichage.
 */
const STATUTS_FERMES = ['completed', 'cancelled'] as const;

/**
 * Bascule un équipement en `maintenance` parce qu'une intervention AVEC ARRÊT
 * commence.
 *
 * Appelée au passage à `in_progress`, pas à la création : un ordre en attente
 * n'a pas encore arrêté la machine, et l'y déclarer rendrait indisponible un
 * équipement qui tourne.
 *
 * La condition `operational_state = 'operational'` n'est pas une précaution de
 * style : sans elle, un équipement `decommissioned` ou `offline` serait réécrit
 * en `maintenance` par une intervention, ce qui effacerait une décision
 * d'exploitation (mise au rebut, mise hors ligne) au profit d'un état
 * transitoire. On ne bascule que depuis l'état dont on sait qu'il décrit une
 * machine en service.
 */
export async function arreterEquipementPourIntervention(
  equipmentId: number,
  tenantId: string,
  executeur: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0] = db,
): Promise<boolean> {
  const lignes = await executeur
    .update(equipmentRegistry)
    .set({ operationalState: 'maintenance', updatedAt: new Date() })
    .where(and(
      eq(equipmentRegistry.id, equipmentId),
      eq(equipmentRegistry.tenantId, tenantId),
      eq(equipmentRegistry.operationalState, 'operational'),
    ))
    .returning({ id: equipmentRegistry.id });
  return lignes.length > 0;
}

/**
 * Clôture un ordre de travail et transmet ce que la clôture doit transmettre.
 *
 * @throws {StockInsuffisant} si les pièces déclarées dépassent le stock.
 *   RIEN n'est alors écrit : ni le statut, ni les mouvements, ni le plan.
 */
export async function cloturerOrdreTravail(demande: DemandeCloture): Promise<BilanCloture> {
  const bilan = await executerCloture(demande);

  // ── APRÈS LE COMMIT : apprentissage post-action ─────────────────────
  //
  // `gmaoStorage.updateWorkOrder` déclenchait cet apprentissage sur la
  // transition vers `completed` (Brevet 2 rev. 1g/3/10). La clôture ne passe
  // plus par cette méthode : sans ce rappel explicite, la capacité aurait
  // cessé de s'exécuter sans que rien ne le signale.
  //
  // Hors transaction, volontairement : il recalcule un IMCA et écrit dans un
  // autre magasin. Best-effort, comme avant — son échec ne doit pas invalider
  // une clôture par ailleurs valide.
  if (!bilan.dejaCloture && bilan.ordre.projectedCost != null) {
    gmaoStorage.recordAutomatedProjectionOutcome(bilan.ordre).catch(err =>
      console.error("Apprentissage post-action échoué (best-effort):", err),
    );
  }

  return bilan;
}

async function executerCloture(demande: DemandeCloture): Promise<BilanCloture> {
  const { id, tenantId, modifications, pieces, performedBy } = demande;

  return db.transaction(async (tx) => {
    // ── 1. Verrou sur l'ordre de travail ────────────────────────────
    //
    // C'est ce verrou qui rend la clôture sûre face à la concurrence. Deux
    // requêtes simultanées de clôture sur le même ordre : la seconde attend
    // ici, puis lit un statut déjà `completed` et ne rejoue rien. Sans lui,
    // les deux liraient `in_progress` et décrémenteraient toutes deux le
    // stock — deux fois les mêmes pièces pour une seule intervention.
    const [ordreAvant] = await tx
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, tenantId)))
      .for('update');

    if (!ordreAvant) {
      throw new Error(`Ordre de travail #${id} non trouvé ou accès refusé`);
    }

    // ── 2. Idempotence ──────────────────────────────────────────────
    //
    // Déjà clôturé : on applique les éventuels autres champs de la requête,
    // mais AUCUN effet de clôture. Rejouer la consommation sortirait les
    // pièces une seconde fois, et rejouer la replanification avancerait
    // l'échéance d'une période de plus à chaque appel.
    if (ordreAvant.status === 'completed') {
      const [inchange] = await tx
        .update(workOrders)
        .set({ ...modifications, updatedAt: new Date() })
        .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, tenantId)))
        .returning();
      return {
        ordre: inchange,
        dejaCloture: true,
        piecesConsommees: [],
        replanification: null,
        compteursReinitialises: [],
        equipementRemisEnService: false,
      };
    }

    // ── 3. Consommation des pièces — tout ou rien ───────────────────
    //
    // AVANT la mise à jour de l'ordre : en cas de stock insuffisant,
    // l'exception remonte et la transaction est annulée, donc l'ordre n'a pas
    // changé de statut. L'ordre des instructions ne change pas le résultat
    // (tout est annulé de toute façon), mais il rend la lecture du code
    // conforme à ce qui se passe.
    const mouvements = await stockManager.consommerPourCloture(
      tenantId,
      id,
      pieces,
      { performedBy, equipmentId: ordreAvant.equipmentId, reference: `OT-${id}-CLOTURE` },
      tx,
    );

    // ── 4. Mise à jour de l'ordre ───────────────────────────────────
    //
    // `actualEnd` est posé s'il manque. Il manquait TOUJOURS : l'interface
    // envoie `{ status: "completed" }` et rien d'autre
    // (client/src/components/work-order-management.tsx). Sans cette ligne,
    // `lastExecuted = actualEnd` n'aurait rien à écrire, et la date de
    // réalisation de l'intervention serait définitivement perdue.
    const finReelle = (modifications.actualEnd as Date | undefined) ?? ordreAvant.actualEnd ?? new Date();
    const [ordre] = await tx
      .update(workOrders)
      .set({ ...modifications, actualEnd: finReelle, updatedAt: new Date() })
      .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, tenantId)))
      .returning();

    // ── 5. Replanification du plan préventif, et remise à zéro de ses
    //       compteurs d'usage ─────────────────────────────────────────
    let replanification: BilanCloture['replanification'] = null;
    const compteursReinitialises: BilanCloture['compteursReinitialises'] = [];
    if (ordreAvant.planId != null) {
      // Le plan est relu AVEC son locataire : `plan_id` est posé à la
      // création de l'ordre, et rien ne garantit à la lecture qu'il désigne
      // encore un plan du même locataire (un plan peut avoir été supprimé, et
      // un identifiant réattribué). La condition de locataire est ici la seule
      // chose qui empêche cette clôture d'avancer l'échéance de quelqu'un
      // d'autre.
      const [plan] = await tx
        .select()
        .from(preventiveMaintenancePlans)
        .where(and(
          eq(preventiveMaintenancePlans.id, ordreAvant.planId),
          eq(preventiveMaintenancePlans.tenantId, tenantId),
        ))
        .for('update');

      if (plan) {
        const resultat = prochaineEcheance(plan.frequency, plan.frequencyValue, plan.nextDue, finReelle);

        if (resultat.nextDue) {
          await tx
            .update(preventiveMaintenancePlans)
            .set({ lastExecuted: finReelle, nextDue: resultat.nextDue })
            .where(and(
              eq(preventiveMaintenancePlans.id, plan.id),
              eq(preventiveMaintenancePlans.tenantId, tenantId),
            ));
          replanification = { plan: plan.id, nextDue: resultat.nextDue, periodesAjoutees: resultat.periodesAjoutees };
        } else {
          // Pas d'échéance calculable (plan réglé sur un compteur d'usage, ou
          // fréquence non interprétable). On enregistre quand même
          // `lastExecuted` : la date de dernière exécution est vraie et utile
          // indépendamment de la prochaine échéance, et c'est elle qui
          // alimente l'historique des interventions préventives
          // (server/routes.ts, filtre sur `lastExecuted`).
          await tx
            .update(preventiveMaintenancePlans)
            .set({ lastExecuted: finReelle })
            .where(and(
              eq(preventiveMaintenancePlans.id, plan.id),
              eq(preventiveMaintenancePlans.tenantId, tenantId),
            ));
          replanification = { plan: plan.id, nextDue: null, motif: resultat.motif! };
        }

        // ── Compteurs d'usage du plan ───────────────────────────────
        //
        // La gamme vient d'être exécutée : le relevé « depuis la dernière
        // intervention » repart de sa valeur de départ, et l'alerte est levée.
        // Sans cela, un plan réglé sur un compteur restait à son relevé
        // d'avant l'intervention — donc indéfiniment au-delà de son seuil, à
        // crier une échéance déjà honorée. C'est le mécanisme même du noyage
        // d'alarmes que l'ISA-18.2 existe pour empêcher, et que cette campagne
        // a déjà corrigé une fois sur les seuils de capteurs.
        //
        // Le rattachement se fait par le PLAN, jamais par l'équipement :
        // plusieurs plans couvrent le même équipement, et remettre à zéro le
        // compteur « heures depuis révision générale » parce qu'une tournée de
        // graissage a été clôturée masquerait une révision due.
        for (const compteur of await gmaoStorage.getCompteursActifsDuPlan(plan.id, tenantId, tx)) {
          const valeurAvant = compteur.currentValue ?? 0;
          await gmaoStorage.resetCounter(
            compteur.id,
            tenantId,
            `Clôture de l'ordre de travail ${ordreAvant.orderNumber}`,
            performedBy,
            id,
            tx,
          );
          compteursReinitialises.push({
            compteur: compteur.id,
            valeurAvant,
            type: compteur.counterType,
          });
        }
      }
    }

    // ── 6. Remise en service de l'équipement ────────────────────────
    let equipementRemisEnService = false;
    if (ordreAvant.requiresShutdown && ordreAvant.equipmentId != null) {
      // Un seul ordre clôturé ne suffit pas à rendre la machine disponible :
      // deux interventions avec arrêt peuvent être ouvertes en même temps
      // (une réparation et une modification), et remettre en service à la
      // première clôture déclarerait disponible une machine encore consignée
      // pour la seconde. On ne rebascule que s'il n'en reste AUCUNE.
      const [{ restants }] = await tx
        .select({ restants: sql<number>`count(*)::int` })
        .from(workOrders)
        .where(and(
          eq(workOrders.tenantId, tenantId),
          eq(workOrders.equipmentId, ordreAvant.equipmentId),
          eq(workOrders.requiresShutdown, true),
          ne(workOrders.id, id),
          notInArray(workOrders.status, [...STATUTS_FERMES]),
        ));

      if (restants === 0) {
        // Depuis `maintenance` uniquement — même raison que pour la bascule
        // inverse : ne pas écraser `offline` ni `decommissioned`, qui sont des
        // décisions d'exploitation et non l'effet d'une intervention.
        const lignes = await tx
          .update(equipmentRegistry)
          .set({ operationalState: 'operational', updatedAt: new Date() })
          .where(and(
            eq(equipmentRegistry.id, ordreAvant.equipmentId),
            eq(equipmentRegistry.tenantId, tenantId),
            eq(equipmentRegistry.operationalState, 'maintenance'),
          ))
          .returning({ id: equipmentRegistry.id });
        equipementRemisEnService = lignes.length > 0;
      }
    }

    return {
      ordre,
      dejaCloture: false,
      piecesConsommees: mouvements.map(m => ({ sparePartId: m.sparePartId, quantity: m.quantity })),
      replanification,
      compteursReinitialises,
      equipementRemisEnService,
    };
  });
}

/**
 * Lit et valide la déclaration de pièces d'une requête de clôture.
 *
 * Les pièces viennent du CORPS de la requête, et c'est le seul endroit
 * possible : aucune table ne porte les pièces d'un ordre de travail — ni
 * prévues, ni réservées. `maintenance_reports.partsUsed` existe mais est
 * écrite APRÈS, par le rapport d'intervention, donc trop tard pour décrémenter.
 * La déclaration du technicien à la clôture est donc la seule source, et c'est
 * d'ailleurs la pratique : on déclare ce qu'on a monté, pas ce qu'on avait
 * prévu de monter.
 *
 * Le format est volontairement celui que `/api/stock/auto-deduction` accepte
 * déjà (`{ sparePartId, quantity }`), pour ne pas introduire un second
 * vocabulaire de pièces dans le même dépôt.
 */
export function lirePiecesDeclarees(corps: unknown): Array<{ sparePartId: number; quantity: number }> {
  const brut = (corps as { partsUsed?: unknown })?.partsUsed;
  if (brut === undefined || brut === null) return [];
  if (!Array.isArray(brut)) {
    throw new Error("`partsUsed` doit être un tableau de { sparePartId, quantity }");
  }

  return brut.map((ligne, index) => {
    const sparePartId = Number((ligne as any)?.sparePartId);
    const quantity = Number((ligne as any)?.quantity);
    if (!Number.isInteger(sparePartId) || sparePartId <= 0) {
      throw new Error(`partsUsed[${index}].sparePartId invalide : ${(ligne as any)?.sparePartId}`);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`partsUsed[${index}].quantity doit être un entier strictement positif`);
    }
    return { sparePartId, quantity };
  });
}

/**
 * Vérifie qu'un `planId` fourni par un client désigne bien un plan DU
 * locataire, et le rend sous une forme utilisable.
 *
 * Sans ce contrôle, un identifiant de plan pris dans un formulaire rattacherait
 * un ordre de travail au plan d'une autre organisation — et sa clôture
 * avancerait l'échéance de ce plan-là. La contrainte de clé étrangère ne
 * protège de rien ici : elle vérifie que le plan EXISTE, pas à qui il est.
 */
export async function planIdValide(
  planId: unknown,
  tenantId: string,
): Promise<number | null> {
  if (planId === undefined || planId === null || planId === '') return null;
  const identifiant = Number(planId);
  if (!Number.isInteger(identifiant) || identifiant <= 0) {
    throw new Error(`planId invalide : ${String(planId)}`);
  }

  const [plan] = await db
    .select({ id: preventiveMaintenancePlans.id })
    .from(preventiveMaintenancePlans)
    .where(and(
      eq(preventiveMaintenancePlans.id, identifiant),
      eq(preventiveMaintenancePlans.tenantId, tenantId),
    ));

  if (!plan) {
    throw new Error(`Plan de maintenance préventive #${identifiant} non trouvé`);
  }
  return plan.id;
}
