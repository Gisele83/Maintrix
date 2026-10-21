import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { userProfiles, tenants } from "@shared/schema";
import { eq } from "drizzle-orm";

// =====================================================
// MIDDLEWARES DE CLOISONNEMENT PAR LOCATAIRE
// =====================================================
// Ce fichier s'annonçait en tête comme une absence totale de fuite, garantie
// à cent pour cent. C'était faux, et la formule a coûté cher : elle a servi de
// garantie dans le rapport d'audit, alors que la campagne d'intégration du
// 2026-10-21 a relevé quatre accès inter-locataires dans le seul module de
// stock — dont une ÉCRITURE. Aucun middleware ne peut garantir le
// cloisonnement : il se garantit dans la REQUÊTE qui lit la donnée, en
// portant le locataire.
//
// (Les formules exactes ne sont pas reproduites ici : un test les interdit
//  dans ce fichier, et les citer les y ferait revenir.)
//
// Ce que ces middlewares font réellement :
//   • tenantSecurityMiddleware — résout le locataire de l'appelant, vérifie
//     qu'il est actif, et le pose sur la requête ;
//   • validateTenantData      — contrôle le rôle, et injecte le locataire
//     dans le corps (POST/PUT) et les paramètres (GET) ;
//   • antiLeakageValidator    — ALARME de dernier recours sur la forme des
//     réponses. Ses limites, mesurées, sont décrites à son emplacement.

export interface TenantRequest extends Request {
  tenantId?: string;
  tenantData?: {
    id: string;
    name: string;
    plan: string;
    isActive: boolean;
    maxUsers: number;
    currentUsers: number;
    features: any;
    settings: any;
  };
  user?: {
    id: number;
    tenantId: string;
    username: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role: string;
    validationLevel: number;
    isActive: boolean;
  };
}

/**
 * 🔒 TENANT ISOLATION MIDDLEWARE
 * Middleware principal pour l'isolation des données par tenant
 * - Vérifie que l'utilisateur appartient au bon tenant
 * - Injecte automatiquement tenantId dans toutes les requêtes
 * - Empêche tout accès cross-tenant
 */
export const tenantSecurityMiddleware = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Vérifier que l'utilisateur est authentifié
    if (!req.user?.id) {
      res.status(401).json({ 
        error: "AUTHENTICATION_REQUIRED",
        message: "Authentification requise pour accéder aux données"
      });
      return;
    }

    // 2. Récupérer les données utilisateur avec tenant
    const [userWithTenant] = await db
      .select({
        userId: userProfiles.id,
        tenantId: userProfiles.tenantId,
        username: userProfiles.username,
        firstName: userProfiles.firstName,
        lastName: userProfiles.lastName,
        email: userProfiles.email,
        role: userProfiles.role,
        validationLevel: userProfiles.validationLevel,
        isActive: userProfiles.isActive,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, req.user.id));

    if (!userWithTenant || !userWithTenant.tenantId) {
      res.status(403).json({
        error: "TENANT_ACCESS_DENIED", 
        message: "Utilisateur non associé à un tenant valide"
      });
      return;
    }

    // 3. Récupérer les données du tenant
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, userWithTenant.tenantId));

    if (!tenant || !tenant.isActive) {
      res.status(403).json({
        error: "TENANT_INACTIVE",
        message: "Tenant inactif ou inexistant"
      });
      return;
    }

    // 4. Injecter les données tenant dans la requête
    req.tenantId = tenant.id;
    req.tenantData = {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan || "free",
      isActive: tenant.isActive ?? true,
      maxUsers: tenant.maxUsers ?? 5,
      currentUsers: tenant.currentUsers ?? 0,
      features: tenant.features || {},
      settings: tenant.settings || {},
    };

    // 5. Mettre à jour les données utilisateur avec tenant
    req.user = {
      id: userWithTenant.userId,
      tenantId: userWithTenant.tenantId!,
      username: userWithTenant.username!,
      firstName: userWithTenant.firstName || undefined,
      lastName: userWithTenant.lastName || undefined,
      email: userWithTenant.email || undefined,
      role: userWithTenant.role!,
      validationLevel: userWithTenant.validationLevel ?? 0,
      isActive: userWithTenant.isActive ?? true,
    };

    // 6. Log de sécurité (audit trail)
    console.log(`🔐 TENANT ACCESS: User ${req.user?.id} (${req.user?.username}) accessing tenant ${req.tenantId} (${req.tenantData?.name})`);

    next();
  } catch (error) {
    console.error("❌ TENANT SECURITY ERROR:", error);
    res.status(500).json({
      error: "TENANT_SECURITY_FAILURE",
      message: "Erreur de sécurité tenant"
    });
  }
};

/**
 * 🛡️ TENANT DATA VALIDATOR
 * Middleware pour valider que toutes les données appartiennent au bon tenant
 * Empêche les tentatives d'accès cross-tenant
 */
export const validateTenantData = (allowedRoles: string[] = []) => {
  return (req: TenantRequest, res: Response, next: NextFunction): void => {
    try {
      // 1. Vérifier que tenantId est présent
      if (!req.tenantId) {
        res.status(403).json({
          error: "TENANT_ID_MISSING",
          message: "ID tenant manquant dans la requête"
        });
        return;
      }

      // 2. Vérifier les rôles autorisés si spécifiés
      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user?.role || "")) {
        res.status(403).json({
          error: "ROLE_ACCESS_DENIED",
          message: `Rôle ${req.user?.role} non autorisé. Rôles requis: ${allowedRoles.join(", ")}`
        });
        return;
      }

      // 3. Injecter automatiquement tenantId dans le body pour les POST/PUT
      if (req.method === "POST" || req.method === "PUT") {
        if (req.body && typeof req.body === "object") {
          req.body.tenantId = req.tenantId;
        }
      }

      // 4. Ajouter tenantId aux query params pour les GET
      if (req.method === "GET") {
        req.query.tenantId = req.tenantId;
      }

      next();
    } catch (error) {
      console.error("❌ TENANT VALIDATION ERROR:", error);
      res.status(500).json({
        error: "TENANT_VALIDATION_FAILURE",
        message: "Erreur de validation tenant"
      });
    }
  };
};

/**
 * 🚨 FILET ANTI-FUITE — UNE ALARME DE DERNIER RECOURS, PAS UNE GARANTIE
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QU'IL ATTRAPE, ET CE QU'IL LAISSE PASSER — MESURÉ
 * ═══════════════════════════════════════════════════════════════════
 * Ce middleware enveloppe `res.json` / `res.send` et inspecte la FORME de la
 * réponse : il cherche un `tenantId` (ou `tenant_id`) étranger sur l'objet de
 * PREMIER NIVEAU, ou sur les éléments d'un tableau de premier niveau. Rien de
 * plus profond — et c'est un choix, justifié plus bas.
 *
 * Relevé du 2026-10-21, filet monté dans une application Express minimale,
 * deux locataires. `tests/unit/filet-anti-fuite.test.ts` rejoue ce tableau,
 * ligne par ligne : il est la définition exécutable de ce qui suit.
 *
 *   forme de la charge                     donnée étrangère →  filet
 *   ──────────────────────────────────────────────────────────────────
 *   { tenantId }                  objet plat                  BLOQUE
 *   [ { tenantId } ]              tableau de 1er niveau       BLOQUE
 *   [ { tenant_id } ]             ligne de SQL brut           BLOQUE
 *   { alerts: [ { tenantId } ] }  tableau imbriqué            passe
 *   { data: { tenantId } }        objet imbriqué              passe
 *   [ [ { tenantId } ] ]          tableau à deux niveaux      passe
 *   text/csv, Excel, PDF          charge non-JSON             passe
 *   { available, currentStock }   projection sans marqueur    passe
 *
 * Les trois premières lignes sont tout ce qu'il couvre. C'est assez pour
 * rattraper la forme la plus franche d'une régression — une ligne de table
 * servie telle quelle, ce qui a bien été le cas de `/api/stock/:id/history`
 * pendant la campagne — et rien de plus.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI IL N'EST PAS DEVENU RÉCURSIF
 * ═══════════════════════════════════════════════════════════════════
 * Un détecteur parcourant toute la charge a été écrit, puis MESURÉ sur les
 * 163 routes de lecture sans paramètre, serveur réel, connecté comme
 * administrateur du locataire Alpha. Trois constats l'ont fait écarter.
 *
 * 1. IL NE DISTINGUE PAS UNE FUITE D'UNE DONNÉE VOULUE MULTI-SITE.
 *    Le récursif signale exactement 3 charges, et AUCUNE des trois n'est une
 *    fuite accidentelle :
 *      • `/api/cognitive/knowledge-graph` porte `tenantId: 'global'` sur ses
 *        49 nœuds — une sentinelle de savoir partagé (cognitive-layers/
 *        knowledge-graph.ts, enum `GLOBAL` de layer-contracts.ts), pas un
 *        locataire ;
 *      • `/api/federated-adapt/sites` et `/api/federated-adapt/specialization`
 *        servent les profils de TOUS les sites. C'est l'objet déclaré du
 *        module (« profils de maturité de tous les sites »), et l'écran
 *        « Adaptation Fédérée » les affiche.
 *    Rendre ce filet récursif ET bloquant renverrait donc 403 sur deux écrans
 *    en service, pour zéro fuite accidentelle attrapée. La distinction entre
 *    « fuite » et « voulu » porte sur l'INTENTION de la route ; elle n'est pas
 *    lisible dans la forme d'une réponse, et aucune profondeur de parcours ne
 *    la rend lisible. L'exempter par une liste de chemins reviendrait à écrire
 *    le trou dans la configuration du filet lui-même.
 *
 *    ⚠️ Que ces deux routes exposent le NOM et les métriques d'un autre
 *    locataire à l'administrateur d'Alpha reste un défaut réel. Il est
 *    signalé comme tel, et relève d'une décision produit sur ce module — pas
 *    d'un réglage de ce middleware.
 *
 * 2. LA COUVERTURE RESTERAIT MARGINALE. Sur les 158 routes qui ont servi une
 *    charge, 142 ne portent AUCUN identifiant de locataire : ce sont des
 *    projections et des agrégats. Le récursif ferait passer la couverture de
 *    6 à 11 charges sur 158 — de 4 % à 7 %. Et les deux dernières formes du
 *    tableau resteraient invisibles À TOUTE PROFONDEUR : une somme calculée
 *    sur les lignes d'autrui est un nombre, un export PDF est un flux
 *    d'octets. Ni l'un ni l'autre ne porte de quoi se trahir.
 *
 * 3. SON COÛT N'EST PAS CE QUI L'A ÉCARTÉ. Mesuré sur des charges réelles
 *    (600 ordres de travail, 250 équipements, 300 pièces) : `/api/work-orders`,
 *    456 Ko et 17 401 nœuds, parcours complet en 3,6 ms — 1,4× ce que coûte
 *    déjà la sérialisation JSON de la même charge. C'est abordable.
 *
 * CONSÉQUENCE À TENIR. Le cloisonnement se garantit là où la donnée est lue,
 * par une requête qui porte le locataire : c'est ce qu'ont fait les lots de
 * cloisonnement du stock et des capteurs IoT. Rien, dans le dépôt, ne doit
 * présenter ce filet comme une garantie — c'est pourquoi l'item « Isolation
 * multi-tenant » de server/security-audit-report.ts est passé de
 * « OK — tenantId sur toutes les requêtes DB » à un WARN qui nomme ce qui
 * n'est pas couvert.
 *
 * ═══════════════════════════════════════════════════════════════════
 * UN BLOCAGE RÉPOND 403, PLUS 200
 * ═══════════════════════════════════════════════════════════════════
 * Il répondait HTTP **200** avec un corps `{ error: 'CROSS_TENANT_DATA_DETECTED' }`.
 * Un client ne pouvait donc pas distinguer ce refus d'un succès sans inspecter
 * le corps : `res.ok` était vrai, le `.map` qui suivait tombait, et /dashboard
 * se rendait entièrement blanc (mesuré le 2026-10-20). La convention du dépôt,
 * posée au lot D5, est 403 = refusé, 404 = absent.
 *
 * Le garde-fou client `refusDeguiseEnSucces` (client/src/lib/queryClient.ts)
 * RESTE en place : il couvre les instances déployées avant ce correctif.
 */
export const antiLeakageValidator = (req: TenantRequest, res: Response, next: NextFunction): void => {
  const originalSend = res.send;
  const originalJson = res.json;

  // `res.json` finit par appeler `res.send` avec la charge sérialisée : sans ce
  // drapeau, toute réponse serait inspectée DEUX fois, la seconde après un
  // JSON.parse inutile de ce qu'on vient de sérialiser.
  let dejaInspectee = false;

  const refuser = (): Response => {
    console.error(`🚨 RÉPONSE BLOQUÉE — donnée inter-locataire sur ${req.originalUrl}`);
    // `res.statusCode` plutôt que `res.status(403)` : la route a pu poser son
    // propre statut, et on écrit par-dessus sans dépendre du chaînage.
    res.statusCode = 403;
    return originalJson.call(res, {
      error: 'CROSS_TENANT_DATA_DETECTED',
      message: 'Accès refusé : fuite de données inter-tenant détectée'
    });
  };

  res.send = function (body: any) {
    if (!dejaInspectee && req.tenantId && body) {
      dejaInspectee = true;
      if (detectLeakage(body, req.tenantId, req.originalUrl)) return refuser();
    }
    return originalSend.call(this, body);
  };

  res.json = function (obj: any) {
    if (!dejaInspectee && req.tenantId && obj) {
      dejaInspectee = true;
      if (detectLeakage(obj, req.tenantId, req.originalUrl)) return refuser();
    }
    return originalJson.call(this, obj);
  };

  next();
};

/**
 * Cherche un identifiant de locataire étranger au PREMIER NIVEAU de la charge.
 *
 * Les deux orthographes sont acceptées : les lectures en SQL brut rendent des
 * lignes en `tenant_id` (166 occurrences dans server/), alors que Drizzle rend
 * `tenantId`. Ne contrôler que la seconde rendait le filet aveugle au format
 * de ligne le plus répandu du dépôt.
 *
 * La portée s'arrête volontairement au premier niveau : voir la décision
 * documentée sur `antiLeakageValidator`. Mesuré sur les 158 charges réelles,
 * ce choix ne produit aucun faux positif — les trois charges légitimement
 * multi-locataires portent leur identifiant PLUS PROFOND.
 *
 * Retourne true si la réponse doit être bloquée.
 */
function detectLeakage(data: any, tenantId: string, endpoint: string): boolean {
  try {
    let parsed = data;
    if (typeof data === "string") {
      try {
        parsed = JSON.parse(data);
      } catch {
        // Charge non-JSON (CSV, Excel, PDF) : hors de portée de ce filet.
        return false;
      }
    }

    /** L'enregistrement porte-t-il le locataire d'un autre ? */
    const etranger = (item: any): string | null => {
      if (!item || typeof item !== "object") return null;
      for (const clef of ["tenantId", "tenant_id"] as const) {
        const valeur = item[clef];
        if (typeof valeur === "string" && valeur && valeur !== tenantId) return valeur;
      }
      return null;
    };

    if (Array.isArray(parsed)) {
      for (let i = 0; i < parsed.length; i++) {
        const autre = etranger(parsed[i]);
        if (autre) {
          console.error(`🚨 FUITE BLOQUÉE : élément ${i} de ${endpoint} — locataire ${autre} ≠ demandeur ${tenantId}`);
          return true;
        }
      }
    } else {
      const autre = etranger(parsed);
      if (autre) {
        console.error(`🚨 FUITE BLOQUÉE : ${endpoint} — locataire ${autre} ≠ demandeur ${tenantId}`);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 📊 TENANT METRICS MIDDLEWARE
 * Collecte des métriques d'utilisation par tenant pour monitoring
 */
export const tenantMetricsMiddleware = (req: TenantRequest, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  res.on("finish", () => {
    const endTime = Date.now();
    const duration = endTime - startTime;

    if (req.tenantId) {
      // Log des métriques d'utilisation
      console.log(`📊 TENANT METRICS: ${req.tenantId} | ${req.method} ${req.originalUrl} | ${res.statusCode} | ${duration}ms`);
      
      // Ici on pourrait envoyer les métriques vers un système de monitoring
      // comme Prometheus, DataDog, etc.
    }
  });

  next();
};