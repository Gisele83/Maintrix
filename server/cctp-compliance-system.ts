// ===================================================================
// CCTP COMPLIANCE SYSTEM - Système de conformité cahier des charges
// ===================================================================

import { z } from "zod";
import { db } from "./db";
import { tenants, purchaseOrders, workOrders, maintenanceReports, userProfiles } from "../shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { PDFGeneratorFunctional, MaintenanceReportData, MonthlyReportData } from "./pdf-generator-functional";

// 🏢 Configuration des Bons de Commande par Tenant
export interface PurchaseOrderConfig {
  // Seuils montants configurables par tenant
  letterOrderThreshold: number; // Seuil pour Lettre de Commande (ex: 1000€)
  purchaseOrderThreshold: number; // Seuil pour Bon de Commande (ex: 5000€)
  
  // Configuration entête d'impression
  companyHeader: {
    name: string;
    logo?: string; // Base64 ou URL
    address: string;
    phone: string;
    email: string;
    siret?: string;
    tva?: string;
  };
  
  // Validation multi-niveaux configurables
  validationLevels: Array<{
    level: number;
    name: string; // "Chef de Service", "Directeur", etc.
    maxAmount: number; // Montant max qu'il peut valider
    roleRequired: string; // Role required in tenant
  }>;
  
  // Auto-génération
  autoGenerate: boolean;
  numberingPrefix: string; // "BC" ou "LC" 
}

export interface WorkOrderConfig {
  // Auto-génération de rapports PDF
  autoReportGeneration: boolean;
  reportTemplate: string; // Template ID
  
  // Validation selon organigramme
  hierarchyLevels: Array<{
    level: number;
    position: string; // "Technicien", "Chef Équipe", "Responsable Maintenance"
    canValidate: boolean;
    maxBudget?: number;
  }>;
}

export interface ReportingConfig {
  // Génération automatique
  autoMonthlyReports: boolean;
  autoInterventionReports: boolean;
  
  // Langue et localisation
  defaultLanguage: "fr" | "en";
  autoLanguageDetection: boolean;
  dateFormat: string;
  currency: string;
  
  // Distribution automatique
  emailDistribution: string[]; // Liste emails pour envoi auto
}

/**
 * L'état d'une exigence du CCTP dans un relevé.
 *
 * `non_mesure` est le quatrième état, et il a été ajouté pour une raison :
 * sans lui, une exigence que ce relevé ne peut pas observer n'avait que deux
 * sorties — être affirmée conforme (ce qu'ont fait `validationWorkflow` et
 * `tenantIsolation`, l'une à tort pendant des mois, l'autre en annonçant du RLS
 * qui n'existe pas), ou disparaître du relevé, ce qui laisse croire qu'il
 * couvre tout.
 */
export type EtatExigence = 'compliant' | 'partial' | 'missing' | 'non_mesure';

export interface Exigence {
  libelle: string;
  status: EtatExigence;
  /** `null` quand l'exigence n'est pas mesurable ici. Jamais 0 par défaut. */
  score: number | null;
  details: string;
  /** Où l'exigence est réellement vérifiée, quand ce n'est pas ici. */
  verifiePar?: string;
}

export interface ReleveConformite {
  tenantId: string;
  lastChecked: string;
  /** Moyenne des exigences MESURÉES, ou `null` si aucune ne l'est. */
  overallScore: number | null;
  exigencesMesurees: number;
  exigencesNonMesurees: number;
  requirements: Record<string, Exigence>;
}

// 📋 Schémas de validation Zod
export const PurchaseOrderConfigSchema = z.object({
  letterOrderThreshold: z.number().min(0),
  purchaseOrderThreshold: z.number().min(0),
  companyHeader: z.object({
    name: z.string().min(1),
    logo: z.string().optional(),
    address: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email(),
    siret: z.string().optional(),
    tva: z.string().optional(),
  }),
  validationLevels: z.array(z.object({
    level: z.number().min(1),
    name: z.string().min(1),
    maxAmount: z.number().min(0),
    roleRequired: z.string().min(1),
  })),
  autoGenerate: z.boolean(),
  numberingPrefix: z.string().min(1).max(5),
});

export const WorkOrderConfigSchema = z.object({
  autoReportGeneration: z.boolean(),
  reportTemplate: z.string(),
  hierarchyLevels: z.array(z.object({
    level: z.number().min(1),
    position: z.string().min(1),
    canValidate: z.boolean(),
    maxBudget: z.number().min(0).optional(),
  })),
});

export const ReportingConfigSchema = z.object({
  autoMonthlyReports: z.boolean(),
  autoInterventionReports: z.boolean(),
  defaultLanguage: z.enum(["fr", "en"]),
  autoLanguageDetection: z.boolean(),
  dateFormat: z.string(),
  currency: z.string(),
  emailDistribution: z.array(z.string().email()),
});

// 🏭 Service de conformité CCTP
export class CCTPComplianceService {
  private pdfGenerator = new PDFGeneratorFunctional();

  // =====================================================
  // CONFIGURATION DES BONS DE COMMANDE PAR TENANT
  // =====================================================

  async updatePurchaseOrderConfig(tenantId: string, config: PurchaseOrderConfig): Promise<void> {
    const validatedConfig = PurchaseOrderConfigSchema.parse(config);
    
    await db.update(tenants)
      .set({ 
        purchaseOrderConfig: validatedConfig,
        updatedAt: new Date()
      })
      .where(eq(tenants.id, tenantId));
  }

  async getPurchaseOrderConfig(tenantId: string): Promise<PurchaseOrderConfig | null> {
    const [tenant] = await db.select({ config: tenants.purchaseOrderConfig })
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    
    return tenant?.config as PurchaseOrderConfig || null;
  }

  // =====================================================
  // GÉNÉRATION BONS DE COMMANDE / LETTRES COMMANDE  
  // =====================================================

  async generatePurchaseDocument(
    tenantId: string, 
    purchaseOrderId: number,
    forceType?: 'letter' | 'purchase_order'
  ): Promise<{ type: 'letter' | 'purchase_order'; documentHTML: string }> {
    
    const config = await this.getPurchaseOrderConfig(tenantId);

    // ⚠️ F11 — `tenants.purchase_order_config` vaut `{}` par défaut, et non
    // NULL. Le simple test `!config` laissait donc passer une configuration
    // vide, et la génération plantait plus loin sur
    // `config.companyHeader.name` : le testeur recevait un 500 opaque là où le
    // message explicite prévu juste en dessous existait déjà.
    //
    // On vérifie donc que la configuration est UTILISABLE, pas seulement
    // présente. Tout locataire nouvellement créé passe par ce cas.
    if (!config || !config.companyHeader?.name) {
      throw new Error("Configuration Bon de Commande manquante pour ce tenant");
    }

    // Le locataire était DÉJÀ dans la portée de cette fonction — le premier
    // paramètre, utilisé juste au-dessus pour lire la configuration — et la
    // lecture du bon de commande ne s'en servait pas. Un bon d'une autre
    // organisation était donc généré avec l'en-tête de celle qui le demandait.
    const [purchaseOrder] = await db.select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, purchaseOrderId), eq(purchaseOrders.tenantId, tenantId)));

    if (!purchaseOrder) {
      throw new Error("Bon de commande introuvable");
    }

    // Déterminer le type de document selon les seuils
    const totalAmount = parseFloat(purchaseOrder.totalAmount || '0');
    const documentType = forceType ||
      (totalAmount >= Number(config.purchaseOrderThreshold) ? 'purchase_order' : 'letter');

    // Générer le HTML du document
    const documentHTML = this.generatePurchaseDocumentHTML(
      documentType,
      purchaseOrder,
      config
    );

    return { type: documentType, documentHTML };
  }

  private generatePurchaseDocumentHTML(
    type: 'letter' | 'purchase_order',
    order: any,
    config: PurchaseOrderConfig
  ): string {
    const title = type === 'purchase_order' ? 'BON DE COMMANDE' : 'LETTRE DE COMMANDE';
    const documentNumber = `${config.numberingPrefix}-${order.orderNumber}`;

    // ⚠️ F11 — PostgreSQL renvoie les colonnes `numeric` sous forme de CHAÎNE,
    // pas de nombre (node-postgres ne convertit pas, pour ne pas perdre en
    // précision). `order.totalAmount?.toFixed(2)` levait donc
    // « toFixed is not a function » sur CHAQUE bon de commande.
    //
    // Les lignes de calcul (`* 0.2`, `* 1.2`) fonctionnaient, elles, par
    // coercition implicite — ce qui rendait le défaut d'autant plus discret.
    // On normalise une fois, ici, plutôt qu'à chaque interpolation.
    const montantHT = Number(order.totalAmount ?? 0) || 0;
    const montantTVA = montantHT * 0.2;
    const montantTTC = montantHT * 1.2;

    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>${title} ${documentNumber}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1E40AF; padding-bottom: 20px; margin-bottom: 30px; }
            .company-info h1 { color: #1E40AF; margin: 0; font-size: 24px; }
            .company-info p { margin: 5px 0; font-size: 14px; }
            .document-title { text-align: center; font-size: 28px; font-weight: bold; color: #1E40AF; margin: 30px 0; }
            .document-info { background: #F3F4F6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .document-info div { display: inline-block; margin-right: 30px; }
            .document-info strong { color: #374151; }
            .supplier-info { margin-bottom: 20px; }
            .supplier-info h3 { color: #1E40AF; margin-bottom: 10px; }
            .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .items-table th, .items-table td { border: 1px solid #D1D5DB; padding: 12px; text-align: left; }
            .items-table th { background: #1E40AF; color: white; font-weight: bold; }
            .items-table tr:nth-child(even) { background: #F9FAFB; }
            .total-section { text-align: right; margin-top: 20px; }
            .total-line { margin: 8px 0; }
            .total-final { font-size: 18px; font-weight: bold; color: #1E40AF; border-top: 2px solid #1E40AF; padding-top: 10px; }
            .footer { margin-top: 40px; font-size: 12px; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 20px; }
            .signature-section { margin-top: 50px; display: flex; justify-content: space-between; }
            .signature-box { width: 200px; text-align: center; border-top: 1px solid #333; padding-top: 10px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-info">
                <h1>${config.companyHeader.name}</h1>
                <p>${config.companyHeader.address}</p>
                <p>Tél: ${config.companyHeader.phone}</p>
                <p>Email: ${config.companyHeader.email}</p>
                ${config.companyHeader.siret ? `<p>SIRET: ${config.companyHeader.siret}</p>` : ''}
                ${config.companyHeader.tva ? `<p>TVA: ${config.companyHeader.tva}</p>` : ''}
            </div>
            ${config.companyHeader.logo ? `<div class="logo"><img src="${config.companyHeader.logo}" alt="Logo" style="max-height: 80px;"></div>` : ''}
        </div>

        <div class="document-title">${title}</div>

        <div class="document-info">
            <div><strong>Numéro:</strong> ${documentNumber}</div>
            <div><strong>Date:</strong> ${new Date(order.orderDate).toLocaleDateString('fr-FR')}</div>
            <div><strong>Statut:</strong> ${order.status}</div>
            <div><strong>Priorité:</strong> ${order.priority}</div>
        </div>

        <div class="supplier-info">
            <h3>Fournisseur:</h3>
            <p><strong>Nom:</strong> Fournisseur ${order.supplierId}</p>
            <p><strong>Livraison prévue:</strong> ${order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString('fr-FR') : 'Non définie'}</p>
            <p><strong>Adresse de livraison:</strong> ${order.deliveryAddress || 'Adresse principale'}</p>
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Quantité</th>
                    <th>Prix unitaire</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${order.description || 'Articles de maintenance'}</td>
                    <td>1</td>
                    <td>${montantHT.toFixed(2)} €</td>
                    <td>${montantHT.toFixed(2)} €</td>
                </tr>
            </tbody>
        </table>

        <div class="total-section">
            <div class="total-line">Sous-total HT: ${montantHT.toFixed(2)} €</div>
            <div class="total-line">TVA (20%): ${montantTVA.toFixed(2)} €</div>
            <div class="total-final">TOTAL TTC: ${montantTTC.toFixed(2)} €</div>
        </div>

        ${order.terms ? `<div style="margin-top: 30px;"><strong>Conditions:</strong><br>${order.terms}</div>` : ''}
        ${order.notes ? `<div style="margin-top: 20px;"><strong>Notes:</strong><br>${order.notes}</div>` : ''}

        <div class="signature-section">
            <div class="signature-box">
                <p>Signature Acheteur</p>
                <p>Date: ___________</p>
            </div>
            <div class="signature-box">
                <p>Signature Fournisseur</p>
                <p>Date: ___________</p>
            </div>
        </div>

        <div class="footer">
            <p>Document généré automatiquement par Maintrix</p>
            <p>Date de génération: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
        </div>

        <script>
            // Auto-convert to PDF
            window.onload = function() {
                setTimeout(() => {
                    window.print();
                }, 1000);
            };
        </script>
    </body>
    </html>
    `;
  }

  // =====================================================
  // AUTO-GÉNÉRATION RAPPORTS APRÈS CHAQUE OT
  // =====================================================

  async enableAutoReportGeneration(tenantId: string): Promise<void> {
    const config: WorkOrderConfig = {
      autoReportGeneration: true,
      reportTemplate: "standard",
      hierarchyLevels: [
        { level: 1, position: "Technicien", canValidate: false },
        { level: 2, position: "Chef d'Équipe", canValidate: true, maxBudget: 1000 },
        { level: 3, position: "Responsable Maintenance", canValidate: true, maxBudget: 5000 },
      ]
    };

    await db.update(tenants)
      .set({ 
        workOrderConfig: config,
        updatedAt: new Date()
      })
      .where(eq(tenants.id, tenantId));
  }

  async checkAndGenerateWorkOrderReport(tenantId: string, workOrderId: number): Promise<string | null> {
    const [tenant] = await db.select({ config: tenants.workOrderConfig })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    const config = tenant?.config as WorkOrderConfig;
    if (!config?.autoReportGeneration) {
      return null;
    }

    // Récupérer les données du workOrder — DANS le locataire.
    //
    // ⚠️ Le filtre manquait, et c'était la fuite la plus large de ce fichier :
    // `tenantId` était dans la portée (il vient d'être utilisé juste au-dessus
    // pour lire la configuration), `work_orders.tenant_id` est NOT NULL, et la
    // condition portait sur le seul identifiant. `POST /api/cctp/tenant/
    // <le mien>/work-order/<celui d'autrui>/generate-report` produisait donc un
    // rapport d'intervention complet sur l'ordre de travail d'une AUTRE
    // organisation : description, technicien, durée, équipement, coûts.
    //
    // Même défaut, même forme et même cause que celui refermé sur
    // `purchase_orders` par la migration 0022 — un locataire présent dans la
    // signature et absent de la requête.
    const [workOrder] = await db.select()
      .from(workOrders)
      .where(and(eq(workOrders.id, workOrderId), eq(workOrders.tenantId, tenantId)));

    if (!workOrder || workOrder.status !== 'completed') {
      return null;
    }

    // Générer le rapport d'intervention automatiquement
    const reportData: MaintenanceReportData = {
      reportNumber: `INT-${workOrder.orderNumber}`,
      equipment: `Équipement ${workOrder.equipmentId}`,
      description: workOrder.description || 'Intervention de maintenance',
      technician: `Technicien ${workOrder.assignedTo || 'Non assigné'}`,
      date: workOrder.actualEnd?.toISOString() || new Date().toISOString(),
      duration: workOrder.actualDuration || 0,
      status: workOrder.status,
      priority: workOrder.priority || 'medium',
      workOrderNumber: workOrder.orderNumber,
      interventionType: workOrder.orderType,
      totalCost: parseFloat(workOrder.cost || '0'),
      laborCost: parseFloat(workOrder.cost || '0') * 0.7,
      nextMaintenanceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 jours
      recommendations: ['Surveillance continue', 'Maintenance préventive recommandée'],
    };

    return this.generateAutoReportHTML(reportData);
  }

  private generateAutoReportHTML(reportData: MaintenanceReportData): string {
    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>Rapport d'Intervention Automatique - ${reportData.reportNumber}</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #333; }
            .auto-header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
            .auto-header h1 { margin: 0; font-size: 24px; }
            .auto-badge { background: #FEF3C7; color: #92400E; padding: 5px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; }
            .section { margin: 20px 0; padding: 15px; background: #F9FAFB; border-left: 4px solid #10B981; border-radius: 5px; }
            .section h3 { color: #10B981; margin-top: 0; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .info-item { background: white; padding: 10px; border-radius: 5px; border: 1px solid #E5E7EB; }
            .info-item strong { color: #374151; }
        </style>
    </head>
    <body>
        <div class="auto-header">
            <div class="auto-badge">RAPPORT AUTO-GÉNÉRÉ</div>
            <h1>Rapport d'Intervention - ${reportData.reportNumber}</h1>
            <p>Généré automatiquement suite à la completion de l'OT</p>
        </div>

        <div class="section">
            <h3>📋 Détails de l'Intervention</h3>
            <div class="info-grid">
                <div class="info-item"><strong>Équipement:</strong> ${reportData.equipment}</div>
                <div class="info-item"><strong>Technicien:</strong> ${reportData.technician}</div>
                <div class="info-item"><strong>Date:</strong> ${new Date(reportData.date).toLocaleDateString('fr-FR')}</div>
                <div class="info-item"><strong>Durée:</strong> ${reportData.duration} minutes</div>
                <div class="info-item"><strong>Statut:</strong> ${reportData.status}</div>
                <div class="info-item"><strong>Priorité:</strong> ${reportData.priority}</div>
            </div>
        </div>

        <div class="section">
            <h3>💰 Coûts</h3>
            <div class="info-grid">
                <div class="info-item"><strong>Coût main d'œuvre:</strong> ${reportData.laborCost?.toFixed(2) || '0.00'} €</div>
                <div class="info-item"><strong>Coût total:</strong> ${reportData.totalCost?.toFixed(2) || '0.00'} €</div>
            </div>
        </div>

        <div class="section">
            <h3>🔧 Description de l'Intervention</h3>
            <p>${reportData.description}</p>
        </div>

        <div class="section">
            <h3>📈 Recommandations</h3>
            <ul>
                ${reportData.recommendations?.map(rec => `<li>${rec}</li>`).join('') || '<li>Aucune recommandation spécifique</li>'}
            </ul>
            ${reportData.nextMaintenanceDate ? `<p><strong>Prochaine maintenance suggérée:</strong> ${new Date(reportData.nextMaintenanceDate).toLocaleDateString('fr-FR')}</p>` : ''}
        </div>

        <div style="margin-top: 30px; padding: 15px; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 5px; text-align: center;">
            <p><strong>📄 Rapport généré automatiquement</strong></p>
            <p>Ce rapport a été créé automatiquement suite à la completion de l'OT ${reportData.workOrderNumber}</p>
            <p>Date de génération: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
        </div>

        <script>
            // Auto-convert to PDF
            window.onload = function() {
                setTimeout(() => {
                    window.print();
                }, 1000);
            };
        </script>
    </body>
    </html>
    `;
  }

  // =====================================================
  // DÉTECTION AUTOMATIQUE DE LANGUE
  // =====================================================

  detectLanguageFromRequest(req: any): 'fr' | 'en' {
    // 1. Vérifier le header Accept-Language
    const acceptLanguage = req.headers['accept-language'] || '';
    
    if (acceptLanguage.toLowerCase().includes('fr')) {
      return 'fr';
    }
    if (acceptLanguage.toLowerCase().includes('en')) {
      return 'en';
    }

    // 2. Vérifier l'IP géographique (simplifiée)
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection.remoteAddress || '';
    
    // Logique simplifiée basée sur des patterns courants
    if (userAgent.includes('fr-FR') || ip.startsWith('85.') || ip.startsWith('86.')) {
      return 'fr';
    }

    // 3. Défaut en français (selon CCTP)
    return 'fr';
  }

  async updateReportingConfig(tenantId: string, config: ReportingConfig): Promise<void> {
    const validatedConfig = ReportingConfigSchema.parse(config);

    await db.update(tenants)
      .set({
        reportingConfig: validatedConfig,
        updatedAt: new Date()
      })
      .where(eq(tenants.id, tenantId));
  }

  // ════════════════════════════════════════════════════════════════
  // RELEVÉ DE CONFORMITÉ — MESURÉ, OU DÉCLARÉ NON MESURÉ
  // ════════════════════════════════════════════════════════════════
  //
  // CE QUI ÉTAIT RENDU AVANT
  //
  // Deux routes servaient un « état de conformité », et aucune ne mesurait
  // l'essentiel :
  //
  //   • `GET /api/cctp/tenant/:id/cctp-compliance` notait cinq exigences, dont
  //     DEUX écrites en dur à `compliant` / 100 — `validationWorkflow`
  //     (« Validation hiérarchique multi-niveaux opérationnelle ») et
  //     `tenantIsolation` (« Isolation multi-tenant avec RLS activée ») ;
  //   • `GET /api/cctp/tenant/:id/cctp-compliance/report` rendait un HTML
  //     ENTIÈREMENT écrit en dur : « Score: 90% » et dix verdicts rédigés à la
  //     main, identiques pour tous les locataires.
  //
  // Deux de ces affirmations étaient FAUSSES, pas seulement non mesurées :
  //
  //   • « Isolation tenant par RLS PostgreSQL » — ce dépôt ne déclare aucune
  //     politique RLS. Le cloisonnement est fait en code applicatif, et c'est
  //     tout l'objet des migrations 0011 à 0022. Affirmer RLS à un donneur
  //     d'ordre serait une fausse déclaration sur le point le plus sensible ;
  //   • « Validation hiérarchique multi-niveaux opérationnelle » — le circuit
  //     de validation n'habilitait personne avant le 2026-10-25 : n'importe
  //     quel compte authentifié approuvait n'importe quoi. Le relevé le notait
  //     100 pendant tout ce temps.
  //
  // Un score inventé sur un écran de conformité réglementaire est pire
  // qu'absent : c'est là, précisément, qu'un industriel vérifie ce qu'il peut
  // opposer à un donneur d'ordre.
  //
  // CE QUI EST RENDU MAINTENANT
  //
  // Les exigences réellement observables depuis une requête — la configuration
  // du locataire et l'état de ses comptes — sont mesurées. Les autres sont
  // rendues avec `status: 'non_mesure'` et `score: null`, et nommées : elles
  // disent où elles sont vérifiées pour de bon. Elles ne sont NI comptées dans
  // le score, NI passées sous silence : les retirer laisserait croire que le
  // relevé couvre tout le CCTP.
  //
  // `score: null` et non 0 : zéro est une note, « non mesuré » est une absence
  // de note. La règle du dépôt (tests/unit/aucun-chiffre-invente.test.ts) est
  // qu'une donnée absente s'affiche comme absente.

  /**
   * Le laboratoire d'une exigence : ce qui a été observé, et à quel degré.
   *
   * `score` vaut `null` quand l'exigence n'est pas mesurable ici — jamais 0 par
   * défaut, ce qui se lirait comme « mesuré, et nul ».
   */
  private static exigence(
    libelle: string,
    status: EtatExigence,
    score: number | null,
    details: string,
    verifiePar?: string,
  ): Exigence {
    return { libelle, status, score, details, verifiePar };
  }

  async releverConformite(tenantId: string): Promise<ReleveConformite> {
    const E = CCTPComplianceService.exigence;

    const [tenant] = await db.select({
      purchaseOrderConfig: tenants.purchaseOrderConfig,
      workOrderConfig: tenants.workOrderConfig,
      reportingConfig: tenants.reportingConfig,
    }).from(tenants).where(eq(tenants.id, tenantId));

    // ⚠️ `{}` EST TRUTHY, et c'est le défaut qui faussait la première exigence.
    // Les trois colonnes de configuration sont `jsonb DEFAULT '{}'` : tout
    // locataire nouvellement créé en porte un. L'ancien test
    // `purchaseOrderConfig ? 100 : 0` notait donc « Configuration complète »
    // sur une configuration VIDE. Le même piège est déjà documenté en F11 dans
    // `generatePurchaseDocument` ci-dessus, qui vérifie `companyHeader?.name`
    // plutôt que la seule présence de l'objet — on vérifie ici la même chose,
    // pour que le relevé et le générateur soient d'accord sur ce qui est
    // utilisable.
    const po = (tenant?.purchaseOrderConfig ?? {}) as Partial<PurchaseOrderConfig>;
    const wo = (tenant?.workOrderConfig ?? {}) as Partial<WorkOrderConfig>;
    const rc = (tenant?.reportingConfig ?? {}) as Partial<ReportingConfig>;

    const requirements: Record<string, Exigence> = {};

    // ── 1. Configuration des bons de commande ─────────────────────
    const entete = typeof po.companyHeader?.name === 'string' ? po.companyHeader.name.trim() : '';
    const niveaux = Array.isArray(po.validationLevels) ? po.validationLevels : [];
    const seuilsLisibles = Number.isFinite(Number(po.purchaseOrderThreshold))
      && Number.isFinite(Number(po.letterOrderThreshold));

    if (!entete) {
      requirements.configurationBonsDeCommande = E(
        'Configuration des bons de commande', 'missing', 0,
        // Formulé pour le LECTEUR du rapport imprimé, qui n'est pas un
        // développeur : une première version disait « la colonne vaut "{}" ».
        // C'est exact, et illisible pour un donneur d'ordre.
        "Aucune entête d'entreprise enregistrée : la génération d'un bon de commande "
        + "échouerait. Aucune configuration n'a été enregistrée pour cette organisation.",
      );
    } else if (!seuilsLisibles || niveaux.length === 0) {
      const manques = [
        !seuilsLisibles ? 'seuils de montant illisibles ou absents' : null,
        niveaux.length === 0 ? 'aucun niveau de validation déclaré' : null,
      ].filter(Boolean).join(' ; ');
      requirements.configurationBonsDeCommande = E(
        'Configuration des bons de commande', 'partial', 50,
        `Entête « ${entete} » enregistrée, mais ${manques}.`,
      );
    } else {
      requirements.configurationBonsDeCommande = E(
        'Configuration des bons de commande', 'compliant', 100,
        `Entête « ${entete} », seuils renseignés, ${niveaux.length} niveau(x) de validation déclaré(s).`,
      );
    }

    // ── 2. Cohérence de l'échelle des plafonds ────────────────────
    // Un échelon dont le plafond ne croît pas rend le niveau supérieur inutile,
    // ou le niveau inférieur plus puissant que son supérieur. C'est vérifiable,
    // donc c'est vérifié.
    if (niveaux.length === 0) {
      requirements.echelleDesPlafonds = E(
        "Échelle des plafonds d'approbation", 'missing', 0,
        'Aucun niveau de validation déclaré : aucune échelle à vérifier.',
      );
    } else {
      const ordonnes = [...niveaux].sort((a, b) => Number(a.level) - Number(b.level));
      const incoherents = ordonnes.filter((n, i) =>
        i > 0 && Number(n.maxAmount) <= Number(ordonnes[i - 1].maxAmount));
      if (incoherents.length > 0) {
        requirements.echelleDesPlafonds = E(
          "Échelle des plafonds d'approbation", 'partial', 50,
          `${niveaux.length} niveau(x) déclaré(s), mais ${incoherents.length} dont le plafond `
          + "ne dépasse pas celui du niveau inférieur : l'échelon supérieur n'apporte alors "
          + 'aucun pouvoir d\'approbation supplémentaire.',
        );
      } else {
        requirements.echelleDesPlafonds = E(
          "Échelle des plafonds d'approbation", 'compliant', 100,
          `${niveaux.length} niveau(x), plafonds strictement croissants `
          + `(jusqu'à ${Number(ordonnes[ordonnes.length - 1].maxAmount)}).`,
        );
      }
    }

    // ── 3. La chaîne de validation est-elle DOTÉE ? ───────────────
    // Remplace l'ancien `validationWorkflow: compliant/100` écrit en dur. La
    // question utile pour un locataire n'est pas « le code existe-t-il » mais
    // « des comptes sont-ils réellement habilités chez moi » : un circuit sans
    // approbateur bloque tout document au premier échelon.
    const [dotation] = await db.select({
      ot: sql<number>`COUNT(*) FILTER (WHERE ${userProfiles.canValidateWorkOrders} = true AND ${userProfiles.validationLevel} >= 1)`,
      bc: sql<number>`COUNT(*) FILTER (WHERE ${userProfiles.canValidatePurchaseOrders} = true AND ${userProfiles.validationLevel} >= 1)`,
    }).from(userProfiles).where(and(
      eq(userProfiles.tenantId, tenantId),
      eq(userProfiles.isActive, true),
    ));

    const validateursOt = Number(dotation?.ot ?? 0);
    const validateursBc = Number(dotation?.bc ?? 0);
    if (validateursOt > 0 && validateursBc > 0) {
      requirements.chaineDeValidationDotee = E(
        'Chaîne de validation dotée', 'compliant', 100,
        `${validateursOt} compte(s) habilité(s) aux ordres de travail, ${validateursBc} aux bons de commande.`,
      );
    } else if (validateursOt > 0 || validateursBc > 0) {
      requirements.chaineDeValidationDotee = E(
        'Chaîne de validation dotée', 'partial', 50,
        `${validateursOt} compte(s) habilité(s) aux ordres de travail, ${validateursBc} aux bons de `
        + 'commande : les documents du type non doté resteront bloqués au premier échelon.',
      );
    } else {
      requirements.chaineDeValidationDotee = E(
        'Chaîne de validation dotée', 'missing', 0,
        "Aucun compte actif ne porte de droit de validation : aucun document ne peut être approuvé.",
      );
    }

    // ── 4. Auto-génération des rapports d'intervention ───────────
    requirements.generationAutomatiqueRapports = wo.autoReportGeneration === true
      ? E('Génération automatique des rapports', 'compliant', 100,
          "Auto-génération activée : un ordre de travail terminé produit son rapport d'intervention.")
      : E('Génération automatique des rapports', 'partial', 50,
          'Auto-génération désactivée pour cette organisation. Les rapports restent produits à la demande.');

    // ── 5. Configuration des rapports ────────────────────────────
    const langue = rc.defaultLanguage;
    const formatDate = typeof rc.dateFormat === 'string' ? rc.dateFormat.trim() : '';
    const devise = typeof rc.currency === 'string' ? rc.currency.trim() : '';
    if (langue && formatDate && devise) {
      requirements.configurationRapports = E(
        'Configuration des rapports', 'compliant', 100,
        `Langue par défaut « ${langue} », format de date « ${formatDate} », devise « ${devise} »`
        + `${rc.autoLanguageDetection ? ', détection automatique de langue active' : ''}.`,
      );
    } else {
      const manques = [
        !langue ? 'langue par défaut' : null,
        !formatDate ? 'format de date' : null,
        !devise ? 'devise' : null,
      ].filter(Boolean).join(', ');
      requirements.configurationRapports = E(
        'Configuration des rapports', langue || formatDate || devise ? 'partial' : 'missing',
        langue || formatDate || devise ? 50 : 0,
        `Non renseigné : ${manques}. Les rapports emploient alors les valeurs de repli du serveur.`,
      );
    }

    // ── Ce que CE relevé ne mesure pas, et le dit ────────────────
    // ⚠️ CE QUE CE `details` NE DIT PAS, ET POURQUOI.
    //
    // Une première rédaction y plaçait le rectificatif historique : « le relevé
    // affirmait auparavant "Isolation multi-tenant avec RLS activée", c'est
    // FAUX, ce dépôt ne déclare aucune politique RLS ». Mesuré : cette phrase
    // part dans le HTML du rapport imprimable, c'est-à-dire dans la pièce qu'un
    // industriel présente à un donneur d'ordre. Y faire figurer le mot « RLS »
    // et l'aveu d'une ancienne fausse déclaration n'informe pas ce lecteur : au
    // mieux il s'en inquiète, au pire il lit « RLS » en diagonale et y voit
    // encore une revendication.
    //
    // Le document rendu dit donc ce qui est VRAI AUJOURD'HUI, et rien de plus.
    // L'histoire de la fausse déclaration reste ici, dans le code, pour le
    // mainteneur — et dans le message de commit, pour la trace.
    requirements.cloisonnementParLocataire = E(
      'Cloisonnement des données par organisation', 'non_mesure', null,
      "Propriété de la plateforme, et non de la configuration d'une organisation : une "
      + 'requête applicative ne peut pas attester son propre cloisonnement. Le cloisonnement '
      + "est assuré en code applicatif, par une colonne de propriétaire sur chaque table.",
      'migrations 0011 à 0022 (« <table>_tenant_scoped ») et les suites '
      + 'tests/integration/isolation-*.test.ts, multi-tenant.test.ts, isolation-cctp.test.ts',
    );

    requirements.chiffrementEtTransport = E(
      'Chiffrement au repos et en transit', 'non_mesure', null,
      "Dépend de l'infrastructure de déploiement (terminaison TLS, chiffrement du volume, "
      + "gestion des clés), que l'application ne peut pas inspecter depuis une requête.",
      'configuration nginx/TLS et KMS du déploiement — hors application',
    );

    requirements.authentificationForte = E(
      'Authentification forte des administrateurs', 'non_mesure', null,
      "Se constate compte par compte, et non par organisation : ce relevé ne lit pas l'état "
      + 'MFA des comptes.',
      'server/mfa-enforcement-middleware.ts et la configuration MFA de chaque compte',
    );

    // ── Score : sur les exigences MESURÉES seulement ─────────────
    // Diluer avec des 100 inventés était exactement le mécanisme du « 90 % ».
    const mesurees = Object.values(requirements).filter((e) => e.score !== null);
    const overallScore = mesurees.length === 0
      ? null
      : Math.round(mesurees.reduce((somme, e) => somme + (e.score as number), 0) / mesurees.length);

    return {
      tenantId,
      lastChecked: new Date().toISOString(),
      overallScore,
      exigencesMesurees: mesurees.length,
      exigencesNonMesurees: Object.values(requirements).length - mesurees.length,
      requirements,
    };
  }
}

export const cctpComplianceService = new CCTPComplianceService();