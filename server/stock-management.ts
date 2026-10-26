import { stockMovements, spareParts, type StockMovement, type InsertStockMovement } from "@shared/schema";
import { db } from "./db.js";
import { and, eq, desc, inArray, sql } from "drizzle-orm";

/**
 * Gestion des stocks de pièces détachées — CLOISONNÉE PAR LOCATAIRE.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT OUVERT, ET MESURÉ
 * ═══════════════════════════════════════════════════════════════════
 * Aucune méthode de ce module ne recevait de locataire, et ses quatre accès à
 * la base cherchaient `spare_parts` et `stock_movements` par clé primaire seule
 * ou sans aucune condition. Les huit routes `/api/stock/*` prenaient le
 * `sparePartId` dans la requête et le transmettaient tel quel.
 *
 * Trois conséquences, toutes mesurées sur une grappe de test à deux
 * locataires (campagne du 2026-10-21, commit 96fe408) :
 *
 *   • LECTURE — `GET /api/stock/alerts/low-stock` servait à l'administrateur
 *     d'Alpha les pièces sous seuil de TOUS les locataires. Relevé :
 *     « PN-ZZPREUVE-BETA · ROULEMENT SECRET DE BETA · stock 0/10 · CRITICAL ».
 *     L'écran des alertes de stock du client appelle cette route
 *     (client/src/components/stock-alerts-dashboard.tsx), donc la fuite était
 *     visible à l'œil nu, sans rien forger.
 *
 *   • LECTURE — `GET /api/stock/:id/availability/:qty` renvoyait à Alpha le
 *     niveau de stock d'une pièce de Beta, en HTTP 200.
 *
 *   • ÉCRITURE — et c'est le plus grave : `recordStockMovement` lisait PUIS
 *     METTAIT À JOUR `spare_parts` par identifiant seul. Les cinq routes de
 *     mutation (`/outbound`, `/return`, `/inbound`, `/adjust`, `/reserve`) et
 *     les deux automatismes d'ordre de travail passaient donc par là sans
 *     locataire : un locataire pouvait modifier le stock d'un autre.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI EST FAIT, ET POURQUOI AINSI
 * ═══════════════════════════════════════════════════════════════════
 * `tenantId` devient le PREMIER paramètre, OBLIGATOIRE, de chaque méthode
 * publique. Le choix n'est pas cosmétique : un paramètre facultatif ajouté en
 * fin de signature se fait oublier au prochain appelant, en silence. Ici, le
 * compilateur refuse tout appel qui n'en fournit pas — c'est `tsc` qui tient la
 * garantie, pas la vigilance du relecteur.
 *
 * Les routes le prennent de `tenantRequis()`, donc de la session validée, et
 * jamais d'un en-tête ou d'un corps fourni par le client.
 *
 * Pour l'historique, la condition porte sur la PROPRIÉTÉ DE LA PIÈCE plutôt
 * que sur le `tenant_id` des mouvements : les lignes écrites avant ce correctif
 * ont un `tenant_id` nul (rien ne le posait), et filtrer dessus les aurait
 * rendues invisibles à leur propre propriétaire. On vérifie donc que la pièce
 * appartient au demandeur, puis on rend ses mouvements.
 *
 * Les nouveaux mouvements, eux, portent désormais leur `tenantId`. Cela ferme
 * aussi un angle mort du filet `antiLeakageValidator`
 * (server/tenant-security-middleware.ts), qui ne sait reconnaître une fuite que
 * sur une charge portant ce champ.
 */
/**
 * La pièce visée n'appartient pas au demandeur, ou n'existe pas.
 *
 * Une classe d'erreur plutôt qu'un `Error` générique, pour que les routes
 * répondent **404** et non 500. Ce n'est pas un détail de forme : avec un
 * `Error` nu, demander une pièce d'un autre locataire produisait un 500, qui
 * annonce une panne du serveur là où il n'y a qu'un objet hors de portée — et
 * qui noie les vraies pannes dans les journaux.
 *
 * La convention du dépôt, posée au lot D5 : 403 = rôle refusé, 404 = rôle
 * accepté mais objet absent. Une pièce d'autrui est, pour le demandeur,
 * exactement un objet absent — et ne pas distinguer les deux cas évite au
 * passage de révéler qu'un identifiant existe ailleurs.
 */
export class PieceIntrouvable extends Error {
  constructor(sparePartId: number) {
    super(`Pièce détachée avec l'ID ${sparePartId} non trouvée`);
    this.name = 'PieceIntrouvable';
  }
}

/**
 * La base, ou une transaction en cours sur celle-ci.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TYPE EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Les méthodes de ce module écrivaient toutes sur le `db` du module. Tant
 * qu'elles n'étaient appelées que par des routes `/api/stock/*` — un
 * mouvement, une réponse — cela suffisait. La clôture d'un ordre de travail
 * change la donne : elle doit consommer les pièces, replanifier le plan
 * préventif et mettre à jour l'ordre lui-même, et ces écritures doivent être
 * vraies ENSEMBLE. Une consommation validée pendant que la clôture échoue
 * retire du stock des pièces pour une intervention qui n'a pas été clôturée ;
 * l'inverse clôture sans décrémenter, ce qui est exactement le défaut qu'on
 * corrige.
 *
 * `docs/TRANSACTIONS.md` pose la règle du dépôt et son piège : « Toutes les
 * écritures doivent passer par `tx`. Un `db.` oublié à l'intérieur du bloc
 * s'exécute HORS transaction et ne sera pas annulé. » Le type ci-dessous est
 * la parade : l'exécuteur traverse les signatures, donc le `tx` de l'appelant
 * atteint réellement l'`INSERT` et l'`UPDATE`.
 *
 * Il est en DERNIÈRE position et facultatif, contrairement au `tenantId` qui
 * est premier et obligatoire. La différence est voulue : oublier le locataire
 * ouvre un cloisonnement, oublier l'exécuteur rend seulement le comportement
 * historique — celui des huit routes `/api/stock/*`, qui n'ont pas de
 * transaction à propager.
 */
type TransactionBase = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Executeur = typeof db | TransactionBase;

/** Une pièce manquante au moment où on voulait la sortir du magasin. */
export interface ManquePiece {
  sparePartId: number;
  partNumber: string;
  partName: string;
  demande: number;
  disponible: number;
  manque: number;
}

/**
 * Le magasin ne peut pas honorer la déclaration de pièces.
 *
 * Classe d'erreur dédiée, et non un `Error` nu : la route doit répondre **409
 * Conflict** (l'état du magasin contredit la demande) et rendre la LISTE des
 * manques, pour que le magasinier sache quoi régulariser. Un message en texte
 * libre obligerait l'interface à l'analyser.
 */
export class StockInsuffisant extends Error {
  constructor(public readonly manques: ManquePiece[]) {
    super(
      `Stock insuffisant pour ${manques.length} référence(s) : ` +
      manques.map(m => `${m.partNumber} (demandé ${m.demande}, disponible ${m.disponible})`).join(', '),
    );
    this.name = 'StockInsuffisant';
  }
}

export class StockManager {

  /**
   * Enregistre un mouvement de stock et met à jour les quantités.
   *
   * La pièce doit appartenir au locataire : la condition est posée sur la
   * lecture ET sur la mise à jour, car c'est la mise à jour qui modifiait le
   * stock d'autrui.
   */
  async recordStockMovement(
    tenantId: string,
    movement: Omit<InsertStockMovement, 'previousStock' | 'newStock'>,
    executeur: Executeur = db,
  ): Promise<StockMovement> {
    // Récupérer le stock actuel — de SA pièce.
    const [sparePart] = await executeur
      .select()
      .from(spareParts)
      .where(and(
        eq(spareParts.id, movement.sparePartId),
        eq(spareParts.tenantId, tenantId),
      ));

    if (!sparePart) {
      throw new PieceIntrouvable(movement.sparePartId);
    }

    const previousStock = sparePart.currentStock || 0;
    let newStock: number;

    // Calculer le nouveau stock selon le type de mouvement
    switch (movement.movementType) {
      case 'IN':
        newStock = previousStock + movement.quantity;
        break;
      case 'OUT':
        newStock = previousStock - movement.quantity;
        if (newStock < 0) {
          throw new Error(`Stock insuffisant. Stock actuel: ${previousStock}, Quantité demandée: ${movement.quantity}`);
        }
        break;
      case 'ADJUSTMENT':
        newStock = movement.quantity; // Adjustment sets absolute value
        break;
      case 'RETURN':
        newStock = previousStock + movement.quantity;
        break;
      default:
        throw new Error(`Type de mouvement invalide: ${movement.movementType}`);
    }

    // Calculer les coûts si non fournis
    const unitCost = movement.unitCost || sparePart.unitPrice?.toString() || '0';
    const totalCost = movement.totalCost || (parseFloat(unitCost.toString()) * movement.quantity).toString();

    // Enregistrer le mouvement de stock, en le rattachant à son locataire :
    // rien ne le posait, donc toutes les lignes existantes l'ont à `null`.
    const [stockMovement] = await executeur
      .insert(stockMovements)
      .values({
        ...movement,
        tenantId,
        previousStock,
        newStock,
        unitCost,
        totalCost,
      })
      .returning();

    // Mettre à jour le stock de la pièce. La condition de locataire est
    // REDONDANTE avec la lecture ci-dessus, et c'est voulu : c'est cette
    // instruction-là qui écrivait chez autrui, et une écriture ne doit pas
    // dépendre d'un contrôle fait quelques lignes plus haut.
    await executeur
      .update(spareParts)
      .set({
        currentStock: newStock,
        updatedAt: new Date()
      })
      .where(and(
        eq(spareParts.id, movement.sparePartId),
        eq(spareParts.tenantId, tenantId),
      ));

    return stockMovement;
  }

  /**
   * Consomme les pièces déclarées à la clôture d'un ordre de travail —
   * TOUT OU RIEN, et à l'abri des clôtures concurrentes.
   *
   * ═══════════════════════════════════════════════════════════════════
   * POURQUOI UNE MÉTHODE DE PLUS
   * ═══════════════════════════════════════════════════════════════════
   * `autoStockDeductionForWorkOrder()` existait déjà, mais sa sémantique est
   * l'inverse de celle d'une clôture : elle parcourt les pièces, SAUTE celles
   * qui manquent (`continue`) et rend la liste des manques — donc elle
   * consomme partiellement. C'est tenable pour un appel explicite depuis
   * `/api/stock/auto-deduction`, où l'opérateur lit le compte rendu. Dans une
   * transaction, c'est inutilisable à deux titres : une consommation partielle
   * laisserait le magasin dans un état que personne n'a décidé, et surtout
   * PostgreSQL abandonne toute la transaction dès la première instruction en
   * erreur — un `catch` qui « continue » ne continue sur rien.
   *
   * Ici : on vérifie TOUT, puis on écrit TOUT, ou on ne touche à rien.
   *
   * ═══════════════════════════════════════════════════════════════════
   * LE VERROU, ET POURQUOI IL EST INDISPENSABLE
   * ═══════════════════════════════════════════════════════════════════
   * `recordStockMovement` LIT le stock puis ÉCRIT une valeur absolue
   * (`currentStock: newStock`). Deux clôtures simultanées qui lisent 10
   * écriraient toutes deux 7 : six pièces sorties, trois décomptées. Ce n'est
   * pas une hypothèse d'école — c'est le scénario que le test de concurrence
   * éprouve.
   *
   * On verrouille donc les lignes de `spare_parts` concernées
   * (`SELECT … FOR UPDATE`) avant toute lecture servant à décider. Les pièces
   * sont verrouillées DANS L'ORDRE DE LEUR IDENTIFIANT : deux clôtures qui
   * partagent deux références et les prendraient en ordre inverse
   * s'interbloqueraient, et PostgreSQL en tuerait une au hasard.
   */
  async consommerPourCloture(
    tenantId: string,
    workOrderId: number,
    pieces: Array<{ sparePartId: number; quantity: number }>,
    options: { performedBy?: number | null; equipmentId?: number | null; reference?: string } = {},
    executeur: Executeur = db,
  ): Promise<StockMovement[]> {
    if (pieces.length === 0) return [];

    // Une même référence peut être déclarée deux fois (deux lignes de la même
    // pièce). On agrège AVANT de vérifier : contrôler chaque ligne séparément
    // laisserait passer 2 × 6 sur un stock de 10.
    const parPiece = new Map<number, number>();
    for (const p of pieces) {
      const quantite = Number(p.quantity);
      if (!Number.isInteger(quantite) || quantite <= 0) {
        throw new Error(`Quantité invalide pour la pièce ${p.sparePartId} : ${p.quantity}`);
      }
      parPiece.set(p.sparePartId, (parPiece.get(p.sparePartId) ?? 0) + quantite);
    }

    const identifiants = [...parPiece.keys()].sort((a, b) => a - b);

    // Verrou + lecture dans la même instruction. `inArray` + `FOR UPDATE` :
    // l'ordre du `ORDER BY` est ce qui fixe l'ordre de prise des verrous.
    const lignes = await executeur
      .select()
      .from(spareParts)
      .where(and(inArray(spareParts.id, identifiants), eq(spareParts.tenantId, tenantId)))
      .orderBy(spareParts.id)
      .for('update');

    const connues = new Map(lignes.map(l => [l.id, l]));

    // Une pièce absente de la réponse appartient à un autre locataire ou
    // n'existe pas : dans les deux cas, hors de portée du demandeur.
    for (const id of identifiants) {
      if (!connues.has(id)) throw new PieceIntrouvable(id);
    }

    // Vérification EXHAUSTIVE avant la moindre écriture : on veut la liste
    // complète des manques, pas le premier rencontré. Un magasinier à qui l'on
    // annonce une rupture à la fois régularise en autant d'allers-retours.
    const manques: ManquePiece[] = [];
    for (const id of identifiants) {
      const ligne = connues.get(id)!;
      const demande = parPiece.get(id)!;
      const disponible = ligne.currentStock ?? 0;
      if (disponible < demande) {
        manques.push({
          sparePartId: id,
          partNumber: ligne.partNumber,
          partName: ligne.partName,
          demande,
          disponible,
          manque: demande - disponible,
        });
      }
    }
    if (manques.length > 0) throw new StockInsuffisant(manques);

    // Écritures. Le mouvement porte l'ordre de travail et l'équipement :
    // c'est ce rattachement qui permet de remonter d'une pièce consommée à
    // l'intervention qui l'a consommée, et donc d'imputer un coût matière.
    const mouvements: StockMovement[] = [];
    for (const id of identifiants) {
      mouvements.push(await this.recordStockMovement(tenantId, {
        sparePartId: id,
        movementType: 'OUT',
        quantity: parPiece.get(id)!,
        reason: 'WORK_ORDER',
        workOrderId,
        equipmentId: options.equipmentId ?? undefined,
        performedBy: options.performedBy ?? undefined,
        reference: options.reference ?? `OT-${workOrderId}-CLOTURE`,
        notes: `Consommation déclarée à la clôture de l'ordre de travail ${workOrderId}`,
      }, executeur));
    }

    return mouvements;
  }

  /**
   * Sortie de stock pour maintenance/réparation
   */
  async outboundForMaintenance(
    tenantId: string,
    sparePartId: number,
    quantity: number,
    workOrderId?: number,
    equipmentId?: number,
    performedBy?: number,
    notes?: string
  ): Promise<StockMovement> {
    return this.recordStockMovement(tenantId, {
      sparePartId,
      movementType: 'OUT',
      quantity,
      reason: 'MAINTENANCE',
      workOrderId,
      equipmentId,
      performedBy,
      notes,
      reference: workOrderId ? `OT-${workOrderId}` : undefined,
    });
  }

  /**
   * Retour de stock (pièce non utilisée)
   */
  async returnToStock(
    tenantId: string,
    sparePartId: number,
    quantity: number,
    workOrderId?: number,
    performedBy?: number,
    notes?: string
  ): Promise<StockMovement> {
    return this.recordStockMovement(tenantId, {
      sparePartId,
      movementType: 'RETURN',
      quantity,
      reason: 'RETURN',
      workOrderId,
      performedBy,
      notes: notes || 'Retour de pièce non utilisée',
      reference: workOrderId ? `OT-${workOrderId}-RET` : undefined,
    });
  }

  /**
   * Entrée de stock (nouveau stock, commande reçue)
   */
  async inboundStock(
    tenantId: string,
    sparePartId: number,
    quantity: number,
    reason: 'PURCHASE' | 'INVENTORY' | 'ADJUSTMENT',
    reference?: string,
    performedBy?: number,
    unitCost?: string,
    notes?: string
  ): Promise<StockMovement> {
    return this.recordStockMovement(tenantId, {
      sparePartId,
      movementType: 'IN',
      quantity,
      reason,
      reference,
      performedBy,
      unitCost,
      notes,
    });
  }

  /**
   * Ajustement de stock (inventaire)
   */
  async adjustStock(
    tenantId: string,
    sparePartId: number,
    newQuantity: number,
    performedBy?: number,
    notes?: string
  ): Promise<StockMovement> {
    return this.recordStockMovement(tenantId, {
      sparePartId,
      movementType: 'ADJUSTMENT',
      quantity: newQuantity,
      reason: 'INVENTORY',
      performedBy,
      notes: notes || 'Ajustement d\'inventaire',
      reference: `INV-${Date.now()}`,
    });
  }

  /**
   * Obtenir l'historique des mouvements pour une pièce
   */
  async getMovementHistory(tenantId: string, sparePartId: number): Promise<StockMovement[]> {
    // La condition porte sur la propriété de la PIÈCE, et non sur le
    // `tenant_id` des mouvements : rien ne posait ce champ avant ce correctif,
    // donc les lignes existantes l'ont à `null` et un filtre dessus les
    // cacherait à leur propre propriétaire. Une pièce étant à un seul
    // locataire, vérifier la pièce suffit à cloisonner son historique.
    const [sparePart] = await db
      .select({ id: spareParts.id })
      .from(spareParts)
      .where(and(eq(spareParts.id, sparePartId), eq(spareParts.tenantId, tenantId)));

    if (!sparePart) return [];

    return db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.sparePartId, sparePartId))
      .orderBy(desc(stockMovements.createdAt));
  }

  /**
   * Vérifier si une pièce a un stock suffisant
   */
  async checkStockAvailability(tenantId: string, sparePartId: number, requiredQuantity: number): Promise<{
    available: boolean;
    currentStock: number;
    shortage: number;
  }> {
    const [sparePart] = await db
      .select()
      .from(spareParts)
      .where(and(eq(spareParts.id, sparePartId), eq(spareParts.tenantId, tenantId)));

    if (!sparePart) {
      throw new PieceIntrouvable(sparePartId);
    }

    const currentStock = sparePart.currentStock || 0;
    const available = currentStock >= requiredQuantity;
    const shortage = available ? 0 : requiredQuantity - currentStock;

    return {
      available,
      currentStock,
      shortage,
    };
  }

  /**
   * Réserver du stock pour un ordre de travail
   */
  async reserveStock(
    tenantId: string,
    sparePartId: number,
    quantity: number,
    workOrderId: number,
    performedBy?: number
  ): Promise<StockMovement> {
    // Vérifier la disponibilité
    const availability = await this.checkStockAvailability(tenantId, sparePartId, quantity);
    
    if (!availability.available) {
      throw new Error(`Stock insuffisant. Disponible: ${availability.currentStock}, Demandé: ${quantity}`);
    }

    return this.recordStockMovement(tenantId, {
      sparePartId,
      movementType: 'OUT',
      quantity,
      reason: 'WORK_ORDER',
      workOrderId,
      performedBy,
      notes: `Réservation pour OT-${workOrderId}`,
      reference: `OT-${workOrderId}-RES`,
    });
  }
  /**
   * Sortie automatique de stock lors de la création d'un ordre de travail
   */
  async autoStockDeductionForWorkOrder(
    tenantId: string,
    workOrderId: number, 
    partsRequired: { sparePartId: number, quantity: number }[]
  ): Promise<{ success: boolean, shortages: any[] }> {
    const shortages = [];
    
    for (const part of partsRequired) {
      try {
        // Vérifier la disponibilité
        const availability = await this.checkStockAvailability(tenantId, part.sparePartId, part.quantity);
        
        if (!availability.available) {
          shortages.push({
            sparePartId: part.sparePartId,
            required: part.quantity,
            available: availability.currentStock,
            shortage: availability.shortage
          });
          continue;
        }

        // Effectuer la sortie automatique
        await this.recordStockMovement(tenantId, {
          sparePartId: part.sparePartId,
          movementType: 'OUT',
          quantity: part.quantity,
          reason: 'WORK_ORDER',
          workOrderId: workOrderId,
          reference: `AUTO-OT-${workOrderId}`,
          notes: `Sortie automatique pour ordre de travail ${workOrderId}`,
        });

      } catch (error: any) {
        console.error(`Erreur lors de la sortie automatique pour la pièce ${part.sparePartId}:`, error);
        shortages.push({
          sparePartId: part.sparePartId,
          error: error.message
        });
      }
    }

    return {
      success: shortages.length === 0,
      shortages
    };
  }

  /**
   * Retour automatique de stock après ordre de travail
   */
  async autoStockReturnAfterWorkOrder(
    tenantId: string,
    workOrderId: number, 
    partsReturned: { sparePartId: number, quantity: number, condition: string }[]
  ): Promise<void> {
    for (const part of partsReturned) {
      try {
        const movementType = part.condition === 'good' ? 'RETURN' : 'OUT';
        const reason = part.condition === 'good' ? 'RETURN' : 'DAMAGED';
        
        await this.recordStockMovement(tenantId, {
          sparePartId: part.sparePartId,
          movementType: movementType,
          quantity: part.quantity,
          reason: reason,
          workOrderId: workOrderId,
          reference: `AUTO-RETURN-OT-${workOrderId}`,
          notes: `Retour automatique après ordre de travail ${workOrderId} - État: ${part.condition}`,
        });

      } catch (error) {
        console.error(`Erreur lors du retour automatique pour la pièce ${part.sparePartId}:`, error);
      }
    }
  }

  /**
   * Génération d'alertes de stock bas avec recommandations de commande
   */
  async generateLowStockAlerts(tenantId: string): Promise<{ alerts: any[], recommendations: any[] }> {
    try {
      // C'est ICI que la fuite sortait : la seule condition portait sur le
      // niveau de stock, donc la requête ramenait les pièces sous seuil de
      // TOUS les locataires, et l'écran des alertes les affichait.
      const lowStockParts = await db
        .select()
        .from(spareParts)
        .where(and(
          eq(spareParts.tenantId, tenantId),
          sql`${spareParts.currentStock} <= ${spareParts.minStock}`,
        ));

      const alerts = lowStockParts.map(part => ({
        id: part.id,
        partNumber: part.partNumber,
        partName: part.partName,
        currentStock: part.currentStock,
        minStock: part.minStock,
        alertLevel: part.currentStock === 0 ? 'CRITICAL' : 'WARNING',
        message: part.currentStock === 0 
          ? `Stock épuisé pour ${part.partName} (${part.partNumber})`
          : `Stock bas pour ${part.partName} (${part.partNumber}): ${part.currentStock}/${part.minStock}`
      }));

      const recommendations = lowStockParts.map(part => ({
        sparePartId: part.id,
        partNumber: part.partNumber,
        partName: part.partName,
        currentStock: part.currentStock,
        minStock: part.minStock,
        recommendedOrder: Math.max((part.maxStock ?? 0) - (part.currentStock ?? 0), (part.minStock ?? 0) * 2),
        supplier: part.supplier,
        estimatedCost: (Math.max((part.maxStock ?? 0) - (part.currentStock ?? 0), (part.minStock ?? 0) * 2) * parseFloat(part.unitPrice ?? "0")).toFixed(2)
      }));

      return { alerts, recommendations };
    } catch (error) {
      console.error('Erreur lors de la génération des alertes de stock:', error);
      return { alerts: [], recommendations: [] };
    }
  }
}

// Instance singleton
export const stockManager = new StockManager();