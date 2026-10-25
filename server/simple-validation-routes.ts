import type { Express, Request, Response } from "express";
import { and, desc, eq, isNull, type SQL } from "drizzle-orm";
import { db } from "./db";
import { purchaseOrders, validationLogs, workOrders } from "@shared/schema";
import { gmaoStorage } from "./gmao-storage";
import { normaliserRole, type RoleLocataire } from "@shared/roles";

/**
 * Circuit de validation à plusieurs niveaux — ordres de travail et bons de commande.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ (relevé le 2026-10-25)
 * ═══════════════════════════════════════════════════════════════════
 * Les deux routes d'écriture lisaient `validatorId` et `validationLevel` DANS
 * LE CORPS DE LA REQUÊTE. Aucune vérification que l'appelant possédait
 * `canValidateWorkOrders` / `canValidatePurchaseOrders`, ni le niveau qu'il
 * annonçait, ni un `maxPurchaseAmount` suffisant. Ce fichier ne contenait
 * aucune occurrence de `canValidate`, `requireRole`, `hasPermission` ni `rbac`.
 *
 * Trois conséquences, mesurées :
 *
 * 1. **N'importe quel compte authentifié pouvait approuver n'importe quoi.**
 *    Le niveau venant du client, poster `{action:"validate", validationLevel:2}`
 *    sur un ordre jamais validé au niveau 1 obtenait `canExecute = true` — alors
 *    que `shared/schema.ts` documente ce champ comme « Only true after full
 *    validation ». Le niveau 1 se sautait d'une seule requête.
 *
 * 2. **L'identité de l'approbateur n'était jamais enregistrée.** Un commentaire
 *    « Ne pas utiliser les champs avec contraintes FK pour maintenant » laissait
 *    `level1ValidatedBy` / `level2ValidatedBy` et leurs horodatages vides. Pour
 *    les bons de commande, `chefServiceValidatedBy = validatorId?.toString() ||
 *    "Chef Service"` : une chaîne fournie par le client, écrite dans une colonne
 *    `integer` référençant `user_profiles.id`, avec un libellé en dur comme
 *    valeur de repli. La contrainte FK n'était pas le problème : l'identifiant
 *    passé n'était simplement pas celui d'un compte existant. Il suffit de
 *    prendre celui de la SESSION, ce que fait désormais `validateurDeLaSession`.
 *
 * 3. **Un UUID de locataire était codé en dur comme valeur de repli**, dans un
 *    dépôt public. Ce repli n'est pas atteignable aujourd'hui — `validateSession`
 *    pose toujours `req.tenantId` et ces routes sont montées APRÈS
 *    `app.use('/api', requireAuthentication)` (server/routes.ts) ; c'est établi
 *    par lecture de la chaîne de middlewares, et corroboré par les traces du
 *    serveur, qui portent un locataire sur chacune de ces requêtes. Il est
 *    retiré quand même : rien ne garantit cet ordre de montage demain, et un
 *    repli silencieux vers un locataire précis est exactement le défaut que
 *    `server/tenant-requis.ts` existe pour empêcher.
 *
 * En GMAO, la valeur d'une validation à plusieurs niveaux tient ENTIÈREMENT à
 * sa traçabilité : qui a approuvé, à quel niveau, quand, pour quel montant. Un
 * dispositif qui a l'apparence d'un contrôle sans en être un est pire que pas
 * de contrôle : il inspire une confiance qu'il ne mérite pas.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI GARDE LE CIRCUIT MAINTENANT
 * ═══════════════════════════════════════════════════════════════════
 * Quatre barrières, dans cet ordre :
 *
 *   • l'IDENTITÉ vient de la session, jamais du corps — le corps ne sert plus
 *     qu'à désigner le document, l'action et le niveau RÉCLAMÉ ;
 *   • l'HABILITATION (`canValidate*`) et le NIVEAU (`validationLevel`) sont lus
 *     sur le profil, et un niveau réclamé supérieur au niveau détenu est refusé ;
 *   • l'ÉTAPE : le niveau réclamé doit être celui que l'état du document attend.
 *     C'est cette barrière qui ferme le saut de niveau, y compris pour quelqu'un
 *     qui détient réellement le niveau 2 ;
 *   • le PLAFOND (`maxPurchaseAmount`) pour les bons de commande.
 *
 * L'écriture et sa trace partent dans la MÊME transaction (même raison que F04,
 * voir server/intervention-execution-routes.ts) : une approbation sans trace
 * ramènerait exactement le défaut qu'on vient de fermer. L'UPDATE porte en
 * outre l'état attendu dans son `WHERE` — deux validateurs du même niveau qui
 * cliquent en même temps ne peuvent donc pas faire avancer le document deux
 * fois (zéro ligne touchée → 409).
 *
 * ✅ REFERMÉ DEPUIS (migration 0022) : `purchase_orders` ne portait AUCUNE
 * colonne `tenant_id`, et le cloisonnement d'un bon de commande entre
 * organisations était structurellement impossible. Mesuré avant correctif, sur
 * un bon de 12 500 € du locataire Alpha : le validateur de niveau 2 du
 * locataire BETA obtenait 200, la ligne d'Alpha passait à `level1_validated`,
 * son `chef_service_validated_by` recevait le compte de Beta — et
 * `validation_logs` inscrivait la trace sous le locataire de BETA tout en
 * pointant la ligne d'ALPHA. La trace n'était donc pas seulement incomplète,
 * elle était MAL CLASSÉE : l'historique d'Alpha ne montrait jamais cette
 * approbation, et celui de Beta montrait l'approbation d'un document qui ne lui
 * appartient pas. Les quatre barrières ci-dessus s'appliquaient correctement…
 * au profit du mauvais document.
 *
 * La colonne existe maintenant (migration 0022, sur le modèle de 0011→0021),
 * elle est NOT NULL, et c'est une CINQUIÈME barrière, posée AVANT les quatre
 * autres : le bon est cherché DANS le locataire de la session, de sorte qu'un
 * identifiant d'une autre organisation donne 404 au lieu d'une approbation.
 * L'UPDATE porte lui aussi le locataire dans son `WHERE` — le 404 n'est pas une
 * politesse d'affichage par-dessus une écriture qui aurait lieu quand même.
 */

/** Niveau final : au-delà, le document est validé et exécutable/imprimable. */
const NIVEAU_FINAL_ORDRE_DE_TRAVAIL = 2;
const NIVEAU_FINAL_BON_DE_COMMANDE = 3;

/**
 * Ce que la SESSION — et elle seule — dit du validateur.
 * Aucun de ces champs n'est lisible depuis le corps de la requête.
 */
interface Validateur {
  id: number;
  tenantId: string;
  role: RoleLocataire;
  /** `user_profiles.validation_level` : 0 = aucun droit, 1-3 = niveaux. */
  niveau: number;
  peutValiderOrdresDeTravail: boolean;
  peutValiderBonsDeCommande: boolean;
  /** `user_profiles.max_purchase_amount`, ou `null` quand aucun plafond n'est fixé. */
  plafondAchat: number | null;
}

/**
 * Le validateur de la requête, ou un refus net.
 *
 * `req.user` est la ligne `user_profiles` relue à CHAQUE requête par
 * `validateSession` (server/enterprise-auth-middleware.ts) : retirer une
 * habilitation prend donc effet immédiatement, sans attendre une reconnexion.
 *
 * Le locataire absent répond 400 et non 401 : après `requireAuthentication`, une
 * session valide a forcément un locataire. S'il manque, ce n'est pas la session
 * de l'appelant qui est en cause mais la requête qui n'est pas servable — même
 * lecture que `requireTenant` dans server/intervention-execution-routes.ts et
 * que `TENANT_REQUIRED` dans server/tenant-middleware.ts. (`tenantRequis()`
 * répond 401 parce qu'il couvre, lui, les routes où la session peut manquer.)
 */
function validateurDeLaSession(req: Request, res: Response): Validateur | null {
  const tenantId = (req as any).tenantId as string | undefined;
  if (!tenantId) {
    res.status(400).json({
      error: "LOCATAIRE_NON_RESOLU",
      message: "Aucune organisation résolue pour cette requête : aucune écriture n'a eu lieu.",
    });
    return null;
  }

  const compte = (req as any).user;
  if (!compte?.id) {
    res.status(401).json({
      error: "AUTHENTIFICATION_REQUISE",
      message: "Aucun compte en session : la validation exige une identité.",
    });
    return null;
  }

  // Un rôle hors référentiel n'est pas deviné : il est refusé. C'est la règle
  // posée par shared/roles.ts, et c'est ce qui a été mesuré ici — l'écran
  // envoyait `userRole="Chef de Service"`, valeur qui n'existe dans aucune
  // nomenclature du dépôt.
  const role = normaliserRole(compte.role);
  if (!role) {
    res.status(403).json({
      error: "ROLE_INCONNU",
      message:
        `Le rôle « ${String(compte.role)} » n'appartient pas au référentiel des rôles : ` +
        "aucun droit de validation ne peut en être déduit.",
    });
    return null;
  }

  // ⚠️ Toute conversion douteuse retombe du côté qui REFUSE.
  //
  // `Number("abc")` donne `NaN`, et `NaN < 2` est FAUX : un niveau illisible
  // aurait franchi le contrôle de niveau sans un mot. Un niveau qui n'est pas
  // un entier positif vaut donc 0 — aucun droit. Même raison pour le plafond :
  // un plafond illisible est traité comme « aucun plafond fixé », état déjà
  // porté par la colonne à NULL et qui ne contourne rien, puisque le droit de
  // valider un achat dépend d'abord du drapeau et du niveau.
  const niveauBrut = Number(compte.validationLevel ?? 0);
  const plafondBrut = Number(compte.maxPurchaseAmount);

  return {
    id: compte.id,
    tenantId,
    role,
    niveau: Number.isInteger(niveauBrut) && niveauBrut > 0 ? niveauBrut : 0,
    peutValiderOrdresDeTravail: compte.canValidateWorkOrders === true,
    peutValiderBonsDeCommande: compte.canValidatePurchaseOrders === true,
    plafondAchat:
      compte.maxPurchaseAmount != null && compte.maxPurchaseAmount !== "" && Number.isFinite(plafondBrut)
        ? plafondBrut
        : null,
  };
}

/** Un identifiant de document utilisable, ou `null`. */
function identifiantDocument(...candidats: unknown[]): number | null {
  for (const candidat of candidats) {
    if (candidat === undefined || candidat === null || candidat === "") continue;
    const n = Number(candidat);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

/**
 * Le niveau RÉCLAMÉ par l'appelant, borné au domaine.
 *
 * Il reste lu dans le corps — c'est une intention, pas une habilitation : le
 * droit de l'exercer est vérifié juste après, contre la session ET contre
 * l'état du document.
 */
function niveauReclame(valeur: unknown, maximum: number): number | null {
  const n = Number(valeur);
  if (!Number.isInteger(n) || n < 1 || n > maximum) return null;
  return n;
}

/**
 * Le niveau que l'état courant du document attend, ou `null` si le circuit est
 * déjà clos (validé, rejeté, ou statut inconnu).
 */
function niveauAttendu(
  statutCourant: string | null | undefined,
  etapes: ReadonlyArray<{ statutAvant: string; niveau: number }>,
): number | null {
  // `validation_status` est `DEFAULT 'pending'` mais nullable : une ligne
  // insérée en SQL direct peut porter NULL, et doit alors suivre le même
  // chemin qu'un document neuf plutôt que d'être refusée sans explication.
  const statut = statutCourant ?? "pending";
  return etapes.find((e) => e.statutAvant === statut)?.niveau ?? null;
}

/**
 * La clause qui exige que le statut n'ait pas bougé depuis la lecture.
 *
 * `eq(colonne, null)` ne conviendrait PAS : en SQL, `validation_status = NULL`
 * ne vaut jamais vrai, donc une ligne au statut NULL — que `niveauAttendu()`
 * traite pourtant comme neuve — ne serait jamais touchée, et l'appelant
 * recevrait un 409 « l'état a changé » alors que rien n'a changé.
 */
function statutInchange(colonne: any, statutCourant: string | null | undefined): SQL {
  return statutCourant == null ? isNull(colonne) : eq(colonne, statutCourant);
}

/** Les refus d'habilitation, communs aux deux circuits. */
function refuserHabilitation(
  res: Response,
  validateur: Validateur,
  habilite: boolean,
  niveauDemande: number,
): boolean {
  if (!habilite) {
    res.status(403).json({
      error: "VALIDATION_NON_HABILITEE",
      message: "Votre compte ne porte pas le droit de valider ce type de document.",
    });
    return true;
  }

  if (validateur.niveau < niveauDemande) {
    res.status(403).json({
      error: "NIVEAU_INSUFFISANT",
      message:
        `Validation de niveau ${niveauDemande} demandée, votre niveau est ` +
        `${validateur.niveau} : refusé.`,
      niveauRequis: niveauDemande,
      niveauDetenu: validateur.niveau,
    });
    return true;
  }

  return false;
}

export function registerSimpleValidationRoutes(app: Express) {

  // ── Ordres de travail : deux niveaux ──────────────────────────────────
  // `pending` → `level1_validated` → `validated` (+ canExecute).
  const ETAPES_ORDRE_DE_TRAVAIL = [
    { statutAvant: "pending", niveau: 1 },
    { statutAvant: "level1_validated", niveau: 2 },
  ] as const;

  // ── Bons de commande : trois niveaux ──────────────────────────────────
  // `pending` → `level1_validated` (chef de service) → `level2_validated`
  // (direction) → `validated` (+ canPrint, service achat).
  //
  // ⚠️ Ce vocabulaire de statuts est celui que ces routes écrivent ET relisent
  // depuis l'origine. `shared/schema.ts` en documente un autre
  // (`chef_service_validated`, `directeur_validated`, `ready_for_print`), que
  // `gmaoStorage.validatePurchaseOrder` emploie — fonction appelée seulement
  // par `server/validation-routes.ts`, qui n'est montée nulle part. Aligner les
  // deux demanderait de reprendre les lignes déjà écrites en base : hors de ce
  // lot, dont l'objet est le contrôle d'accès. On conserve donc le vocabulaire
  // réellement en service, pour ne pas rendre inatteignables les documents
  // déjà engagés dans le circuit.
  const ETAPES_BON_DE_COMMANDE = [
    { statutAvant: "pending", niveau: 1 },
    { statutAvant: "level1_validated", niveau: 2 },
    { statutAvant: "level2_validated", niveau: 3 },
  ] as const;

  /** Le statut qui suit une validation au niveau donné. */
  function statutApres(
    niveau: number,
    etapes: ReadonlyArray<{ statutAvant: string; niveau: number }>,
    niveauFinal: number,
  ): string {
    if (niveau >= niveauFinal) return "validated";
    return etapes.find((e) => e.niveau === niveau + 1)!.statutAvant;
  }

  // ═══════════════════════════════════════════════════════════════════
  // LECTURES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * La file d'attente de l'ordre de travail, au niveau DE LA SESSION.
   *
   * Le niveau venait de `req.query.validationLevel` : n'importe qui pouvait
   * lire la file de n'importe quel niveau. Il vient désormais du profil, et un
   * compte sans habilitation reçoit une liste vide plutôt que la file d'un
   * échelon qui n'est pas le sien.
   */
  app.get("/api/validation/work-orders/pending", async (req, res) => {
    try {
      const validateur = validateurDeLaSession(req, res);
      if (!validateur) return;

      if (!validateur.peutValiderOrdresDeTravail || validateur.niveau < 1) {
        return res.json([]);
      }

      const etape = ETAPES_ORDRE_DE_TRAVAIL.find((e) => e.niveau === validateur.niveau)
        ?? ETAPES_ORDRE_DE_TRAVAIL[ETAPES_ORDRE_DE_TRAVAIL.length - 1];

      const ordres = await gmaoStorage.getWorkOrdersByValidationStatus(
        etape.statutAvant,
        validateur.tenantId,
      );

      const formates = ordres.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber || `WO-${order.id}`,
        title: order.title || 'Ordre de travail',
        description: order.description || 'Description non disponible',
        equipmentType: order.orderType || 'Non spécifié',
        priority: order.priority || 'medium',
        assignedTo: order.assignedTo ? `Technicien ${order.assignedTo}` : 'Non assigné',
        estimatedDuration: order.estimatedDuration ? `${Math.floor(order.estimatedDuration / 60)}h${order.estimatedDuration % 60}min` : 'Non défini',
        scheduledDate: order.scheduledStart ? new Date(order.scheduledStart).toISOString().split('T')[0] : null,
        validationStatus: order.validationStatus,
        totalAmount: order.cost?.toString() || '0.00',
        currency: 'EUR',
        requestedBy: order.requestedBy ? `User ${order.requestedBy}` : 'Service Maintenance',
        createdAt: order.createdAt,
        documentType: 'work_order',
        // Le niveau que CE document attend : l'écran n'a plus à le deviner.
        niveauAttendu: etape.niveau,
      }));

      res.json(formates);
    } catch (error) {
      console.error("Error fetching work orders for validation:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des ordres de travail" });
    }
  });

  /**
   * La file d'attente des bons de commande, au niveau DE LA SESSION.
   *
   * Deux défauts retirés ici :
   *
   *   • le niveau était déduit du RÔLE par une table écrite à la main
   *     (`maintenance_manager → 3`, `planner → 2`…), ce qui court-circuitait
   *     `user_profiles.validation_level` — la colonne qui porte réellement le
   *     droit, et que l'écran d'administration des comptes renseigne ;
   *   • deux bons de commande FICTIFS (« PO-2025-001 », « PO-2025-002 »,
   *     4 250 € de moteur) étaient injectés dès que la file était vide. Ils
   *     portaient les identifiants 1 et 2 : cliquer « Valider » sur l'un d'eux
   *     postait `purchaseorderId: 1` et faisait avancer le VRAI bon de commande
   *     n° 1 de la base, quel qu'il soit. Une donnée absente s'affiche comme
   *     absente.
   */
  app.get("/api/validation/purchase-orders/pending", async (req, res) => {
    try {
      const validateur = validateurDeLaSession(req, res);
      if (!validateur) return;

      if (!validateur.peutValiderBonsDeCommande || validateur.niveau < 1) {
        return res.json([]);
      }

      const etape = ETAPES_BON_DE_COMMANDE.find((e) => e.niveau === validateur.niveau)
        ?? ETAPES_BON_DE_COMMANDE[ETAPES_BON_DE_COMMANDE.length - 1];

      // Le locataire de la session, depuis la migration 0022 : cette file
      // contenait les bons de commande de TOUTE l'instance — numéro, montant,
      // fournisseur, demandeur — faute d'une colonne sur laquelle filtrer.
      const bons = await gmaoStorage.getPurchaseOrdersByStatus(etape.statutAvant, validateur.tenantId);

      res.json(bons.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType || "Pièces de rechange",
        description: order.notes || "Commande créée via le système",
        supplier: order.supplierId ? `Fournisseur ${order.supplierId}` : "Non renseigné",
        totalAmount: order.totalAmount,
        currency: order.currency || "EUR",
        validationStatus: order.validationStatus,
        priority: order.priority,
        requestedBy: order.requestedBy,
        deliveryDate: order.expectedDelivery,
        createdAt: order.createdAt,
        documentType: order.documentType,
        niveauAttendu: etape.niveau,
      })));
    } catch (error) {
      console.error("Error fetching pending purchase orders:", error);
      res.status(500).json({ message: "Failed to fetch pending orders" });
    }
  });

  /**
   * L'historique RÉEL des validations du locataire.
   *
   * Cette route renvoyait deux entrées écrites en dur — « Validation niveau 1 -
   * ordre de travail approuvé », datée de l'instant de l'appel, attribuée au
   * validateur n° 1. L'onglet « Historique » montrait donc une trace inventée,
   * sur un écran dont c'est précisément la raison d'être. La table
   * `validation_logs` existe et porte `tenant_id` : elle est désormais lue.
   */
  app.get("/api/validation/statistics", async (req, res) => {
    try {
      const validateur = validateurDeLaSession(req, res);
      if (!validateur) return;

      // Les plus récentes d'abord, et bornées : l'historique d'un locataire
      // actif n'a pas de limite de taille, et l'écran n'en affiche que dix.
      const logs = await db
        .select()
        .from(validationLogs)
        .where(eq(validationLogs.tenantId, validateur.tenantId))
        .orderBy(desc(validationLogs.validationDate))
        .limit(200);

      res.json({ logs });
    } catch (error) {
      console.error("Error fetching validation statistics:", error);
      res.status(500).json({ message: "Erreur lors de la récupération de l'historique" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ÉCRITURES
  // ═══════════════════════════════════════════════════════════════════

  app.post("/api/validation/work-orders/validate", async (req, res) => {
    try {
      const validateur = validateurDeLaSession(req, res);
      if (!validateur) return;

      // `workOrderId` (casse camel) est accepté en plus de `workorderId` et
      // `orderId` : `client/src/pages/secure-validation.tsx` envoyait cette
      // forme-là, que la route ne lisait pas — l'identifiant arrivait
      // `undefined` et aucune validation ne pouvait aboutir depuis cet écran.
      const { workorderId, workOrderId: idCamel, orderId, action, validationLevel, comments } = req.body;
      const workOrderId = identifiantDocument(workorderId, idCamel, orderId);
      if (workOrderId === null) {
        return res.status(400).json({
          error: "DOCUMENT_NON_DESIGNE",
          message: "Aucun ordre de travail désigné.",
        });
      }
      if (action !== "validate" && action !== "reject") {
        return res.status(400).json({
          error: "ACTION_INCONNUE",
          message: "L'action attendue est « validate » ou « reject ».",
        });
      }

      // L'ordre est cherché DANS le locataire de la session : un identifiant
      // d'une autre organisation donne 404, pas une écriture.
      const ordre = await gmaoStorage.getWorkOrderById(workOrderId, validateur.tenantId);
      if (!ordre) {
        return res.status(404).json({
          error: "ORDRE_INTROUVABLE",
          message: `Ordre de travail #${workOrderId} introuvable dans votre organisation.`,
        });
      }

      const attendu = niveauAttendu(ordre.validationStatus, ETAPES_ORDRE_DE_TRAVAIL);
      if (attendu === null) {
        return res.status(409).json({
          error: "CIRCUIT_CLOS",
          message:
            `Cet ordre de travail est déjà au statut « ${ordre.validationStatus} » : ` +
            "aucune validation n'y est attendue.",
        });
      }

      // Rejeter engage autant que valider : même habilitation, et au moins le
      // niveau que le document attend. L'ancienne route acceptait un rejet de
      // n'importe qui et inscrivait `rejectedBy` depuis le corps.
      const niveauDemande = action === "validate"
        ? niveauReclame(validationLevel, NIVEAU_FINAL_ORDRE_DE_TRAVAIL)
        : attendu;
      if (niveauDemande === null) {
        return res.status(400).json({
          error: "NIVEAU_INVALIDE",
          message: `Le niveau de validation attendu est 1 ou ${NIVEAU_FINAL_ORDRE_DE_TRAVAIL}.`,
        });
      }

      if (refuserHabilitation(res, validateur, validateur.peutValiderOrdresDeTravail, niveauDemande)) {
        return;
      }

      if (action === "validate" && niveauDemande !== attendu) {
        // C'est ici que le saut de niveau se referme : détenir le niveau 2 ne
        // permet pas de l'exercer sur un ordre que personne n'a validé au 1.
        return res.status(409).json({
          error: "ETAPE_INATTENDUE",
          message:
            `Cet ordre de travail attend une validation de niveau ${attendu}, ` +
            `pas ${niveauDemande}.`,
          niveauAttendu: attendu,
        });
      }

      const maintenant = new Date();
      const nouveauStatut = action === "validate"
        ? statutApres(niveauDemande, ETAPES_ORDRE_DE_TRAVAIL, NIVEAU_FINAL_ORDRE_DE_TRAVAIL)
        : "rejected";

      const champs: Record<string, unknown> = { validationStatus: nouveauStatut, updatedAt: maintenant };

      if (action === "validate") {
        // ✅ L'approbateur est enfin inscrit. `level1ValidatedBy` et
        // `level2ValidatedBy` référencent `user_profiles.id` : l'identifiant de
        // session existe par construction, la contrainte FK est donc satisfaite —
        // ce que l'identifiant venu du client ne garantissait pas.
        if (niveauDemande === 1) {
          champs.level1ValidatedBy = validateur.id;
          champs.level1ValidatedAt = maintenant;
          if (comments) champs.level1ValidationNotes = comments;
        } else {
          champs.level2ValidatedBy = validateur.id;
          champs.level2ValidatedAt = maintenant;
          if (comments) champs.level2ValidationNotes = comments;
          // Niveau final : l'ordre devient exécutable. Jamais avant.
          champs.canExecute = true;
        }
      } else {
        champs.rejectedBy = validateur.id;
        champs.rejectedAt = maintenant;
        champs.rejectionReason = comments || "Rejet sans commentaire";
      }

      // 🔒 TRANSACTION : le changement d'état et sa trace, ou rien.
      const applique = await db.transaction(async (tx) => {
        const [maj] = await tx
          .update(workOrders)
          .set(champs)
          .where(and(
            eq(workOrders.id, workOrderId),
            eq(workOrders.tenantId, validateur.tenantId),
            // L'état attendu est porté par le WHERE : si un autre validateur a
            // fait avancer le document entre-temps, zéro ligne est touchée et
            // la transaction se solde par un 409 au lieu d'une double avancée.
            statutInchange(workOrders.validationStatus, ordre.validationStatus),
          ))
          .returning();

        if (!maj) return null;

        await tx.insert(validationLogs).values({
          tenantId: validateur.tenantId,
          recordType: "work_order",
          recordId: workOrderId,
          validationLevel: niveauDemande,
          action,
          validatedBy: validateur.id,
          validationDate: maintenant,
          comments: comments ?? null,
          previousStatus: ordre.validationStatus,
          newStatus: nouveauStatut,
        });

        return maj;
      });

      if (!applique) {
        return res.status(409).json({
          error: "ETAT_MODIFIE",
          message: "Cet ordre de travail a changé d'état entre-temps : rechargez la file.",
        });
      }

      res.json({
        success: true,
        message: action === "validate"
          ? `Ordre de travail validé — niveau ${niveauDemande}`
          : "Ordre de travail rejeté",
        validationStatus: applique.validationStatus,
        canExecute: applique.canExecute,
      });
    } catch (error: any) {
      console.error("Error validating work order:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la validation de l'ordre de travail",
      });
    }
  });

  app.post("/api/validation/purchase-orders/validate", async (req, res) => {
    try {
      const validateur = validateurDeLaSession(req, res);
      if (!validateur) return;

      const { purchaseorderId, purchaseOrderId: idCamel, orderId, action, validationLevel, comments } = req.body;
      const purchaseOrderId = identifiantDocument(purchaseorderId, idCamel, orderId);
      if (purchaseOrderId === null) {
        return res.status(400).json({
          error: "DOCUMENT_NON_DESIGNE",
          message: "Aucun bon de commande désigné.",
        });
      }
      if (action !== "validate" && action !== "reject") {
        return res.status(400).json({
          error: "ACTION_INCONNUE",
          message: "L'action attendue est « validate » ou « reject ».",
        });
      }

      // Le bon est cherché DANS le locataire de la session : un identifiant
      // d'une autre organisation donne 404, pas une approbation. C'est la
      // barrière que la migration 0022 a rendue possible — même forme que pour
      // l'ordre de travail ci-dessus.
      const bon = await gmaoStorage.getPurchaseOrderById(purchaseOrderId, validateur.tenantId);
      if (!bon) {
        return res.status(404).json({
          error: "BON_INTROUVABLE",
          message: `Bon de commande #${purchaseOrderId} introuvable dans votre organisation.`,
        });
      }

      const attendu = niveauAttendu(bon.validationStatus, ETAPES_BON_DE_COMMANDE);
      if (attendu === null) {
        return res.status(409).json({
          error: "CIRCUIT_CLOS",
          message:
            `Ce bon de commande est déjà au statut « ${bon.validationStatus} » : ` +
            "aucune validation n'y est attendue.",
        });
      }

      const niveauDemande = action === "validate"
        ? niveauReclame(validationLevel, NIVEAU_FINAL_BON_DE_COMMANDE)
        : attendu;
      if (niveauDemande === null) {
        return res.status(400).json({
          error: "NIVEAU_INVALIDE",
          message: `Le niveau de validation attendu est compris entre 1 et ${NIVEAU_FINAL_BON_DE_COMMANDE}.`,
        });
      }

      if (refuserHabilitation(res, validateur, validateur.peutValiderBonsDeCommande, niveauDemande)) {
        return;
      }

      if (action === "validate" && niveauDemande !== attendu) {
        return res.status(409).json({
          error: "ETAPE_INATTENDUE",
          message:
            `Ce bon de commande attend une validation de niveau ${attendu}, ` +
            `pas ${niveauDemande}.`,
          niveauAttendu: attendu,
        });
      }

      // Un bon de commande engage une DÉPENSE : le plafond du compte est
      // opposable, au même titre que son niveau. `maxPurchaseAmount` à NULL
      // signifie « aucun plafond fixé » et ne bloque donc rien ; un montant
      // absent sur le bon ne peut pas être comparé et n'autorise rien non plus.
      //
      // `Number.isFinite` et non un simple `!= null` : un `total_amount`
      // illisible donnerait `NaN`, et toute comparaison avec `NaN` étant fausse,
      // le plafond serait franchi sans un mot. Un montant inexploitable est
      // traité comme un montant absent — il n'autorise rien de plus.
      const brut = bon.totalAmount != null ? Number(bon.totalAmount) : null;
      const montant = brut !== null && Number.isFinite(brut) ? brut : null;
      if (
        action === "validate" &&
        validateur.plafondAchat !== null &&
        montant !== null &&
        montant > validateur.plafondAchat
      ) {
        return res.status(403).json({
          error: "PLAFOND_DEPASSE",
          message:
            `Montant de ${montant} ${bon.currency || "EUR"} supérieur à votre plafond ` +
            `d'approbation (${validateur.plafondAchat}) : refusé.`,
          montant,
          plafond: validateur.plafondAchat,
        });
      }

      const maintenant = new Date();
      const nouveauStatut = action === "validate"
        ? statutApres(niveauDemande, ETAPES_BON_DE_COMMANDE, NIVEAU_FINAL_BON_DE_COMMANDE)
        : "rejected";

      const champs: Record<string, unknown> = { validationStatus: nouveauStatut, updatedAt: maintenant };

      if (action === "validate") {
        if (niveauDemande === 1) {
          // Colonne `integer` référençant `user_profiles.id` : on y écrit un
          // identifiant, non plus `validatorId?.toString() || "Chef Service"`.
          champs.chefServiceValidatedBy = validateur.id;
          champs.chefServiceValidatedAt = maintenant;
        } else if (niveauDemande === 2) {
          champs.directeurValidatedBy = validateur.id;
          champs.directeurValidatedAt = maintenant;
        } else {
          // Niveau final (service achat) : le bon devient imprimable.
          //
          // `printedAt` n'est PLUS renseigné ici. L'ancienne route l'écrivait
          // avec le commentaire « Auto-print and save » : elle datait une
          // impression qui n'avait pas eu lieu. Le marquage d'impression a sa
          // propre route (`POST /api/purchase-orders/:id/mark-printed`), et
          // l'identité de ce troisième approbateur est portée par
          // `validation_logs` — la table n'a pas de colonne pour lui.
          champs.canPrint = true;
        }
        if (comments) champs.validationNotes = comments;
      } else {
        champs.rejectedBy = validateur.id;
        champs.rejectedAt = maintenant;
        champs.rejectionReason = comments || "Rejet sans commentaire";
        if (niveauDemande === 1) champs.chefServiceRejectionReason = comments;
        else if (niveauDemande === 2) champs.directeurRejectionReason = comments;
      }

      const applique = await db.transaction(async (tx) => {
        const [maj] = await tx
          .update(purchaseOrders)
          .set(champs)
          .where(and(
            eq(purchaseOrders.id, purchaseOrderId),
            // Le locataire est porté par le WHERE de l'écriture, et pas
            // seulement par la lecture qui précède : un 404 rendu par-dessus un
            // UPDATE qui s'exécute quand même ne protégerait rien. Même forme
            // que pour les ordres de travail.
            eq(purchaseOrders.tenantId, validateur.tenantId),
            statutInchange(purchaseOrders.validationStatus, bon.validationStatus),
          ))
          .returning();

        if (!maj) return null;

        await tx.insert(validationLogs).values({
          tenantId: validateur.tenantId,
          recordType: "purchase_order",
          recordId: purchaseOrderId,
          validationLevel: niveauDemande,
          action,
          validatedBy: validateur.id,
          validationDate: maintenant,
          comments: comments ?? null,
          previousStatus: bon.validationStatus,
          newStatus: nouveauStatut,
        });

        return maj;
      });

      if (!applique) {
        return res.status(409).json({
          error: "ETAT_MODIFIE",
          message: "Ce bon de commande a changé d'état entre-temps : rechargez la file.",
        });
      }

      res.json({
        success: true,
        message: action === "validate"
          ? `Bon de commande validé — niveau ${niveauDemande}`
          : "Bon de commande rejeté",
        validationStatus: applique.validationStatus,
        canPrint: applique.canPrint,
      });
    } catch (error) {
      console.error("Error validating purchase order:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la validation du bon de commande",
      });
    }
  });

  console.log("✅ Validation routes registered (identité et niveau issus de la session)");
}
