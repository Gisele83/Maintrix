// ===================================================================
// CCTP COMPLIANCE ROUTES - Routes API conformité cahier des charges
// ===================================================================

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  cctpComplianceService,
  PurchaseOrderConfigSchema,
  WorkOrderConfigSchema,
  ReportingConfigSchema,
  type Exigence,
} from "./cctp-compliance-system";
import { db } from "./db";
import { purchaseOrders, tenants } from "../shared/schema";
import { and, eq } from "drizzle-orm";
import { tenantRequis } from "./tenant-requis";

/**
 * Conformité CCTP — configuration des bons de commande, des rapports, et le
 * relevé de conformité.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ : L'APPELANT DÉSIGNAIT L'ORGANISATION
 * ═══════════════════════════════════════════════════════════════════
 * Les dix routes de ce fichier prenaient le locataire DANS L'URL
 * (`/tenant/:tenantId/...`) et le passaient tel quel au service. Aucune
 * ne le comparait à la session. Changer un segment d'URL suffisait donc à
 * travailler dans les données d'une autre entreprise :
 *
 *   • `GET  /tenant/:id/purchase-order-config` — seuils de montant, entête
 *     d'impression, et la GRILLE DE VALIDATION (qui approuve jusqu'à combien) ;
 *   • `PUT  /tenant/:id/purchase-order-config` — la même, en ÉCRITURE : on
 *     pouvait abaisser le seuil de validation d'un concurrent, ou réécrire son
 *     entête d'entreprise ;
 *   • `PUT  /tenant/:id/reporting-config` et `PUT /tenant/:id/auto-reports` —
 *     écriture également, dont la liste de diffusion des rapports par courriel ;
 *   • `GET  /tenant/:id/purchase-order/:bon/document` — le PDF du bon de
 *     commande, avec l'entête du locataire nommé dans l'URL ;
 *   • `POST /tenant/:id/work-order/:ot/generate-report` — voir plus bas, le
 *     plus grave.
 *
 * Le repli du client rendait la chose peu visible : `client/src/pages/
 * cctp-compliance.tsx` envoie l'organisation réellement authentifiée depuis sa
 * correction du 19/10/2026. Le défaut n'était donc pas atteint par l'écran — il
 * l'était par quiconque formait l'URL à la main.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI GARDE CES ROUTES MAINTENANT
 * ═══════════════════════════════════════════════════════════════════
 * `locataireDeLaSession()` ci-dessous. Le segment `:tenantId` RESTE dans les
 * chemins — l'écran les construit ainsi, et les retirer casserait ses clés de
 * requête (voir tests/unit/cles-de-requete.test.ts) — mais il n'est plus une
 * autorisation : c'est la session qui fait foi, et un segment qui la contredit
 * fait échouer la requête en 403 au lieu d'être suivi. Un paramètre de chemin
 * qu'on ignorerait en silence serait pire : il laisserait croire qu'il sert.
 */

const router = Router();

/**
 * Le locataire de la requête — celui de la SESSION, jamais celui de l'URL.
 *
 * Deux refus distincts, et la nuance compte :
 *
 *   • pas de session → 401, par `tenantRequis()` (server/tenant-requis.ts) ;
 *   • session valide mais l'URL nomme une AUTRE organisation → 403. Ce n'est
 *     pas un 404 : on ne cherche pas une ressource, on refuse une portée. Et
 *     ce n'est pas un oracle d'existence — la réponse est la même que le
 *     locataire nommé existe ou non, puisqu'on ne va pas le voir.
 */
function locataireDeLaSession(req: Request, res: Response): string | null {
  const session = tenantRequis(req, res);
  if (!session) return null;

  const duChemin = req.params.tenantId;
  if (duChemin && duChemin !== session) {
    res.status(403).json({
      error: "LOCATAIRE_ETRANGER",
      message:
        "Cette requête désigne une organisation qui n'est pas la vôtre : refusée. " +
        "Aucune lecture ni écriture n'a eu lieu.",
    });
    return null;
  }

  return session;
}

// =====================================================
// CONFIGURATION BONS DE COMMANDE PAR TENANT
// =====================================================

// Obtenir la configuration Bon de Commande d'un tenant
router.get("/tenant/:tenantId/purchase-order-config", async (req, res) => {
  try {
    const tenantId = locataireDeLaSession(req, res);
    if (!tenantId) return;
    
    const config = await cctpComplianceService.getPurchaseOrderConfig(tenantId);
    
    if (!config) {
      // Configuration par défaut si aucune configuration n'existe
      const defaultConfig = {
        letterOrderThreshold: 1000,
        purchaseOrderThreshold: 5000,
        companyHeader: {
          name: "Entreprise",
          address: "Adresse non configurée",
          phone: "Téléphone non configuré",
          email: "email@entreprise.com"
        },
        validationLevels: [
          { level: 1, name: "Chef de Service", maxAmount: 2000, roleRequired: "manager" },
          { level: 2, name: "Directeur Maintenance", maxAmount: 10000, roleRequired: "admin" },
          { level: 3, name: "Directeur Général", maxAmount: 50000, roleRequired: "owner" }
        ],
        autoGenerate: true,
        numberingPrefix: "BC"
      };
      
      return res.json(defaultConfig);
    }
    
    res.json(config);
  } catch (error) {
    console.error("Error fetching purchase order config:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de la configuration" });
  }
});

// Mettre à jour la configuration Bon de Commande d'un tenant
router.put("/tenant/:tenantId/purchase-order-config", async (req, res) => {
  try {
    const tenantId = locataireDeLaSession(req, res);
    if (!tenantId) return;

    const config = PurchaseOrderConfigSchema.parse(req.body);
    
    await cctpComplianceService.updatePurchaseOrderConfig(tenantId, config);
    
    res.json({ 
      success: true, 
      message: "Configuration Bon de Commande mise à jour avec succès" 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Données de configuration invalides", 
        details: error.errors 
      });
    }
    console.error("Error updating purchase order config:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de la configuration" });
  }
});

// =====================================================
// GÉNÉRATION DOCUMENTS BONS DE COMMANDE / LETTRES
// =====================================================

// Générer un Bon de Commande ou Lettre de Commande en HTML/PDF
router.get("/tenant/:tenantId/purchase-order/:purchaseOrderId/document", async (req, res) => {
  try {
    const tenantId = locataireDeLaSession(req, res);
    if (!tenantId) return;

    const { purchaseOrderId } = req.params;
    const { type } = req.query; // 'letter' | 'purchase_order' | auto
    
    const result = await cctpComplianceService.generatePurchaseDocument(
      tenantId,
      parseInt(purchaseOrderId),
      type as 'letter' | 'purchase_order' | undefined
    );
    
    // Convert HTML to PDF using Puppeteer
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-gpu',
        '--disable-dev-tools',
        '--no-first-run',
        // ⚠️ F11 — `--single-process` et `--no-zygote` ont été RETIRÉS.
        //
        // Une fois Chromium réellement présent dans l'image, le lancement
        // échouait encore : « Protocol error (Target.setDiscoverTargets):
        // Target closed ». Ces deux drapeaux, tolérés par les anciennes
        // versions, font crasher Chromium moderne au démarrage — le processus
        // meurt avant que Puppeteer n'ait pu s'y attacher.
        //
        // Mesuré dans le conteneur : avec eux, échec systématique ; sans eux,
        // le PDF est produit. Ils n'apportaient qu'une économie de mémoire
        // marginale, sans rapport avec la fonction rendue.
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      acceptInsecureCerts: true,
      ignoreDefaultArgs: ['--disable-extensions']
    });
    
    const page = await browser.newPage();
    
    // Set content and generate PDF
    //
    // `networkidle0` était passé ici, mais Puppeteer l'exclut désormais du type
    // de `setContent` : ces états d'inactivité réseau n'ont de sens que pour une
    // navigation, pas pour un contenu injecté en mémoire. `load` est l'attente
    // pertinente pour un document HTML statique.
    await page.setContent(result.documentHTML, { waitUntil: 'load' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });
    
    await browser.close();
    
    // Send actual PDF file
    const documentType = result.type === 'purchase_order' ? 'bon_commande' : 'lettre_commande';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${documentType}_${purchaseOrderId}.pdf"`);

    // ⚠️ F11 — `Buffer.from` est INDISPENSABLE ici.
    //
    // Depuis Puppeteer 23, `page.pdf()` renvoie un `Uint8Array` et non plus un
    // `Buffer` Node. Express, qui ne reconnaît que le second comme binaire,
    // sérialisait donc le PDF en JSON : le testeur recevait un HTTP 200, un
    // en-tête `application/pdf`, un fichier de 537 Ko… et
    // `{"0":37,"1":80,"2":68,…}` à l'intérieur — la représentation décimale de
    // « %PDF- ». Un fichier .pdf que rien n'ouvre.
    //
    // Le statut et le type MIME étaient corrects : seul le contenu était faux.
    // Aucun contrôle portant sur le code de retour n'aurait vu ce défaut.
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error("Error generating purchase document:", error);
    res.status(500).json({ error: "Erreur lors de la génération du document" });
  }
});

// Obtenir le type de document recommandé selon les seuils
router.get("/tenant/:tenantId/purchase-order/:purchaseOrderId/document-type", async (req, res) => {
  try {
    const tenantId = locataireDeLaSession(req, res);
    if (!tenantId) return;

    const { purchaseOrderId } = req.params;
    
    const config = await cctpComplianceService.getPurchaseOrderConfig(tenantId);
    if (!config) {
      return res.status(404).json({ error: "Configuration non trouvée" });
    }
    
    // Récupérer le montant de la commande, DANS le locataire de la session.
    const [purchaseOrder] = await db.select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, parseInt(purchaseOrderId)), eq(purchaseOrders.tenantId, tenantId)));
    
    if (!purchaseOrder) {
      return res.status(404).json({ error: "Bon de commande non trouvé" });
    }
    
    // ⚠️ DEUX CHAÎNES COMPARÉES COMME DES NOMBRES. La ligne précédente était
    // `totalAmount >= config.purchaseOrderThreshold`, sur des valeurs dont
    // AUCUNE n'est un nombre en pratique :
    //
    //   • `total_amount` est `numeric`, et node-postgres rend les `numeric`
    //     sous forme de CHAÎNE pour ne pas perdre en précision — le même piège
    //     est déjà documenté en F11 dans server/cctp-compliance-system.ts ;
    //   • `config.purchaseOrderThreshold` est déclaré `number`, mais
    //     `getPurchaseOrderConfig` rend `tenant.config as PurchaseOrderConfig`,
    //     un `jsonb` transtypé sans validation : le type annoncé ne garantit
    //     rien de ce que porte la colonne.
    //
    // Deux chaînes comparées par `>=` le sont LEXICOGRAPHIQUEMENT : « 900 » est
    // alors supérieur à « 1500 », parce que « 9 » vient après « 1 ». Un bon de
    // 900 € se voyait recommander un bon de commande là où la lettre de
    // commande s'imposait. Le défaut était invisible au compilateur tant que
    // `purchaseOrder` venait d'un `require()` non typé.
    //
    // Les deux côtés sont donc convertis, comme le fait déjà
    // `generatePurchaseDocument` pour le même arbitrage.
    const totalAmount = parseFloat(String(purchaseOrder.totalAmount ?? '0'));
    const seuil = Number(config.purchaseOrderThreshold);
    const recommendedType =
      Number.isFinite(totalAmount) && Number.isFinite(seuil) && totalAmount >= seuil
        ? 'purchase_order'
        : 'letter';
    
    res.json({
      totalAmount,
      letterOrderThreshold: config.letterOrderThreshold,
      purchaseOrderThreshold: config.purchaseOrderThreshold,
      recommendedType,
      documentTitle: recommendedType === 'purchase_order' ? 'Bon de Commande' : 'Lettre de Commande'
    });
  } catch (error) {
    console.error("Error determining document type:", error);
    res.status(500).json({ error: "Erreur lors de la détermination du type de document" });
  }
});

// =====================================================
// AUTO-GÉNÉRATION RAPPORTS INTERVENTION
// =====================================================

// Activer/désactiver l'auto-génération de rapports pour un tenant
router.put("/tenant/:tenantId/auto-reports", async (req, res) => {
  try {
    const tenantId = locataireDeLaSession(req, res);
    if (!tenantId) return;

    const { enabled } = req.body;
    
    if (enabled) {
      await cctpComplianceService.enableAutoReportGeneration(tenantId);
      res.json({ 
        success: true, 
        message: "Auto-génération de rapports activée" 
      });
    } else {
      // Désactiver l'auto-génération
      await db.update(tenants)
        .set({ 
          workOrderConfig: { autoReportGeneration: false },
          updatedAt: new Date()
        })
        .where(eq(tenants.id, tenantId));
      
      res.json({ 
        success: true, 
        message: "Auto-génération de rapports désactivée" 
      });
    }
  } catch (error) {
    console.error("Error updating auto-report settings:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour des paramètres" });
  }
});

// Générer manuellement un rapport d'intervention pour un OT
router.post("/tenant/:tenantId/work-order/:workOrderId/generate-report", async (req, res) => {
  try {
    const tenantId = locataireDeLaSession(req, res);
    if (!tenantId) return;

    const { workOrderId } = req.params;
    
    const reportHTML = await cctpComplianceService.checkAndGenerateWorkOrderReport(
      tenantId,
      parseInt(workOrderId)
    );
    
    if (!reportHTML) {
      return res.status(400).json({ 
        error: "Impossible de générer le rapport",
        details: "L'OT doit être terminé et l'auto-génération activée"
      });
    }
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(reportHTML);
  } catch (error) {
    console.error("Error generating work order report:", error);
    res.status(500).json({ error: "Erreur lors de la génération du rapport" });
  }
});

// =====================================================
// DÉTECTION AUTOMATIQUE DE LANGUE
// =====================================================

// Obtenir la langue détectée automatiquement
router.get("/detect-language", async (req, res) => {
  try {
    const detectedLanguage = cctpComplianceService.detectLanguageFromRequest(req);
    
    res.json({
      detectedLanguage,
      supportedLanguages: ['fr', 'en'],
      detectionMethod: 'accept-language-header',
      fallback: 'fr'
    });
  } catch (error) {
    console.error("Error detecting language:", error);
    res.status(500).json({ error: "Erreur lors de la détection de langue" });
  }
});

// =====================================================
// CONFIGURATION RAPPORTS AVANCÉE
// =====================================================

// Obtenir la configuration des rapports d'un tenant
router.get("/tenant/:tenantId/reporting-config", async (req, res) => {
  try {
    const tenantId = locataireDeLaSession(req, res);
    if (!tenantId) return;
    
    const [tenant] = await db.select({ config: tenants.reportingConfig })
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    
    const config = tenant?.config || {
      autoMonthlyReports: false,
      autoInterventionReports: false,
      defaultLanguage: 'fr',
      autoLanguageDetection: true,
      dateFormat: 'DD/MM/YYYY',
      currency: 'EUR',
      emailDistribution: []
    };
    
    res.json(config);
  } catch (error) {
    console.error("Error fetching reporting config:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de la configuration" });
  }
});

// Mettre à jour la configuration des rapports d'un tenant
router.put("/tenant/:tenantId/reporting-config", async (req, res) => {
  try {
    const tenantId = locataireDeLaSession(req, res);
    if (!tenantId) return;

    const config = ReportingConfigSchema.parse(req.body);
    
    await cctpComplianceService.updateReportingConfig(tenantId, config);
    
    res.json({ 
      success: true, 
      message: "Configuration des rapports mise à jour avec succès" 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Données de configuration invalides", 
        details: error.errors 
      });
    }
    console.error("Error updating reporting config:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de la configuration" });
  }
});

// =====================================================
// ENDPOINTS DE CONFORMITÉ CCTP
// =====================================================

// Vérifier la conformité globale CCTP d'un tenant
router.get("/tenant/:tenantId/cctp-compliance", async (req, res) => {
  try {
    const tenantId = locataireDeLaSession(req, res);
    if (!tenantId) return;
    
    // Le relevé est MESURÉ par le service, qui dit aussi ce qu'il ne mesure
    // pas (voir `releverConformite`). Cette route notait auparavant cinq
    // exigences dont deux écrites en dur à 100 — `validationWorkflow` et
    // `tenantIsolation`, cette dernière en annonçant un « RLS activé » que ce
    // dépôt n'a jamais eu.
    const compliance = await cctpComplianceService.releverConformite(tenantId);

    res.json(compliance);
  } catch (error) {
    console.error("Error checking CCTP compliance:", error);
    res.status(500).json({ error: "Erreur lors de la vérification de conformité" });
  }
});

// =====================================================
// RAPPORT DE CONFORMITÉ IMPRIMABLE
// =====================================================
//
// ⚠️ CE RAPPORT ÉTAIT ENTIÈREMENT ÉCRIT EN DUR, et c'était le pire endroit du
// dépôt pour l'être.
//
// Il annonçait « Score: 90% » et dix verdicts de conformité rédigés à la main,
// identiques pour tous les locataires, sans qu'une seule valeur soit mesurée.
// C'est un document qu'un industriel imprime pour l'opposer à un donneur
// d'ordre. Deux de ses affirmations étaient FAUSSES, pas seulement non
// mesurées :
//
//   • « ✓ Isolation tenant par RLS PostgreSQL » — ce dépôt ne déclare aucune
//     politique RLS. Le cloisonnement est fait en code applicatif, une colonne
//     tenant_id par table, et c'est tout l'objet des migrations 0011 à 0022 ;
//   • « ✓ Validation hiérarchique multi-niveaux » — jusqu'au 2026-10-25,
//     n'importe quel compte authentifié approuvait n'importe quoi. Le rapport
//     l'a déclaré conforme pendant toute cette période.
//
// tests/unit/aucun-chiffre-invente.test.ts cite nommément ce « score de
// conformité réglementaire 90 % » parmi les défauts qui l'ont fait naître, mais
// il ne balayait que client/ et deux fichiers serveur : ce rapport-ci lui
// échappait. Le balayage est étendu dans le même lot.
//
// Le rapport rend maintenant EXACTEMENT ce que releverConformite() a mesuré, et
// il nomme séparément ce qu'il ne mesure pas, en disant où chaque exigence est
// vérifiée pour de bon. Aucun verdict n'est plus écrit ici.
router.get("/tenant/:tenantId/cctp-compliance/report", async (req, res) => {
  try {
    const tenantId = locataireDeLaSession(req, res);
    if (!tenantId) return;

    const releve = await cctpComplianceService.releverConformite(tenantId);

    // ⚠️ TOUT ce qui est interpolé ci-dessous passe par ici, et pas seulement
    // l'identifiant du locataire. Les `details` du relevé citent des valeurs de
    // CONFIGURATION — `companyHeader.name` par exemple, que l'administrateur du
    // locataire écrit lui-même via `PUT /purchase-order-config`. Une entête
    // d'entreprise contenant du balisage serait donc injectée dans ce document.
    const h = (valeur: unknown): string => String(valeur ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
    ));

    const LIBELLES: Record<string, { texte: string; classe: string }> = {
      compliant: { texte: 'CONFORME', classe: 'conforme' },
      partial: { texte: 'PARTIEL', classe: 'partiel' },
      missing: { texte: 'MANQUANT', classe: 'manquant' },
      non_mesure: { texte: 'NON MESURÉ ICI', classe: 'non-mesure' },
    };

    const exigences = Object.entries(releve.requirements);
    const mesurees = exigences.filter(([, e]) => e.score !== null);
    const nonMesurees = exigences.filter(([, e]) => e.score === null);

    const section = ([cle, e]: [string, Exigence]) => {
      const badge = LIBELLES[e.status] ?? LIBELLES.non_mesure;
      return [
        '        <div class="exigence ' + badge.classe + '">',
        '          <div class="entete-exigence">',
        '            <h3>' + h(e.libelle) + '</h3>',
        '            <span class="badge">' + h(badge.texte) + '</span>',
        '          </div>',
        '          <p class="details">' + h(e.details) + '</p>',
        e.score !== null ? '          <p class="note">Note : ' + h(e.score) + ' / 100</p>' : '',
        e.verifiePar ? '          <p class="verifie">Vérifié par : ' + h(e.verifiePar) + '</p>' : '',
        '          <p class="cle">' + h(cle) + '</p>',
        '        </div>',
      ].filter(Boolean).join('\n');
    };

    const styles = [
      'body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #1f2933; line-height: 1.5; }',
      '.entete { border-bottom: 3px solid #1f3a5f; padding-bottom: 12px; margin-bottom: 20px; }',
      '.entete h1 { margin: 0 0 6px; font-size: 20px; }',
      '.entete p { margin: 2px 0; font-size: 12px; color: #52606d; }',
      '.synthese { border: 1px solid #cbd2d9; padding: 14px; margin-bottom: 22px; }',
      '.synthese .score { font-size: 26px; font-weight: bold; }',
      '.synthese .portee { font-size: 12px; color: #52606d; margin-top: 6px; }',
      'h2 { font-size: 15px; margin: 24px 0 10px; border-bottom: 1px solid #cbd2d9; padding-bottom: 4px; }',
      '.exigence { border-left: 4px solid #cbd2d9; padding: 10px 14px; margin: 10px 0; background: #f5f7fa; }',
      '.exigence.conforme { border-left-color: #1e7a4b; }',
      '.exigence.partiel { border-left-color: #946200; }',
      '.exigence.manquant { border-left-color: #a61b1b; }',
      '.exigence.non-mesure { border-left-color: #7b8794; background: #eef1f5; }',
      '.entete-exigence { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }',
      '.entete-exigence h3 { margin: 0; font-size: 14px; }',
      '.badge { font-size: 11px; font-weight: bold; letter-spacing: .04em; white-space: nowrap; }',
      '.conforme .badge { color: #1e7a4b; }',
      '.partiel .badge { color: #946200; }',
      '.manquant .badge { color: #a61b1b; }',
      '.non-mesure .badge { color: #52606d; }',
      '.details { margin: 6px 0 0; font-size: 13px; }',
      '.note { margin: 4px 0 0; font-size: 12px; font-weight: bold; }',
      '.verifie { margin: 4px 0 0; font-size: 12px; color: #52606d; }',
      '.cle { margin: 4px 0 0; font-size: 10px; color: #7b8794; font-family: monospace; }',
      '.avertissement { border: 1px solid #946200; background: #fdf6e7; padding: 12px 14px; font-size: 12px; margin: 22px 0; }',
      '.pied { margin-top: 28px; border-top: 1px solid #cbd2d9; padding-top: 10px; font-size: 11px; color: #7b8794; }',
    ].join('\n        ');

    const portee = releve.overallScore !== null
      ? 'Moyenne des ' + h(releve.exigencesMesurees)
        + ' exigence(s) effectivement mesurée(s) sur cette organisation.'
      : 'Aucune exigence mesurable sur cette organisation.';
    const reserve = releve.exigencesNonMesurees > 0
      ? ' ' + h(releve.exigencesNonMesurees) + " exigence(s) ne sont PAS mesurées par ce relevé "
        + "et n'entrent pas dans cette moyenne : elles sont listées en fin de document."
      : '';

    const reportHTML = [
      '<!DOCTYPE html>',
      '<html lang="fr">',
      '<head>',
      '    <meta charset="UTF-8">',
      '    <title>Relevé de conformité CCTP — ' + h(releve.tenantId) + '</title>',
      '    <style>',
      '        ' + styles,
      '    </style>',
      '</head>',
      '<body>',
      '    <div class="entete">',
      '        <h1>Relevé de conformité CCTP</h1>',
      '        <p>Organisation : ' + h(releve.tenantId) + '</p>',
      '        <p>Relevé le ' + h(new Date(releve.lastChecked).toLocaleString('fr-FR')) + '</p>',
      '    </div>',
      '    <div class="synthese">',
      '        <div class="score">'
        + (releve.overallScore !== null ? h(releve.overallScore) + ' %' : 'Non évalué')
        + '</div>',
      '        <div class="portee">' + portee + reserve + '</div>',
      '    </div>',
      '    <h2>Exigences mesurées sur cette organisation (' + h(mesurees.length) + ')</h2>',
      mesurees.length > 0
        ? mesurees.map(section).join('\n')
        : '    <p class="details">Aucune exigence mesurable.</p>',
      '    <h2>Exigences que ce relevé ne mesure pas (' + h(nonMesurees.length) + ')</h2>',
      '    <div class="avertissement">',
      '        Ces exigences du CCTP ne sont pas observables depuis une requête applicative',
      '        portant sur une seule organisation. Elles ne sont ni notées, ni comptées dans la',
      '        moyenne ci-dessus, et ce document ne les déclare pas conformes. Chacune indique',
      '        où elle est réellement vérifiée.',
      '    </div>',
      nonMesurees.map(section).join('\n'),
      '    <div class="pied">',
      "        <p>Document produit par Maintrix à partir de l'état enregistré de cette",
      '           organisation. Chaque ligne porte la clé technique de l\'exigence, pour',
      '           rapprochement avec GET /api/cctp/tenant/:id/cctp-compliance.</p>',
      '        <p>Les exigences marquées « NON MESURÉ ICI » le sont délibérément : ce relevé',
      '           préfère une absence déclarée à une conformité supposée.</p>',
      '    </div>',
      '    <script>',
      '        window.onload = function () { setTimeout(function () { window.print(); }, 500); };',
      '    </script>',
      '</body>',
      '</html>',
    ].join('\n');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(reportHTML);
  } catch (error) {
    console.error("Error generating CCTP compliance report:", error);
    res.status(500).json({ error: "Erreur lors de la génération du rapport" });
  }
});

export { router as cctpRoutes };
