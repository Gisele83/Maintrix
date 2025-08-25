import { Response } from 'express';

export interface MaintenanceReportData {
  reportNumber: string;
  equipment: string;
  description: string;
  technician: string;
  date: string;
  duration: number;
  status: string;
  priority: string;
  workOrderNumber: string;
  interventionType?: string;
  partsUsed?: Array<{ name: string; quantity: number; unitCost: number }>;
  laborCost?: number;
  totalCost?: number;
  nextMaintenanceDate?: string;
  recommendations?: string[];
  supervisor?: string;
  actualDuration?: number;
}

export interface MonthlyReportData {
  reportNumber: string;
  month: string;
  year: number;
  totalInterventions: number;
  completedInterventions: number;
  pendingInterventions: number;
  totalCost: number;
  averageDuration: number;
  equipmentStats: Array<{
    equipmentName: string;
    interventionCount: number;
    totalDowntime: number;
  }>;
  monthlyKPIs: {
    availability: number;
    mtbf: number;
    mttr: number;
  };
}

export class PDFGeneratorFunctional {
  
  // Generate a functional HTML page that actually converts to PDF
  async sendMaintenanceReportHTML(res: Response, reportData: MaintenanceReportData) {
    try {
      const htmlContent = this.generateWorkingPDFPage(reportData);
      
      // Headers pour affichage navigateur normal
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      
      res.send(htmlContent);
    } catch (error) {
      console.error('Error generating maintenance report:', error);
      throw error;
    }
  }

  async sendMonthlyReportHTML(res: Response, reportData: MonthlyReportData) {
    try {
      const htmlContent = this.generateWorkingMonthlyPDFPage(reportData);
      
      // Headers pour affichage navigateur normal
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      
      res.send(htmlContent);
    } catch (error) {
      console.error('Error generating monthly report:', error);
      throw error;
    }
  }

  async sendComprehensiveReportHTML(res: Response, reportData: any) {
    try {
      const htmlContent = this.generateComprehensiveReportPDFPage(reportData);
      
      // Headers pour affichage navigateur normal
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      
      res.send(htmlContent);
    } catch (error) {
      console.error('Error generating comprehensive report:', error);
      throw error;
    }
  }

  private generateWorkingPDFPage(reportData: MaintenanceReportData): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rapport Intervention - ${reportData.reportNumber}</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
          <style>
            * { box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 20px;
              background: #f5f5f5;
            }
            .pdf-container { 
              max-width: 800px; 
              margin: 0 auto; 
              background: white;
              box-shadow: 0 0 20px rgba(0,0,0,0.1);
              padding: 40px;
            }
            .header { 
              text-align: center; 
              border-bottom: 3px solid #007bff; 
              padding-bottom: 20px; 
              margin-bottom: 30px; 
            }
            .header h1 { 
              color: #007bff; 
              margin: 0; 
              font-size: 28px; 
            }
            .section { 
              margin-bottom: 25px; 
              padding: 20px;
              border: 1px solid #e0e0e0;
              border-radius: 8px;
              background: #fafafa;
            }
            .section h3 { 
              color: #333; 
              margin: 0 0 15px 0; 
              font-size: 18px;
              border-bottom: 2px solid #007bff;
              padding-bottom: 8px;
            }
            .info-grid { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 15px; 
            }
            .info-item { 
              padding: 10px; 
            }
            .info-item strong { 
              color: #555; 
              display: block;
              margin-bottom: 5px;
            }
            .status-badge { 
              padding: 4px 12px; 
              border-radius: 20px; 
              font-size: 12px; 
              font-weight: bold; 
              text-transform: uppercase;
            }
            .status-completed { background: #d4edda; color: #155724; }
            .status-high { background: #f8d7da; color: #721c24; }
            .status-normal { background: #d1ecf1; color: #0c5460; }
            .parts-table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 10px;
            }
            .parts-table th, .parts-table td { 
              border: 1px solid #ddd; 
              padding: 12px; 
              text-align: left; 
            }
            .parts-table th { 
              background: #007bff; 
              color: white; 
            }
            .cost-summary { 
              background: #e7f3ff; 
              padding: 15px; 
              border-radius: 8px; 
              margin-top: 15px;
            }
            .download-btn {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #007bff;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
              z-index: 1000;
            }
            .download-btn:hover {
              background: #0056b3;
            }
            @media print {
              .download-btn { display: none; }
              body { background: white; }
              .pdf-container { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <button class="download-btn" onclick="generateAndDownloadPDF()">📄 Télécharger PDF</button>
          
          <div class="pdf-container" id="reportContent">
            <div class="header">
              <h1>🔧 RAPPORT D'INTERVENTION</h1>
              <p><strong>N° ${reportData.reportNumber}</strong></p>
              <p>Smart GMAO DiagFix - Système de Maintenance Industrielle</p>
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
              <table class="parts-table">
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
                      <td>${part.unitCost.toFixed(2)} €</td>
                      <td>${(part.quantity * part.unitCost).toFixed(2)} €</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}
            
            ${reportData.totalCost ? `
            <div class="section">
              <h3>💰 COÛTS</h3>
              <div class="cost-summary">
                <div class="info-grid">
                  <div class="info-item">
                    <strong>Main d'œuvre:</strong>
                    ${reportData.laborCost?.toFixed(2) || '0.00'} €
                  </div>
                  <div class="info-item">
                    <strong>Coût total:</strong>
                    <strong style="font-size: 18px; color: #007bff;">${reportData.totalCost.toFixed(2)} €</strong>
                  </div>
                </div>
              </div>
            </div>
            ` : ''}
            
            ${reportData.recommendations && reportData.recommendations.length > 0 ? `
            <div class="section">
              <h3>💡 RECOMMANDATIONS</h3>
              <ul>
                ${reportData.recommendations.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
          </div>

          <script>
            const { jsPDF } = window.jspdf;
            
            async function generateAndDownloadPDF() {
              try {
                console.log('🔄 Début génération PDF...');
                
                const element = document.getElementById('reportContent');
                const canvas = await html2canvas(element, {
                  scale: 2,
                  useCORS: true,
                  allowTaint: true,
                  backgroundColor: '#ffffff'
                });
                
                console.log('✅ Canvas généré');
                
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const imgWidth = 190;
                const pageHeight = pdf.internal.pageSize.height - 20;
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
                
                const filename = 'rapport-intervention-${reportData.reportNumber}.pdf';
                pdf.save(filename);
                
                console.log('✅ PDF téléchargé:', filename);
                
              } catch (error) {
                console.error('❌ Erreur génération PDF:', error);
                alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
              }
            }
            
            // Auto-download après chargement complet
            window.addEventListener('load', () => {
              setTimeout(() => {
                console.log('🚀 Auto-download du PDF...');
                generateAndDownloadPDF();
              }, 2000);
            });
          </script>
        </body>
      </html>
    `;
  }

  private generateWorkingMonthlyPDFPage(reportData: MonthlyReportData): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rapport Mensuel - ${reportData.reportNumber}</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
          <style>
            * { box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 20px;
              background: #f5f5f5;
            }
            .pdf-container { 
              max-width: 800px; 
              margin: 0 auto; 
              background: white;
              box-shadow: 0 0 20px rgba(0,0,0,0.1);
              padding: 40px;
            }
            .header { 
              text-align: center; 
              border-bottom: 3px solid #28a745; 
              padding-bottom: 20px; 
              margin-bottom: 30px; 
            }
            .header h1 { 
              color: #28a745; 
              margin: 0; 
              font-size: 28px; 
            }
            .section { 
              margin-bottom: 25px; 
              padding: 20px;
              border: 1px solid #e0e0e0;
              border-radius: 8px;
              background: #fafafa;
            }
            .section h3 { 
              color: #333; 
              margin: 0 0 15px 0; 
              font-size: 18px;
              border-bottom: 2px solid #28a745;
              padding-bottom: 8px;
            }
            .kpi-grid { 
              display: grid; 
              grid-template-columns: 1fr 1fr 1fr; 
              gap: 20px; 
            }
            .kpi-card { 
              background: linear-gradient(135deg, #28a745, #20c997);
              color: white;
              padding: 20px;
              border-radius: 12px;
              text-align: center;
            }
            .kpi-value { 
              font-size: 32px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .kpi-label { 
              font-size: 14px;
              opacity: 0.9;
            }
            .download-btn {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #28a745;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
              z-index: 1000;
            }
            .download-btn:hover {
              background: #218838;
            }
            @media print {
              .download-btn { display: none; }
              body { background: white; }
              .pdf-container { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <button class="download-btn" onclick="generateAndDownloadPDF()">📊 Télécharger PDF</button>
          
          <div class="pdf-container" id="reportContent">
            <div class="header">
              <h1>📊 RAPPORT MENSUEL</h1>
              <p><strong>N° ${reportData.reportNumber}</strong></p>
              <p>${reportData.month} ${reportData.year}</p>
              <p>Smart GMAO DiagFix - Système de Maintenance Industrielle</p>
            </div>
            
            <div class="section">
              <h3>📈 INDICATEURS CLÉS</h3>
              <div class="kpi-grid">
                <div class="kpi-card">
                  <div class="kpi-value">${reportData.totalInterventions}</div>
                  <div class="kpi-label">Total Interventions</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">${reportData.completedInterventions}</div>
                  <div class="kpi-label">Terminées</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">${reportData.pendingInterventions}</div>
                  <div class="kpi-label">En cours</div>
                </div>
              </div>
            </div>
            
            <div class="section">
              <h3>💰 ANALYSE FINANCIÈRE</h3>
              <p><strong>Coût total du mois:</strong> ${reportData.totalCost.toFixed(2)} €</p>
              <p><strong>Durée moyenne d'intervention:</strong> ${reportData.averageDuration} minutes</p>
            </div>
            
            <div class="section">
              <h3>⚙️ PERFORMANCE DES ÉQUIPEMENTS</h3>
              ${reportData.equipmentStats.map(stat => `
                <div style="margin-bottom: 15px; padding: 15px; border-left: 4px solid #28a745; background: #f8f9fa;">
                  <strong>${stat.equipmentName}</strong><br>
                  Interventions: ${stat.interventionCount} | Temps d'arrêt: ${stat.totalDowntime}h
                </div>
              `).join('')}
            </div>
            
            <div class="section">
              <h3>🎯 KPIs DE MAINTENANCE</h3>
              <div class="kpi-grid">
                <div class="kpi-card">
                  <div class="kpi-value">${reportData.monthlyKPIs.availability.toFixed(1)}%</div>
                  <div class="kpi-label">Disponibilité</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">${reportData.monthlyKPIs.mtbf.toFixed(1)}h</div>
                  <div class="kpi-label">MTBF</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">${reportData.monthlyKPIs.mttr.toFixed(1)}h</div>
                  <div class="kpi-label">MTTR</div>
                </div>
              </div>
            </div>
          </div>

          <script>
            const { jsPDF } = window.jspdf;
            
            async function generateAndDownloadPDF() {
              try {
                console.log('🔄 Début génération PDF mensuel...');
                
                const element = document.getElementById('reportContent');
                const canvas = await html2canvas(element, {
                  scale: 2,
                  useCORS: true,
                  allowTaint: true,
                  backgroundColor: '#ffffff'
                });
                
                console.log('✅ Canvas généré');
                
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const imgWidth = 190;
                const pageHeight = pdf.internal.pageSize.height - 20;
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
                
                const filename = 'rapport-mensuel-${reportData.reportNumber}.pdf';
                pdf.save(filename);
                
                console.log('✅ PDF téléchargé:', filename);
                
              } catch (error) {
                console.error('❌ Erreur génération PDF:', error);
                alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
              }
            }
            
            // Auto-download après chargement complet
            window.addEventListener('load', () => {
              setTimeout(() => {
                console.log('🚀 Auto-download du PDF mensuel...');
                generateAndDownloadPDF();
              }, 2000);
            });
          </script>
        </body>
      </html>
    `;
  }

  private generateComprehensiveReportPDFPage(reportData: any): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rapport Complet GMAO - ${reportData.reportNumber}</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
          <style>
            * { box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 20px;
              background: #f5f5f5;
            }
            .pdf-container { 
              max-width: 800px; 
              margin: 0 auto; 
              background: white;
              box-shadow: 0 0 20px rgba(0,0,0,0.1);
              padding: 40px;
            }
            .header { 
              text-align: center; 
              border-bottom: 3px solid #007bff; 
              padding-bottom: 20px; 
              margin-bottom: 30px; 
            }
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin: 20px 0;
            }
            .kpi-card {
              border: 1px solid #e0e0e0;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
            }
            .kpi-value {
              font-size: 2em;
              font-weight: bold;
              color: #007bff;
            }
          </style>
        </head>
        <body>
          <div class="pdf-container" id="pdf-content">
            <div class="header">
              <h1>📊 Rapport Complet GMAO</h1>
              <p>Numéro: ${reportData.reportNumber}</p>
              <p>Période: ${reportData.period} | Département: ${reportData.department}</p>
              <p>Généré le: ${new Date(reportData.generatedAt).toLocaleDateString('fr-FR')}</p>
            </div>

            <div class="section">
              <h2>📈 Indicateurs Clés de Performance</h2>
              <div class="kpi-grid">
                <div class="kpi-card">
                  <div class="kpi-value">${reportData.kpis.availability.toFixed(1)}%</div>
                  <div>Disponibilité</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">${reportData.kpis.mtbf.toFixed(0)}h</div>
                  <div>MTBF</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">${reportData.kpis.mttr.toFixed(1)}h</div>
                  <div>MTTR</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-value">${reportData.kpis.oee.toFixed(1)}%</div>
                  <div>OEE</div>
                </div>
              </div>
            </div>

            <div class="section">
              <h2>📋 Résumé Exécutif</h2>
              <ul>
                <li>Total interventions: ${reportData.summary.totalInterventions}</li>
                <li>Interventions terminées: ${reportData.summary.completedInterventions}</li>
                <li>Utilisation budget: ${reportData.summary.budgetUtilization}%</li>
                <li>Alertes critiques: ${reportData.summary.criticalAlerts}</li>
              </ul>
            </div>

            <div class="footer">
              <p>Smart GMAO DiagFix - Rapport généré automatiquement</p>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(() => {
                const { jsPDF } = window.jspdf;
                html2canvas(document.getElementById('pdf-content')).then(canvas => {
                  const imgData = canvas.toDataURL('image/png');
                  const pdf = new jsPDF();
                  const imgWidth = 210;
                  const pageHeight = 295;
                  const imgHeight = (canvas.height * imgWidth) / canvas.width;
                  let heightLeft = imgHeight;
                  let position = 0;

                  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                  heightLeft -= pageHeight;

                  while (heightLeft >= 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                  }

                  pdf.save('rapport-gmao-complet.pdf');
                });
              }, 1000);
            };
          </script>
        </body>
      </html>
    `;
  }
}