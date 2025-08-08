import type { Response } from "express";
import puppeteer from "puppeteer";

// Interface pour les données de rapport d'intervention
export interface MaintenanceReportData {
  id: number;
  reportNumber: string;
  workOrderId: number;
  equipmentId: number;
  reportType: string;
  interventionType: string;
  technician: string;
  supervisor?: string;
  startTime: string;
  endTime: string;
  actualDuration?: number;
  plannedDuration?: number;
  workDescription: string;
  problemDiagnosis?: string;
  actionsTaken: string;
  partsUsed?: Array<{
    partId: number;
    partNumber: string;
    quantity: number;
    cost: number;
  }>;
  toolsUsed?: string[];
  safetyIncidents?: string;
  qualityCheck: boolean;
  qualityNotes?: string;
  followUpRequired: boolean;
  followUpDate?: string;
  followUpNotes?: string;
  totalCost?: number;
  laborCost?: number;
  partsCost?: number;
  status: string;
  approvedBy?: string;
  approvalDate?: string;
  createdAt: string;
  updatedAt: string;
}

// Interface pour les données de rapport mensuel
export interface MonthlyReportData {
  id: number;
  reportNumber: string;
  month: number;
  year: number;
  periodStart: string;
  periodEnd: string;
  generatedBy?: string;
  generatedAt: string;
  totalEquipment: number;
  activeEquipment: number;
  equipmentAvailability: number;
  totalWorkOrders: number;
  completedWorkOrders: number;
  preventiveWorkOrders: number;
  correctiveWorkOrders: number;
  averageCompletionTime: number;
  mtbf: number;
  mttr: number;
  plannedMaintenanceRatio: number;
  maintenanceEfficiency: number;
  totalMaintenanceCost: number;
  laborCost: number;
  partsCost: number;
  contractorCost: number;
  costPerWorkOrder: number;
  partsConsumed: number;
  inventoryTurnover: number;
  stockouts: number;
  emergencyPurchases: number;
  totalAlerts: number;
  criticalAlerts: number;
  safetyIncidents: number;
  qualityIssues: number;
  performanceScore: number;
  improvementAreas: string[];
  recommendations: string[];
  status: string;
  notes?: string;
}

export class PDFGeneratorSimple {
  private generateMaintenanceReportHTML(reportData: MaintenanceReportData): string {
    const reportDate = new Date(reportData.createdAt).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rapport d'Intervention ${reportData.reportNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; color: #333; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px; margin: -40px -40px 40px -40px; }
            .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
            .header h2 { margin: 10px 0 5px; font-size: 18px; font-weight: normal; }
            .header .date { margin: 5px 0 0; font-size: 14px; opacity: 0.9; }
            .section { margin-bottom: 30px; }
            .section h3 { color: #667eea; font-size: 18px; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #667eea; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .info-item { margin-bottom: 10px; }
            .info-item strong { color: #333; }
            .text-content { background: #f8f9fa; padding: 20px; border-left: 4px solid #667eea; margin: 15px 0; }
            .parts-list { background: #f8f9fa; padding: 15px; border-radius: 8px; }
            .parts-list ul { margin: 0; padding-left: 20px; }
            .parts-list li { margin: 8px 0; }
            .alert { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; }
            @media print { body { margin: 20px; } .header { margin: -20px -20px 20px -20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Smart GMAO DiagFix</h1>
            <h2>Rapport d'Intervention de Maintenance</h2>
            <div class="date">Généré le ${reportDate}</div>
          </div>
          
          <div class="section">
            <h3>📋 INFORMATIONS GÉNÉRALES</h3>
            <div class="info-grid">
              <div class="info-item"><strong>Numéro de rapport:</strong> ${reportData.reportNumber}</div>
              <div class="info-item"><strong>Type d'intervention:</strong> ${reportData.interventionType}</div>
              <div class="info-item"><strong>Technicien:</strong> ${reportData.technician}</div>
              ${reportData.supervisor ? `<div class="info-item"><strong>Superviseur:</strong> ${reportData.supervisor}</div>` : ''}
              ${reportData.actualDuration ? `<div class="info-item"><strong>Durée réelle:</strong> ${reportData.actualDuration} minutes</div>` : ''}
              ${reportData.totalCost ? `<div class="info-item"><strong>Coût total:</strong> ${reportData.totalCost.toFixed(2)} €</div>` : ''}
            </div>
          </div>
          
          <div class="section">
            <h3>🔧 DESCRIPTION DES TRAVAUX</h3>
            <div class="text-content">${reportData.workDescription}</div>
          </div>
          
          ${reportData.problemDiagnosis ? `
          <div class="section">
            <h3>🔍 DIAGNOSTIC DU PROBLÈME</h3>
            <div class="text-content">${reportData.problemDiagnosis}</div>
          </div>
          ` : ''}
          
          <div class="section">
            <h3>⚙️ ACTIONS RÉALISÉES</h3>
            <div class="text-content">${reportData.actionsTaken}</div>
          </div>
          
          ${reportData.partsUsed && reportData.partsUsed.length > 0 ? `
          <div class="section">
            <h3>🔩 PIÈCES UTILISÉES</h3>
            <div class="parts-list">
              <ul>
                ${reportData.partsUsed.map(part => 
                  `<li>${part.partNumber} - Quantité: ${part.quantity} - Coût: ${part.cost.toFixed(2)} €</li>`
                ).join('')}
              </ul>
            </div>
          </div>
          ` : ''}
          
          ${reportData.toolsUsed && reportData.toolsUsed.length > 0 ? `
          <div class="section">
            <h3>🛠️ OUTILS UTILISÉS</h3>
            <div class="parts-list">
              <ul>
                ${reportData.toolsUsed.map(tool => `<li>${tool}</li>`).join('')}
              </ul>
            </div>
          </div>
          ` : ''}
          
          ${reportData.safetyIncidents ? `
          <div class="section">
            <h3>⚠️ INCIDENT DE SÉCURITÉ</h3>
            <div class="alert">${reportData.safetyIncidents}</div>
          </div>
          ` : ''}
          
          ${reportData.qualityCheck ? `
          <div class="section">
            <h3>✅ CONTRÔLE QUALITÉ</h3>
            <div class="success">
              Contrôle qualité validé
              ${reportData.qualityNotes ? `<br>Notes: ${reportData.qualityNotes}` : ''}
            </div>
          </div>
          ` : ''}
          
          ${reportData.followUpRequired ? `
          <div class="section">
            <h3>📅 SUIVI REQUIS</h3>
            <div class="alert">
              ${reportData.followUpDate ? `Date de suivi: ${new Date(reportData.followUpDate).toLocaleDateString('fr-FR')}<br>` : ''}
              ${reportData.followUpNotes ? `Notes: ${reportData.followUpNotes}` : ''}
            </div>
          </div>
          ` : ''}
          
          <div class="footer">
            <p>Ce rapport a été généré automatiquement par Smart GMAO DiagFix</p>
            <p>Plateforme de gestion de maintenance assistée par intelligence artificielle</p>
          </div>
        </body>
      </html>
    `;
  }

  private generateMonthlyReportHTML(reportData: MonthlyReportData): string {
    const reportDate = new Date(reportData.generatedAt).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const monthName = monthNames[reportData.month - 1];

    return `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rapport Mensuel ${reportData.reportNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; color: #333; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; text-align: center; padding: 40px; margin: -40px -40px 40px -40px; }
            .header h1 { margin: 0; font-size: 32px; font-weight: bold; }
            .header h2 { margin: 15px 0 10px; font-size: 20px; font-weight: normal; }
            .header .period { margin: 10px 0; font-size: 16px; font-weight: 500; }
            .header .date { margin: 5px 0 0; font-size: 14px; opacity: 0.9; }
            .performance-badge { background: #10b981; padding: 8px 20px; border-radius: 20px; display: inline-block; margin-top: 15px; font-weight: bold; }
            .section { margin-bottom: 30px; }
            .section h3 { color: #3b82f6; font-size: 18px; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #3b82f6; }
            .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
            .kpi-card { background: #f8fafc; padding: 20px; border-radius: 12px; border-left: 4px solid #3b82f6; }
            .kpi-value { font-size: 24px; font-weight: bold; color: #1e40af; margin-bottom: 5px; }
            .kpi-label { font-size: 14px; color: #64748b; }
            .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .stats-item { margin-bottom: 10px; }
            .stats-item strong { color: #333; }
            .improvement-list { background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; }
            .recommendation-list { background: #dbeafe; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; }
            .improvement-list ul, .recommendation-list ul { margin: 0; padding-left: 20px; }
            .improvement-list li, .recommendation-list li { margin: 8px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; }
            @media print { body { margin: 20px; } .header { margin: -20px -20px 20px -20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Smart GMAO DiagFix</h1>
            <h2>Rapport Mensuel de Maintenance</h2>
            <div class="period">Période: ${monthName} ${reportData.year}</div>
            <div class="date">Rapport ${reportData.reportNumber} généré le ${reportDate}</div>
            <div class="performance-badge">Score Performance: ${reportData.performanceScore}/100</div>
          </div>
          
          <div class="section">
            <h3>📊 INDICATEURS CLÉS DE PERFORMANCE</h3>
            <div class="kpi-grid">
              <div class="kpi-card">
                <div class="kpi-value">${reportData.equipmentAvailability.toFixed(1)}%</div>
                <div class="kpi-label">Disponibilité Équipements</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-value">${reportData.mtbf.toFixed(1)}h</div>
                <div class="kpi-label">MTBF (Temps Moyen Entre Pannes)</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-value">${reportData.mttr.toFixed(1)}h</div>
                <div class="kpi-label">MTTR (Temps Moyen de Réparation)</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-value">${reportData.totalMaintenanceCost.toFixed(0)}€</div>
                <div class="kpi-label">Coût Total</div>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h3>📋 ORDRES DE TRAVAIL</h3>
            <div class="stats-grid">
              <div class="stats-item"><strong>Total:</strong> ${reportData.totalWorkOrders}</div>
              <div class="stats-item"><strong>Terminés:</strong> ${reportData.completedWorkOrders}</div>
              <div class="stats-item"><strong>Préventifs:</strong> ${reportData.preventiveWorkOrders}</div>
              <div class="stats-item"><strong>Correctifs:</strong> ${reportData.correctiveWorkOrders}</div>
              <div class="stats-item"><strong>Temps moyen:</strong> ${reportData.averageCompletionTime.toFixed(1)}h</div>
              <div class="stats-item"><strong>Efficacité:</strong> ${reportData.maintenanceEfficiency.toFixed(1)}%</div>
            </div>
          </div>
          
          <div class="section">
            <h3>💰 ANALYSE DES COÛTS</h3>
            <div class="stats-grid">
              <div class="stats-item"><strong>Coût total:</strong> ${reportData.totalMaintenanceCost.toFixed(2)}€</div>
              <div class="stats-item"><strong>Main d'œuvre:</strong> ${reportData.laborCost.toFixed(2)}€</div>
              <div class="stats-item"><strong>Pièces détachées:</strong> ${reportData.partsCost.toFixed(2)}€</div>
              <div class="stats-item"><strong>Sous-traitance:</strong> ${reportData.contractorCost.toFixed(2)}€</div>
              <div class="stats-item"><strong>Coût par OT:</strong> ${reportData.costPerWorkOrder.toFixed(2)}€</div>
            </div>
          </div>
          
          <div class="section">
            <h3>📦 STOCK ET APPROVISIONNEMENT</h3>
            <div class="stats-grid">
              <div class="stats-item"><strong>Pièces consommées:</strong> ${reportData.partsConsumed}</div>
              <div class="stats-item"><strong>Rotation des stocks:</strong> ${reportData.inventoryTurnover.toFixed(1)}</div>
              <div class="stats-item"><strong>Ruptures de stock:</strong> ${reportData.stockouts}</div>
              <div class="stats-item"><strong>Achats d'urgence:</strong> ${reportData.emergencyPurchases}</div>
            </div>
          </div>
          
          <div class="section">
            <h3>🚨 ALERTES ET INCIDENTS</h3>
            <div class="stats-grid">
              <div class="stats-item"><strong>Total des alertes:</strong> ${reportData.totalAlerts}</div>
              <div class="stats-item"><strong>Alertes critiques:</strong> ${reportData.criticalAlerts}</div>
              <div class="stats-item"><strong>Incidents de sécurité:</strong> ${reportData.safetyIncidents}</div>
              <div class="stats-item"><strong>Problèmes de qualité:</strong> ${reportData.qualityIssues}</div>
            </div>
          </div>
          
          ${reportData.improvementAreas && reportData.improvementAreas.length > 0 ? `
          <div class="section">
            <h3>📈 DOMAINES D'AMÉLIORATION</h3>
            <div class="improvement-list">
              <ul>
                ${reportData.improvementAreas.map(area => `<li>${area}</li>`).join('')}
              </ul>
            </div>
          </div>
          ` : ''}
          
          ${reportData.recommendations && reportData.recommendations.length > 0 ? `
          <div class="section">
            <h3>💡 RECOMMANDATIONS</h3>
            <div class="recommendation-list">
              <ul>
                ${reportData.recommendations.map(recommendation => `<li>${recommendation}</li>`).join('')}
              </ul>
            </div>
          </div>
          ` : ''}
          
          <div class="footer">
            <p>Ce rapport a été généré automatiquement par Smart GMAO DiagFix</p>
            <p>Plateforme de gestion de maintenance assistée par intelligence artificielle</p>
          </div>
        </body>
      </html>
    `;
  }

  async sendMaintenanceReportHTML(res: Response, reportData: MaintenanceReportData) {
    try {
      const htmlContent = this.generateMaintenanceReportHTML(reportData);
      
      // Launch Puppeteer to generate PDF
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });
      
      await browser.close();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="rapport-intervention-${reportData.reportNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating maintenance report PDF:", error);
      throw error;
    }
  }

  async sendMonthlyReportHTML(res: Response, reportData: MonthlyReportData) {
    try {
      const htmlContent = this.generateMonthlyReportHTML(reportData);
      
      // Launch Puppeteer to generate PDF
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });
      
      await browser.close();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="rapport-mensuel-${reportData.reportNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating monthly report PDF:", error);
      throw error;
    }
  }
}

export const pdfGeneratorSimple = new PDFGeneratorSimple();