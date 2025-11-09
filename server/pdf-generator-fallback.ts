import { Response } from "express";

export interface MaintenanceReportData {
  reportNumber: string;
  equipment: string;
  technician: string;
  description: string;
  interventionType: string;
  completedAt: string;
  totalCost?: number;
  partsUsed?: Array<{ partNumber: string; quantity: number; cost: number }>;
  actions?: string[];
  improvementAreas?: string[];
  recommendations?: string[];
  supervisor?: string;
  actualDuration?: number;
}

export interface MonthlyReportData {
  reportNumber: string;
  year: number;
  month: number;
  performanceScore: number;
  equipmentAvailability?: number;
  mtbf?: number;
  mttr?: number;
  totalMaintenanceCost?: number;
  totalWorkOrders: number;
  completedWorkOrders: number;
  preventiveWorkOrders: number;
  correctiveWorkOrders: number;
  averageCompletionTime?: number;
  maintenanceEfficiency?: number;
  laborCost?: number;
  partsCost?: number;
  contractorCost?: number;
  costPerWorkOrder?: number;
  partsConsumed: number;
  inventoryTurnover?: number;
  stockouts: number;
  emergencyPurchases: number;
  improvementAreas?: string[];
  recommendations?: string[];
}

export class PDFGeneratorFallback {
  async sendMaintenanceReportHTML(res: Response, reportData: MaintenanceReportData) {
    try {
      const htmlContent = this.generateMaintenanceReportHTML(reportData);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="rapport-intervention-${reportData.reportNumber}.html"`);
      
      res.send(htmlContent);
    } catch (error) {
      console.error("Error generating maintenance report HTML:", error);
      throw error;
    }
  }

  async sendMonthlyReportHTML(res: Response, reportData: MonthlyReportData) {
    try {
      const htmlContent = this.generateMonthlyReportHTML(reportData);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="rapport-mensuel-${reportData.reportNumber}.html"`);
      
      res.send(htmlContent);
    } catch (error) {
      console.error("Error generating monthly report HTML:", error);
      throw error;
    }
  }

  private generateMaintenanceReportHTML(reportData: MaintenanceReportData): string {
    const reportDate = new Date().toLocaleDateString('fr-FR');
    
    return `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rapport d'Intervention - ${reportData.reportNumber}</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 40px; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #333;
              line-height: 1.6;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #3b82f6, #1e40af);
              color: white; 
              padding: 30px; 
              margin: -40px -40px 40px -40px;
              border-radius: 12px 12px 0 0;
              text-align: center;
            }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .header h2 { margin: 10px 0 0 0; font-size: 18px; opacity: 0.9; }
            .date { font-size: 14px; margin-top: 10px; opacity: 0.8; }
            .section { margin-bottom: 30px; }
            .section h3 { 
              color: #1e40af; 
              border-bottom: 2px solid #e2e8f0; 
              padding-bottom: 8px; 
              margin-bottom: 20px;
              font-size: 18px;
            }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .info-item { margin-bottom: 10px; }
            .info-item strong { color: #333; }
            .parts-list, .actions-list { 
              background: #f8fafc; 
              padding: 20px; 
              border-radius: 8px; 
              border-left: 4px solid #3b82f6; 
            }
            .parts-list ul, .actions-list ul { margin: 0; padding-left: 20px; }
            .parts-list li, .actions-list li { margin: 8px 0; }
            .improvement-list { 
              background: #fef3c7; 
              padding: 20px; 
              border-radius: 8px; 
              border-left: 4px solid #f59e0b; 
            }
            .recommendation-list { 
              background: #dbeafe; 
              padding: 20px; 
              border-radius: 8px; 
              border-left: 4px solid #3b82f6; 
            }
            .improvement-list ul, .recommendation-list ul { margin: 0; padding-left: 20px; }
            .improvement-list li, .recommendation-list li { margin: 8px 0; }
            .footer { 
              text-align: center; 
              color: #666; 
              font-size: 12px; 
              margin-top: 60px; 
              padding-top: 20px; 
              border-top: 1px solid #ddd; 
            }
            .print-btn {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #3b82f6;
              color: white;
              border: none;
              padding: 12px 20px;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 600;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            .print-btn:hover {
              background: #2563eb;
            }
            @media print {
              body { background: none; margin: 20px; }
              .container { box-shadow: none; }
              .header { margin: -40px -40px 40px -40px; }
              .print-btn { display: none; }
            }
          </style>
        </head>
        <body>
          <button class="print-btn" onclick="window.print()">🖨️ Imprimer</button>
          <div class="container">
            <div class="header">
              <h1>Maintrix</h1>
              <h2>Rapport d'Intervention Maintenance</h2>
              <div class="date">Rapport ${reportData.reportNumber} généré le ${reportDate}</div>
            </div>
            
            <div class="section">
              <h3>ℹ️ INFORMATIONS GÉNÉRALES</h3>
              <div class="info-grid">
                <div class="info-item"><strong>Numéro d'intervention:</strong> ${reportData.reportNumber}</div>
                <div class="info-item"><strong>Équipement:</strong> ${reportData.equipment}</div>
                <div class="info-item"><strong>Type d'intervention:</strong> ${reportData.interventionType}</div>
                <div class="info-item"><strong>Technicien:</strong> ${reportData.technician}</div>
                ${reportData.supervisor ? `<div class="info-item"><strong>Superviseur:</strong> ${reportData.supervisor}</div>` : ''}
                ${reportData.actualDuration ? `<div class="info-item"><strong>Durée réelle:</strong> ${reportData.actualDuration} minutes</div>` : ''}
                ${reportData.totalCost ? `<div class="info-item"><strong>Coût total:</strong> ${(reportData.totalCost || 0).toFixed(2)} €</div>` : ''}
              </div>
            </div>
            
            <div class="section">
              <h3>📝 DESCRIPTION DE L'INTERVENTION</h3>
              <p>${reportData.description}</p>
            </div>
            
            ${reportData.partsUsed && reportData.partsUsed.length > 0 ? `
            <div class="section">
              <h3>🔩 PIÈCES UTILISÉES</h3>
              <div class="parts-list">
                <ul>
                  ${reportData.partsUsed.map(part => 
                    `<li>${part.partNumber} - Quantité: ${part.quantity} - Coût: ${(part.cost || 0).toFixed(2)} €</li>`
                  ).join('')}
                </ul>
              </div>
            </div>
            ` : ''}
            
            ${reportData.actions && reportData.actions.length > 0 ? `
            <div class="section">
              <h3>⚡ ACTIONS RÉALISÉES</h3>
              <div class="actions-list">
                <ul>
                  ${reportData.actions.map(action => `<li>${action}</li>`).join('')}
                </ul>
              </div>
            </div>
            ` : ''}
            
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
              <p>Ce rapport a été généré automatiquement par Maintrix</p>
              <p>Plateforme de gestion de maintenance assistée par intelligence artificielle</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateMonthlyReportHTML(reportData: MonthlyReportData): string {
    const reportDate = new Date().toLocaleDateString('fr-FR');
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                       'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthName = monthNames[reportData.month - 1];
    
    return `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rapport Mensuel - ${reportData.reportNumber}</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 40px; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #333;
              line-height: 1.6;
            }
            .container {
              max-width: 900px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #3b82f6, #1e40af);
              color: white; 
              padding: 30px; 
              margin: -40px -40px 40px -40px;
              border-radius: 12px 12px 0 0;
              text-align: center;
            }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .header h2 { margin: 10px 0 0 0; font-size: 18px; opacity: 0.9; }
            .period { font-size: 16px; margin: 10px 0; font-weight: 500; }
            .date { font-size: 14px; margin-top: 10px; opacity: 0.8; }
            .performance-badge {
              display: inline-block;
              background: rgba(255,255,255,0.2);
              padding: 8px 16px;
              border-radius: 20px;
              margin-top: 10px;
              font-weight: 600;
            }
            .section { margin-bottom: 30px; }
            .section h3 { 
              color: #1e40af; 
              border-bottom: 2px solid #e2e8f0; 
              padding-bottom: 8px; 
              margin-bottom: 20px;
              font-size: 18px;
            }
            .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
            .kpi-card { 
              background: #f8fafc; 
              padding: 20px; 
              border-radius: 12px; 
              border-left: 4px solid #3b82f6; 
              text-align: center;
            }
            .kpi-value { font-size: 24px; font-weight: bold; color: #1e40af; margin-bottom: 5px; }
            .kpi-label { font-size: 14px; color: #64748b; }
            .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .stats-item { margin-bottom: 10px; }
            .stats-item strong { color: #333; }
            .improvement-list { 
              background: #fef3c7; 
              padding: 20px; 
              border-radius: 8px; 
              border-left: 4px solid #f59e0b; 
            }
            .recommendation-list { 
              background: #dbeafe; 
              padding: 20px; 
              border-radius: 8px; 
              border-left: 4px solid #3b82f6; 
            }
            .improvement-list ul, .recommendation-list ul { margin: 0; padding-left: 20px; }
            .improvement-list li, .recommendation-list li { margin: 8px 0; }
            .footer { 
              text-align: center; 
              color: #666; 
              font-size: 12px; 
              margin-top: 60px; 
              padding-top: 20px; 
              border-top: 1px solid #ddd; 
            }
            .print-btn {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #3b82f6;
              color: white;
              border: none;
              padding: 12px 20px;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 600;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            .print-btn:hover {
              background: #2563eb;
            }
            @media print {
              body { background: none; margin: 20px; }
              .container { box-shadow: none; }
              .header { margin: -40px -40px 40px -40px; }
              .print-btn { display: none; }
            }
          </style>
        </head>
        <body>
          <button class="print-btn" onclick="window.print()">🖨️ Imprimer</button>
          <div class="container">
            <div class="header">
              <h1>Maintrix</h1>
              <h2>Rapport Mensuel de Maintenance</h2>
              <div class="period">Période: ${monthName} ${reportData.year}</div>
              <div class="date">Rapport ${reportData.reportNumber} généré le ${reportDate}</div>
              <div class="performance-badge">Score Performance: ${reportData.performanceScore}/100</div>
            </div>
            
            <div class="section">
              <h3>📊 INDICATEURS CLÉS DE PERFORMANCE</h3>
              <div class="kpi-grid">
                <div class="kpi-card">
                  <div class="kpi-value">${(reportData.equipmentAvailability || 0).toFixed(1)}%</div>
                  <div class="kpi-label">Disponibilité Équipements</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">${(reportData.mtbf || 0).toFixed(1)}h</div>
                  <div class="kpi-label">MTBF (Temps Moyen Entre Pannes)</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">${(reportData.mttr || 0).toFixed(1)}h</div>
                  <div class="kpi-label">MTTR (Temps Moyen de Réparation)</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">${(reportData.totalMaintenanceCost || 0).toFixed(0)}€</div>
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
                <div class="stats-item"><strong>Temps moyen:</strong> ${(reportData.averageCompletionTime || 0).toFixed(1)}h</div>
                <div class="stats-item"><strong>Efficacité:</strong> ${(reportData.maintenanceEfficiency || 0).toFixed(1)}%</div>
              </div>
            </div>
            
            <div class="section">
              <h3>💰 ANALYSE DES COÛTS</h3>
              <div class="stats-grid">
                <div class="stats-item"><strong>Coût total:</strong> ${(reportData.totalMaintenanceCost || 0).toFixed(2)}€</div>
                <div class="stats-item"><strong>Main d'œuvre:</strong> ${(reportData.laborCost || 0).toFixed(2)}€</div>
                <div class="stats-item"><strong>Pièces détachées:</strong> ${(reportData.partsCost || 0).toFixed(2)}€</div>
                <div class="stats-item"><strong>Sous-traitance:</strong> ${(reportData.contractorCost || 0).toFixed(2)}€</div>
                <div class="stats-item"><strong>Coût par OT:</strong> ${(reportData.costPerWorkOrder || 0).toFixed(2)}€</div>
              </div>
            </div>
            
            <div class="section">
              <h3>📦 STOCK ET APPROVISIONNEMENT</h3>
              <div class="stats-grid">
                <div class="stats-item"><strong>Pièces consommées:</strong> ${reportData.partsConsumed}</div>
                <div class="stats-item"><strong>Rotation des stocks:</strong> ${(reportData.inventoryTurnover || 0).toFixed(1)}</div>
                <div class="stats-item"><strong>Ruptures de stock:</strong> ${reportData.stockouts}</div>
                <div class="stats-item"><strong>Achats d'urgence:</strong> ${reportData.emergencyPurchases}</div>
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
              <p>Ce rapport a été généré automatiquement par Maintrix</p>
              <p>Plateforme de gestion de maintenance assistée par intelligence artificielle</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}