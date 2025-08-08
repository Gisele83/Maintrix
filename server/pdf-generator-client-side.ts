import { Response } from "express";

export interface MaintenanceReportData {
  reportNumber: string;
  equipment: string;
  description: string;
  technician: string;
  date: string;
  duration: number;
  status: string;
  priority: string;
  workOrderNumber?: string;
  interventionType?: string;
  partsUsed?: Array<{name: string, quantity: number, unitCost: number}>;
  laborCost?: number;
  totalCost?: number;
  nextMaintenanceDate?: string;
  recommendations?: string[];
  photos?: string[];
  supervisor?: string;
  actualDuration?: number;
}

export interface MonthlyReportData {
  reportNumber: string;
  year: number;
  month: number;
  performanceScore: number;
  totalWorkOrders: number;
  completedWorkOrders: number;
  pendingWorkOrders: number;
  averageResolutionTime: number;
  mtbf: number;
  mttr: number;
  availability: number;
  reliability: number;
  oee: number;
  costsBreakdown: {
    labor: number;
    parts: number;
    contractor: number;
    total: number;
  };
  topEquipmentIssues: Array<{equipment: string, issues: number, cost: number}>;
  techniciansPerformance: Array<{name: string, workOrders: number, avgTime: number, rating: number}>;
  emergencyInterventions: number;
  preventiveCompliance: number;
  budgetVariance: number;
  recommendedActions: string[];
  kpiTrends: {
    availability: number[];
    mtbf: number[];
    costs: number[];
  };
  equipmentHealth: Array<{id: string, name: string, status: string, lastMaintenance: string}>;
  upcomingMaintenance: Array<{equipment: string, type: string, dueDate: string, priority: string}>;
  stockStatus: {
    totalItems: number;
    lowStock: number;
    outOfStock: number;
    totalValue: number;
  };
  partsConsumed: number;
  inventoryTurnover: number;
  stockouts: number;
  emergencyPurchases: number;
  laborCost: number;
  partsCost: number;
  contractorCost: number;
  costPerWorkOrder: number;
  improvementAreas: string[];
  recommendations: string[];
}

export class PDFGeneratorClientSide {
  async sendMaintenanceReportHTML(res: Response, reportData: MaintenanceReportData) {
    try {
      const htmlContent = this.generateMaintenanceReportHTML(reportData);
      
      // Envoyer le HTML avec les headers appropriés pour l'affichage dans le navigateur
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      
      res.send(htmlContent);
    } catch (error) {
      console.error("Error generating maintenance report HTML:", error);
      throw error;
    }
  }

  async sendMonthlyReportHTML(res: Response, reportData: MonthlyReportData) {
    try {
      const htmlContent = this.generateMonthlyReportHTML(reportData);
      
      // Envoyer le HTML avec les headers appropriés pour l'affichage dans le navigateur
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      
      res.send(htmlContent);
    } catch (error) {
      console.error("Error generating monthly report HTML:", error);
      throw error;
    }
  }

  private generateMaintenanceReportHTML(reportData: MaintenanceReportData): string {
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
              margin: 0; 
              padding: 40px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #333;
              line-height: 1.6;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 15px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #667eea;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #667eea;
              margin: 0;
              font-size: 2.2em;
              font-weight: 700;
            }
            .header .subtitle {
              color: #666;
              font-size: 1.1em;
              margin-top: 10px;
            }
            .section {
              margin-bottom: 25px;
              padding: 20px;
              background: #f8f9ff;
              border-radius: 10px;
              border-left: 4px solid #667eea;
            }
            .section h3 {
              color: #667eea;
              margin-top: 0;
              font-size: 1.3em;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 15px;
              margin-top: 15px;
            }
            .info-item {
              background: white;
              padding: 15px;
              border-radius: 8px;
              border: 1px solid #e0e6ff;
            }
            .info-item strong {
              color: #667eea;
              display: block;
              margin-bottom: 5px;
            }
            .status-badge {
              display: inline-block;
              padding: 5px 15px;
              border-radius: 20px;
              font-weight: bold;
              font-size: 0.9em;
            }
            .status-completed { background: #d4edda; color: #155724; }
            .status-pending { background: #fff3cd; color: #856404; }
            .status-high { background: #f8d7da; color: #721c24; }
            .parts-list {
              background: white;
              border-radius: 8px;
              overflow: hidden;
              margin-top: 15px;
            }
            .parts-list table {
              width: 100%;
              border-collapse: collapse;
            }
            .parts-list th {
              background: #667eea;
              color: white;
              padding: 12px;
              text-align: left;
            }
            .parts-list td {
              padding: 10px 12px;
              border-bottom: 1px solid #eee;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #eee;
              color: #666;
              font-size: 0.9em;
            }
            .download-btn {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #667eea;
              color: white;
              padding: 12px 24px;
              border: none;
              border-radius: 25px;
              cursor: pointer;
              font-weight: bold;
              box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
              z-index: 1000;
            }
            .download-btn:hover {
              background: #5a6fd8;
              transform: translateY(-2px);
            }
            @media print {
              body { background: white; padding: 0; }
              .container { box-shadow: none; }
              .download-btn { display: none; }
            }
          </style>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
        </head>
        <body>
          <button class="download-btn" onclick="downloadAsPDF()">📄 Télécharger PDF</button>
          
          <div class="container" id="reportContent">
            <div class="header">
              <h1>🔧 RAPPORT D'INTERVENTION</h1>
              <div class="subtitle">Smart GMAO DiagFix - Système de Gestion de Maintenance</div>
              <div class="subtitle">Rapport N° ${reportData.reportNumber}</div>
            </div>
            
            <div class="section">
              <h3>📋 INFORMATIONS GÉNÉRALES</h3>
              <div class="info-grid">
                <div class="info-item">
                  <strong>Équipement:</strong>
                  ${reportData.equipment}
                </div>
                <div class="info-item">
                  <strong>Technicien:</strong>
                  ${reportData.technician}
                </div>
                <div class="info-item">
                  <strong>Date d'intervention:</strong>
                  ${reportData.date}
                </div>
                <div class="info-item">
                  <strong>Durée:</strong>
                  ${reportData.duration} minutes
                </div>
                <div class="info-item">
                  <strong>Statut:</strong>
                  <span class="status-badge status-${(reportData.status || 'unknown').toLowerCase()}">${reportData.status || 'Non défini'}</span>
                </div>
                <div class="info-item">
                  <strong>Priorité:</strong>
                  <span class="status-badge status-${(reportData.priority || 'normal').toLowerCase()}">${reportData.priority || 'Normal'}</span>
                </div>
              </div>
            </div>
            
            <div class="section">
              <h3>📝 DESCRIPTION DE L'INTERVENTION</h3>
              <div class="info-item">
                ${reportData.description}
              </div>
            </div>
            
            ${reportData.partsUsed && reportData.partsUsed.length > 0 ? `
            <div class="section">
              <h3>🔧 PIÈCES UTILISÉES</h3>
              <div class="parts-list">
                <table>
                  <thead>
                    <tr>
                      <th>Pièce</th>
                      <th>Quantité</th>
                      <th>Coût unitaire</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${reportData.partsUsed.map(part => `
                      <tr>
                        <td>${part.name}</td>
                        <td>${part.quantity}</td>
                        <td>${part.unitCost.toFixed(2)}€</td>
                        <td>${(part.quantity * part.unitCost).toFixed(2)}€</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            ` : ''}
            
            <div class="section">
              <h3>💰 COÛTS</h3>
              <div class="info-grid">
                <div class="info-item">
                  <strong>Coût main d'œuvre:</strong>
                  ${(reportData.laborCost || 0).toFixed(2)}€
                </div>
                <div class="info-item">
                  <strong>Coût total:</strong>
                  ${(reportData.totalCost || 0).toFixed(2)}€
                </div>
              </div>
            </div>
            
            ${reportData.recommendations && reportData.recommendations.length > 0 ? `
            <div class="section">
              <h3>💡 RECOMMANDATIONS</h3>
              <div class="info-item">
                <ul>
                  ${reportData.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
              </div>
            </div>
            ` : ''}
            
            <div class="footer">
              <p>Ce rapport a été généré automatiquement par Smart GMAO DiagFix</p>
              <p>Plateforme de gestion de maintenance assistée par intelligence artificielle</p>
            </div>
          </div>
          
          <script>
            async function downloadAsPDF() {
              try {
                const { jsPDF } = window.jspdf;
                const element = document.getElementById('reportContent');
                
                const canvas = await html2canvas(element, {
                  scale: 2,
                  useCORS: true,
                  allowTaint: true
                });
                
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF();
                const imgWidth = 190;
                const pageHeight = pdf.internal.pageSize.height;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                let heightLeft = imgHeight;
                let position = 10;
                
                pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
                
                while (heightLeft >= 0) {
                  position = heightLeft - imgHeight + 10;
                  pdf.addPage();
                  pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                  heightLeft -= pageHeight;
                }
                
                pdf.save('rapport-intervention-${reportData.reportNumber}.pdf');
              } catch (error) {
                console.error('Erreur lors de la génération du PDF:', error);
                alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
              }
            }
            
            // Auto-download après 2 secondes
            setTimeout(() => {
              downloadAsPDF();
            }, 2000);
          </script>
        </body>
      </html>
    `;
  }

  private generateMonthlyReportHTML(reportData: MonthlyReportData): string {
    const monthNames = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    
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
              margin: 0; 
              padding: 40px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #333;
              line-height: 1.6;
            }
            .container {
              max-width: 900px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 15px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #667eea;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #667eea;
              margin: 0;
              font-size: 2.5em;
              font-weight: 700;
            }
            .header .subtitle {
              color: #666;
              font-size: 1.2em;
              margin-top: 10px;
            }
            .section {
              margin-bottom: 30px;
              padding: 25px;
              background: #f8f9ff;
              border-radius: 12px;
              border-left: 5px solid #667eea;
            }
            .section h3 {
              color: #667eea;
              margin-top: 0;
              font-size: 1.4em;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 15px;
              margin-top: 20px;
            }
            .stats-item {
              background: white;
              padding: 20px;
              border-radius: 10px;
              border: 1px solid #e0e6ff;
              text-align: center;
              transition: transform 0.2s;
            }
            .stats-item:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }
            .stats-item strong {
              color: #667eea;
              display: block;
              margin-bottom: 8px;
              font-size: 0.9em;
            }
            .stats-value {
              font-size: 1.8em;
              font-weight: bold;
              color: #333;
            }
            .performance-score {
              font-size: 3em;
              font-weight: bold;
              color: #28a745;
              text-align: center;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #eee;
              color: #666;
              font-size: 0.9em;
            }
            .download-btn {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #667eea;
              color: white;
              padding: 12px 24px;
              border: none;
              border-radius: 25px;
              cursor: pointer;
              font-weight: bold;
              box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
              z-index: 1000;
            }
            .download-btn:hover {
              background: #5a6fd8;
              transform: translateY(-2px);
            }
            @media print {
              body { background: white; padding: 0; }
              .container { box-shadow: none; }
              .download-btn { display: none; }
            }
          </style>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
        </head>
        <body>
          <button class="download-btn" onclick="downloadAsPDF()">📄 Télécharger PDF</button>
          
          <div class="container" id="reportContent">
            <div class="header">
              <h1>📊 RAPPORT MENSUEL</h1>
              <div class="subtitle">Smart GMAO DiagFix - ${monthNames[reportData.month - 1]} ${reportData.year}</div>
              <div class="subtitle">Rapport N° ${reportData.reportNumber}</div>
            </div>
            
            <div class="section">
              <h3>🎯 SCORE DE PERFORMANCE</h3>
              <div class="performance-score">${reportData.performanceScore}%</div>
            </div>
            
            <div class="section">
              <h3>📈 INDICATEURS CLÉS (KPI)</h3>
              <div class="stats-grid">
                <div class="stats-item">
                  <strong>Disponibilité</strong>
                  <div class="stats-value">${(reportData.availability || 0).toFixed(1)}%</div>
                </div>
                <div class="stats-item">
                  <strong>MTBF</strong>
                  <div class="stats-value">${(reportData.mtbf || 0).toFixed(0)}h</div>
                </div>
                <div class="stats-item">
                  <strong>MTTR</strong>
                  <div class="stats-value">${(reportData.mttr || 0).toFixed(1)}h</div>
                </div>
                <div class="stats-item">
                  <strong>OEE</strong>
                  <div class="stats-value">${(reportData.oee || 0).toFixed(1)}%</div>
                </div>
              </div>
            </div>
            
            <div class="section">
              <h3>🛠️ ORDRES DE TRAVAIL</h3>
              <div class="stats-grid">
                <div class="stats-item">
                  <strong>Total des OT</strong>
                  <div class="stats-value">${reportData.totalWorkOrders}</div>
                </div>
                <div class="stats-item">
                  <strong>OT Complétés</strong>
                  <div class="stats-value">${reportData.completedWorkOrders}</div>
                </div>
                <div class="stats-item">
                  <strong>OT En Attente</strong>
                  <div class="stats-value">${reportData.pendingWorkOrders}</div>
                </div>
                <div class="stats-item">
                  <strong>Temps Moyen</strong>
                  <div class="stats-value">${(reportData.averageResolutionTime || 0).toFixed(1)}h</div>
                </div>
              </div>
            </div>
            
            <div class="section">
              <h3>💰 ANALYSE DES COÛTS</h3>
              <div class="stats-grid">
                <div class="stats-item">
                  <strong>Main d'œuvre</strong>
                  <div class="stats-value">${(reportData.laborCost || 0).toFixed(0)}€</div>
                </div>
                <div class="stats-item">
                  <strong>Pièces détachées</strong>
                  <div class="stats-value">${(reportData.partsCost || 0).toFixed(0)}€</div>
                </div>
                <div class="stats-item">
                  <strong>Sous-traitance</strong>
                  <div class="stats-value">${(reportData.contractorCost || 0).toFixed(0)}€</div>
                </div>
                <div class="stats-item">
                  <strong>Coût par OT</strong>
                  <div class="stats-value">${(reportData.costPerWorkOrder || 0).toFixed(0)}€</div>
                </div>
              </div>
            </div>
            
            <div class="section">
              <h3>📦 STOCK ET APPROVISIONNEMENT</h3>
              <div class="stats-grid">
                <div class="stats-item">
                  <strong>Pièces consommées</strong>
                  <div class="stats-value">${reportData.partsConsumed}</div>
                </div>
                <div class="stats-item">
                  <strong>Rotation des stocks</strong>
                  <div class="stats-value">${(reportData.inventoryTurnover || 0).toFixed(1)}</div>
                </div>
                <div class="stats-item">
                  <strong>Ruptures de stock</strong>
                  <div class="stats-value">${reportData.stockouts}</div>
                </div>
                <div class="stats-item">
                  <strong>Achats d'urgence</strong>
                  <div class="stats-value">${reportData.emergencyPurchases}</div>
                </div>
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
          </div>
          
          <script>
            async function downloadAsPDF() {
              try {
                const { jsPDF } = window.jspdf;
                const element = document.getElementById('reportContent');
                
                const canvas = await html2canvas(element, {
                  scale: 2,
                  useCORS: true,
                  allowTaint: true
                });
                
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF();
                const imgWidth = 190;
                const pageHeight = pdf.internal.pageSize.height;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                let heightLeft = imgHeight;
                let position = 10;
                
                pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
                
                while (heightLeft >= 0) {
                  position = heightLeft - imgHeight + 10;
                  pdf.addPage();
                  pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                  heightLeft -= pageHeight;
                }
                
                pdf.save('rapport-mensuel-${reportData.reportNumber}.pdf');
              } catch (error) {
                console.error('Erreur lors de la génération du PDF:', error);
                alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
              }
            }
            
            // Auto-download après 2 secondes
            setTimeout(() => {
              downloadAsPDF();
            }, 2000);
          </script>
        </body>
      </html>
    `;
  }
}