// ===================================================================
// CCTP COMPLIANCE SYSTEM - Système de conformité cahier des charges
// ===================================================================

import { z } from "zod";
import { db } from "./db";
import { tenants, purchaseOrders, workOrders, maintenanceReports } from "../shared/schema";
import { eq } from "drizzle-orm";
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

    const [purchaseOrder] = await db.select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, purchaseOrderId));
    
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

    // Récupérer les données du workOrder
    const [workOrder] = await db.select()
      .from(workOrders)
      .where(eq(workOrders.id, workOrderId));

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
}

export const cctpComplianceService = new CCTPComplianceService();