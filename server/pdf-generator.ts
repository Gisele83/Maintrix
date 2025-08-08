import puppeteer from 'puppeteer';
import { Response } from 'express';

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
  actualDuration: number;
  plannedDuration: number;
  workDescription: string;
  problemDiagnosis: string;
  actionsTaken: string;
  partsUsed: Array<{
    partId: number;
    partNumber: string;
    quantity: number;
    cost: number;
  }>;
  toolsUsed: string[];
  safetyIncidents?: string;
  qualityCheck: boolean;
  qualityNotes?: string;
  followUpRequired: boolean;
  followUpDate?: string;
  followUpNotes?: string;
  totalCost: number;
  laborCost: number;
  partsCost: number;
  status: string;
  approvedBy?: string;
  approvalDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyReportData {
  id: number;
  reportNumber: string;
  month: number;
  year: number;
  periodStart: string;
  periodEnd: string;
  generatedBy: string;
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

export class PDFGenerator {
  private async launchBrowser() {
    return await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
  }

  async generateMaintenanceReportPDF(reportData: MaintenanceReportData): Promise<Buffer> {
    const browser = await this.launchBrowser();
    try {
      const page = await browser.newPage();
      
      const html = this.generateMaintenanceReportHTML(reportData);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async generateMonthlyReportPDF(reportData: MonthlyReportData): Promise<Buffer> {
    const browser = await this.launchBrowser();
    try {
      const page = await browser.newPage();
      
      const html = this.generateMonthlyReportHTML(reportData);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private generateMaintenanceReportHTML(data: MaintenanceReportData): string {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
      }).format(amount);
    };

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport d'Intervention ${data.reportNumber}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: bold;
        }
        .header .subtitle {
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
        }
        .section {
            margin-bottom: 25px;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .section h2 {
            color: #667eea;
            font-size: 18px;
            margin: 0 0 15px 0;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 8px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
        }
        .info-item {
            background: white;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        .info-item strong {
            color: #495057;
            display: block;
            margin-bottom: 5px;
        }
        .parts-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 6px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .parts-table th {
            background: #667eea;
            color: white;
            padding: 12px;
            text-align: left;
        }
        .parts-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #e9ecef;
        }
        .parts-table tr:last-child td {
            border-bottom: none;
        }
        .tools-list {
            background: white;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        .tools-list ul {
            margin: 0;
            padding-left: 20px;
        }
        .cost-summary {
            background: #e8f5e8;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #c3e6c3;
        }
        .cost-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .cost-total {
            border-top: 2px solid #28a745;
            padding-top: 10px;
            font-weight: bold;
            font-size: 16px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-approved { background: #d4edda; color: #155724; }
        .status-pending { background: #fff3cd; color: #856404; }
        .status-draft { background: #f8d7da; color: #721c24; }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            color: #6c757d;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Rapport d'Intervention</h1>
        <div class="subtitle">${data.reportNumber} - ${data.reportType.toUpperCase()}</div>
        <div class="subtitle">Généré le ${formatDate(data.createdAt)}</div>
    </div>

    <div class="section">
        <h2>Informations Générales</h2>
        <div class="info-grid">
            <div class="info-item">
                <strong>Numéro de rapport:</strong>
                ${data.reportNumber}
            </div>
            <div class="info-item">
                <strong>Type d'intervention:</strong>
                ${data.interventionType}
            </div>
            <div class="info-item">
                <strong>Technicien:</strong>
                ${data.technician}
            </div>
            <div class="info-item">
                <strong>Superviseur:</strong>
                ${data.supervisor || 'Non assigné'}
            </div>
            <div class="info-item">
                <strong>Début intervention:</strong>
                ${formatDate(data.startTime)}
            </div>
            <div class="info-item">
                <strong>Fin intervention:</strong>
                ${formatDate(data.endTime)}
            </div>
            <div class="info-item">
                <strong>Durée réelle:</strong>
                ${data.actualDuration} minutes
            </div>
            <div class="info-item">
                <strong>Durée prévue:</strong>
                ${data.plannedDuration} minutes
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Description du Travail</h2>
        <div class="info-item">
            <strong>Description:</strong>
            ${data.workDescription}
        </div>
    </div>

    <div class="section">
        <h2>Diagnostic et Actions</h2>
        <div class="info-item" style="margin-bottom: 15px;">
            <strong>Diagnostic du problème:</strong>
            ${data.problemDiagnosis}
        </div>
        <div class="info-item">
            <strong>Actions entreprises:</strong>
            ${data.actionsTaken}
        </div>
    </div>

    <div class="section">
        <h2>Pièces Utilisées</h2>
        <table class="parts-table">
            <thead>
                <tr>
                    <th>Référence</th>
                    <th>Quantité</th>
                    <th>Prix unitaire</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${data.partsUsed.map(part => `
                    <tr>
                        <td>${part.partNumber}</td>
                        <td>${part.quantity}</td>
                        <td>${formatCurrency(part.cost / part.quantity)}</td>
                        <td>${formatCurrency(part.cost)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Outils Utilisés</h2>
        <div class="tools-list">
            <ul>
                ${data.toolsUsed.map(tool => `<li>${tool}</li>`).join('')}
            </ul>
        </div>
    </div>

    ${data.safetyIncidents ? `
    <div class="section">
        <h2>Incidents de Sécurité</h2>
        <div class="info-item">
            ${data.safetyIncidents}
        </div>
    </div>
    ` : ''}

    <div class="section">
        <h2>Contrôle Qualité</h2>
        <div class="info-item">
            <strong>Contrôle effectué:</strong>
            ${data.qualityCheck ? 'Oui' : 'Non'}
        </div>
        ${data.qualityNotes ? `
        <div class="info-item">
            <strong>Notes qualité:</strong>
            ${data.qualityNotes}
        </div>
        ` : ''}
    </div>

    ${data.followUpRequired ? `
    <div class="section">
        <h2>Suivi Requis</h2>
        <div class="info-item">
            <strong>Date de suivi:</strong>
            ${data.followUpDate ? formatDate(data.followUpDate) : 'À définir'}
        </div>
        ${data.followUpNotes ? `
        <div class="info-item">
            <strong>Notes de suivi:</strong>
            ${data.followUpNotes}
        </div>
        ` : ''}
    </div>
    ` : ''}

    <div class="section">
        <h2>Résumé des Coûts</h2>
        <div class="cost-summary">
            <div class="cost-item">
                <span>Main d'œuvre:</span>
                <span>${formatCurrency(data.laborCost)}</span>
            </div>
            <div class="cost-item">
                <span>Pièces détachées:</span>
                <span>${formatCurrency(data.partsCost)}</span>
            </div>
            <div class="cost-item cost-total">
                <span>Total:</span>
                <span>${formatCurrency(data.totalCost)}</span>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Statut et Approbation</h2>
        <div class="info-grid">
            <div class="info-item">
                <strong>Statut:</strong>
                <span class="status-badge status-${data.status}">${data.status}</span>
            </div>
            ${data.approvedBy ? `
            <div class="info-item">
                <strong>Approuvé par:</strong>
                ${data.approvedBy}
            </div>
            ` : ''}
            ${data.approvalDate ? `
            <div class="info-item">
                <strong>Date d'approbation:</strong>
                ${formatDate(data.approvalDate)}
            </div>
            ` : ''}
        </div>
    </div>

    <div class="footer">
        <p>Rapport généré par Smart GMAO DiagFix - ${formatDate(new Date().toISOString())}</p>
        <p>Document confidentiel - Usage interne uniquement</p>
    </div>
</body>
</html>`;
  }

  private generateMonthlyReportHTML(data: MonthlyReportData): string {
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
      }).format(amount);
    };

    const formatNumber = (num: number, decimals: number = 1) => {
      return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(num);
    };

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport Mensuel ${data.reportNumber}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: bold;
        }
        .header .subtitle {
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
        }
        .section {
            margin-bottom: 25px;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .section h2 {
            color: #667eea;
            font-size: 18px;
            margin: 0 0 15px 0;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 8px;
        }
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .kpi-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
            border-left: 4px solid #667eea;
        }
        .kpi-value {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }
        .kpi-label {
            color: #6c757d;
            font-size: 14px;
        }
        .performance-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .performance-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        .performance-item strong {
            color: #495057;
            display: block;
            margin-bottom: 5px;
        }
        .recommendations {
            background: #e3f2fd;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #2196f3;
        }
        .recommendations h3 {
            color: #1976d2;
            margin: 0 0 15px 0;
        }
        .recommendations ul {
            margin: 0;
            padding-left: 20px;
        }
        .recommendations li {
            margin-bottom: 8px;
        }
        .alert-summary {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
        }
        .alert-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
            border: 2px solid #e9ecef;
        }
        .alert-critical {
            border-color: #dc3545;
            background: #f8d7da;
        }
        .alert-warning {
            border-color: #ffc107;
            background: #fff3cd;
        }
        .alert-info {
            border-color: #17a2b8;
            background: #d4edda;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            color: #6c757d;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Rapport Mensuel GMAO</h1>
        <div class="subtitle">${monthNames[data.month - 1]} ${data.year}</div>
        <div class="subtitle">Période: ${new Date(data.periodStart).toLocaleDateString('fr-FR')} au ${new Date(data.periodEnd).toLocaleDateString('fr-FR')}</div>
    </div>

    <div class="section">
        <h2>Indicateurs Clés de Performance</h2>
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-value">${formatNumber(data.equipmentAvailability)}%</div>
                <div class="kpi-label">Disponibilité Équipements</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${formatNumber(data.mtbf)} h</div>
                <div class="kpi-label">MTBF (Temps Moyen Entre Pannes)</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${formatNumber(data.mttr)} h</div>
                <div class="kpi-label">MTTR (Temps Moyen de Réparation)</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${formatNumber(data.maintenanceEfficiency)}%</div>
                <div class="kpi-label">Efficacité Maintenance</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${formatNumber(data.plannedMaintenanceRatio)}%</div>
                <div class="kpi-label">Ratio Maintenance Préventive</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${data.performanceScore}</div>
                <div class="kpi-label">Score de Performance</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Statistiques Équipements</h2>
        <div class="performance-grid">
            <div class="performance-item">
                <strong>Total équipements:</strong>
                ${data.totalEquipment}
            </div>
            <div class="performance-item">
                <strong>Équipements actifs:</strong>
                ${data.activeEquipment}
            </div>
            <div class="performance-item">
                <strong>Disponibilité moyenne:</strong>
                ${formatNumber(data.equipmentAvailability)}%
            </div>
            <div class="performance-item">
                <strong>Équipements critiques:</strong>
                ${Math.round(data.totalEquipment * 0.3)}
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Bons de Travail</h2>
        <div class="performance-grid">
            <div class="performance-item">
                <strong>Total bons de travail:</strong>
                ${data.totalWorkOrders}
            </div>
            <div class="performance-item">
                <strong>Bons terminés:</strong>
                ${data.completedWorkOrders}
            </div>
            <div class="performance-item">
                <strong>Maintenance préventive:</strong>
                ${data.preventiveWorkOrders}
            </div>
            <div class="performance-item">
                <strong>Maintenance corrective:</strong>
                ${data.correctiveWorkOrders}
            </div>
            <div class="performance-item">
                <strong>Temps moyen de completion:</strong>
                ${formatNumber(data.averageCompletionTime)} heures
            </div>
            <div class="performance-item">
                <strong>Coût moyen par bon:</strong>
                ${formatCurrency(data.costPerWorkOrder)}
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Analyse des Coûts</h2>
        <div class="performance-grid">
            <div class="performance-item">
                <strong>Coût total maintenance:</strong>
                ${formatCurrency(data.totalMaintenanceCost)}
            </div>
            <div class="performance-item">
                <strong>Coût main d'œuvre:</strong>
                ${formatCurrency(data.laborCost)}
            </div>
            <div class="performance-item">
                <strong>Coût pièces détachées:</strong>
                ${formatCurrency(data.partsCost)}
            </div>
            <div class="performance-item">
                <strong>Coût sous-traitance:</strong>
                ${formatCurrency(data.contractorCost)}
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Gestion des Stock</h2>
        <div class="performance-grid">
            <div class="performance-item">
                <strong>Pièces consommées:</strong>
                ${data.partsConsumed}
            </div>
            <div class="performance-item">
                <strong>Rotation stock:</strong>
                ${formatNumber(data.inventoryTurnover)}
            </div>
            <div class="performance-item">
                <strong>Ruptures de stock:</strong>
                ${data.stockouts}
            </div>
            <div class="performance-item">
                <strong>Achats d'urgence:</strong>
                ${data.emergencyPurchases}
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Alertes et Incidents</h2>
        <div class="alert-summary">
            <div class="alert-item alert-critical">
                <div class="kpi-value">${data.criticalAlerts}</div>
                <div class="kpi-label">Alertes Critiques</div>
            </div>
            <div class="alert-item alert-warning">
                <div class="kpi-value">${data.totalAlerts - data.criticalAlerts}</div>
                <div class="kpi-label">Alertes Standard</div>
            </div>
            <div class="alert-item alert-info">
                <div class="kpi-value">${data.safetyIncidents}</div>
                <div class="kpi-label">Incidents Sécurité</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Zones d'Amélioration</h2>
        <div class="recommendations">
            <h3>Domaines prioritaires:</h3>
            <ul>
                ${data.improvementAreas.map(area => `<li>${area}</li>`).join('')}
            </ul>
        </div>
    </div>

    <div class="section">
        <h2>Recommandations</h2>
        <div class="recommendations">
            <h3>Actions suggérées:</h3>
            <ul>
                ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    </div>

    <div class="footer">
        <p>Rapport généré par Smart GMAO DiagFix - ${new Date().toLocaleDateString('fr-FR')}</p>
        <p>Rapport ${data.reportNumber} - Généré par ${data.generatedBy}</p>
        <p>Document confidentiel - Usage interne uniquement</p>
    </div>
</body>
</html>`;
  }

  async sendMaintenanceReportPDF(res: Response, reportData: MaintenanceReportData) {
    try {
      const pdfBuffer = await this.generateMaintenanceReportPDF(reportData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="rapport-intervention-${reportData.reportNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.end(pdfBuffer);
    } catch (error) {
      console.error('Error generating maintenance report PDF:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la génération du PDF du rapport d\'intervention',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async sendMonthlyReportPDF(res: Response, reportData: MonthlyReportData) {
    try {
      const pdfBuffer = await this.generateMonthlyReportPDF(reportData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="rapport-mensuel-${reportData.reportNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.end(pdfBuffer);
    } catch (error) {
      console.error('Error generating monthly report PDF:', error);
      res.status(500).json({ 
        message: 'Erreur lors de la génération du PDF du rapport mensuel',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const pdfGenerator = new PDFGenerator();