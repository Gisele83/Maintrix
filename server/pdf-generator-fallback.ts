const jsPDF = require("jspdf").jsPDF;
import type { Response } from "express";

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

export class PDFGeneratorFallback {
  async generateMaintenanceReportPDF(reportData: MaintenanceReportData): Promise<Buffer> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Configuration
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let currentY = 20;
    const leftMargin = 20;
    const rightMargin = pageWidth - 20;
    const lineHeight = 8;

    // Fonction utilitaire pour ajouter du texte
    const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      
      const lines = pdf.splitTextToSize(text, rightMargin - leftMargin);
      lines.forEach((line: string) => {
        if (currentY > pageHeight - 20) {
          pdf.addPage();
          currentY = 20;
        }
        pdf.text(line, leftMargin, currentY);
        currentY += lineHeight;
      });
      currentY += 3; // Espace supplémentaire
    };

    // En-tête
    pdf.setFillColor(102, 126, 234);
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Smart GMAO DiagFix', pageWidth / 2, 15, { align: 'center' });
    
    pdf.setFontSize(14);
    pdf.text('Rapport d\'Intervention de Maintenance', pageWidth / 2, 25, { align: 'center' });
    
    pdf.setFontSize(10);
    const reportDate = new Date(reportData.createdAt).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    pdf.text(`Généré le ${reportDate}`, pageWidth / 2, 35, { align: 'center' });
    
    // Reset couleur de texte
    pdf.setTextColor(0, 0, 0);
    currentY = 50;

    // Informations générales
    addText('INFORMATIONS GÉNÉRALES', 16, true);
    addText(`Numéro de rapport: ${reportData.reportNumber}`, 12);
    addText(`Type d'intervention: ${reportData.interventionType}`, 12);
    addText(`Technicien: ${reportData.technician}`, 12);
    
    if (reportData.supervisor) {
      addText(`Superviseur: ${reportData.supervisor}`, 12);
    }
    
    if (reportData.actualDuration) {
      addText(`Durée réelle: ${reportData.actualDuration} minutes`, 12);
    }
    
    if (reportData.totalCost) {
      addText(`Coût total: ${reportData.totalCost.toFixed(2)} €`, 12);
    }
    
    currentY += 10;

    // Description des travaux
    addText('DESCRIPTION DES TRAVAUX', 16, true);
    addText(reportData.workDescription, 11);
    
    currentY += 10;

    // Diagnostic du problème
    if (reportData.problemDiagnosis) {
      addText('DIAGNOSTIC DU PROBLÈME', 16, true);
      addText(reportData.problemDiagnosis, 11);
      currentY += 10;
    }

    // Actions réalisées
    addText('ACTIONS RÉALISÉES', 16, true);
    addText(reportData.actionsTaken, 11);
    
    currentY += 10;

    // Pièces utilisées
    if (reportData.partsUsed && reportData.partsUsed.length > 0) {
      addText('PIÈCES UTILISÉES', 16, true);
      reportData.partsUsed.forEach(part => {
        const partText = `• ${part.partNumber} - Qty: ${part.quantity} - Coût: ${part.cost.toFixed(2)} €`;
        addText(partText, 10);
      });
      currentY += 10;
    }

    // Outils utilisés
    if (reportData.toolsUsed && reportData.toolsUsed.length > 0) {
      addText('OUTILS UTILISÉS', 16, true);
      reportData.toolsUsed.forEach(tool => {
        addText(`• ${tool}`, 10);
      });
      currentY += 10;
    }

    // Incidents de sécurité
    if (reportData.safetyIncidents) {
      addText('⚠️ INCIDENT DE SÉCURITÉ SIGNALÉ', 14, true);
      addText(reportData.safetyIncidents, 11);
      currentY += 10;
    }

    // Contrôle qualité
    if (reportData.qualityCheck) {
      addText('✅ CONTRÔLE QUALITÉ VALIDÉ', 14, true);
      if (reportData.qualityNotes) {
        addText(`Notes: ${reportData.qualityNotes}`, 11);
      }
      currentY += 10;
    }

    // Suivi requis
    if (reportData.followUpRequired) {
      addText('📅 SUIVI REQUIS', 14, true);
      if (reportData.followUpDate) {
        const followUpDate = new Date(reportData.followUpDate).toLocaleDateString('fr-FR');
        addText(`Date de suivi: ${followUpDate}`, 11);
      }
      if (reportData.followUpNotes) {
        addText(`Notes: ${reportData.followUpNotes}`, 11);
      }
    }

    // Pied de page
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Ce rapport a été généré automatiquement par Smart GMAO DiagFix', pageWidth / 2, pageHeight - 15, { align: 'center' });
    pdf.text('Plateforme de gestion de maintenance assistée par intelligence artificielle', pageWidth / 2, pageHeight - 10, { align: 'center' });

    return Buffer.from(pdf.output('arraybuffer'));
  }

  async generateMonthlyReportPDF(reportData: MonthlyReportData): Promise<Buffer> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let currentY = 20;
    const leftMargin = 20;
    const rightMargin = pageWidth - 20;
    const lineHeight = 8;

    const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      
      const lines = pdf.splitTextToSize(text, rightMargin - leftMargin);
      lines.forEach((line: string) => {
        if (currentY > pageHeight - 20) {
          pdf.addPage();
          currentY = 20;
        }
        pdf.text(line, leftMargin, currentY);
        currentY += lineHeight;
      });
      currentY += 3;
    };

    // En-tête
    pdf.setFillColor(59, 130, 246);
    pdf.rect(0, 0, pageWidth, 50, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Smart GMAO DiagFix', pageWidth / 2, 15, { align: 'center' });
    
    pdf.setFontSize(16);
    pdf.text('Rapport Mensuel de Maintenance', pageWidth / 2, 25, { align: 'center' });
    
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const monthName = monthNames[reportData.month - 1];
    pdf.setFontSize(12);
    pdf.text(`Période: ${monthName} ${reportData.year}`, pageWidth / 2, 35, { align: 'center' });
    
    pdf.setFontSize(10);
    const reportDate = new Date(reportData.generatedAt).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    pdf.text(`Rapport ${reportData.reportNumber} généré le ${reportDate}`, pageWidth / 2, 42, { align: 'center' });
    
    // Badge de performance
    pdf.setFillColor(16, 185, 129);
    pdf.roundedRect(pageWidth / 2 - 25, 45, 50, 8, 3, 3, 'F');
    pdf.setFontSize(10);
    pdf.text(`Score Performance: ${reportData.performanceScore}/100`, pageWidth / 2, 50, { align: 'center' });
    
    pdf.setTextColor(0, 0, 0);
    currentY = 65;

    // KPIs principaux
    addText('INDICATEURS CLÉS DE PERFORMANCE', 16, true);
    addText(`Disponibilité Équipements: ${reportData.equipmentAvailability.toFixed(1)}%`, 12);
    addText(`MTBF (Temps Moyen Entre Pannes): ${reportData.mtbf.toFixed(1)}h`, 12);
    addText(`MTTR (Temps Moyen de Réparation): ${reportData.mttr.toFixed(1)}h`, 12);
    addText(`Coût Total: ${reportData.totalMaintenanceCost.toFixed(0)}€`, 12);
    
    currentY += 10;

    // Statistiques des ordres de travail
    addText('ORDRES DE TRAVAIL', 16, true);
    addText(`Total: ${reportData.totalWorkOrders}`, 12);
    addText(`Terminés: ${reportData.completedWorkOrders}`, 12);
    addText(`Préventifs: ${reportData.preventiveWorkOrders}`, 12);
    addText(`Correctifs: ${reportData.correctiveWorkOrders}`, 12);
    addText(`Temps moyen de réalisation: ${reportData.averageCompletionTime.toFixed(1)}h`, 12);
    
    currentY += 10;

    // Analyse des coûts
    addText('ANALYSE DES COÛTS', 16, true);
    addText(`Coût total: ${reportData.totalMaintenanceCost.toFixed(2)}€`, 12);
    addText(`Main d'œuvre: ${reportData.laborCost.toFixed(2)}€`, 12);
    addText(`Pièces détachées: ${reportData.partsCost.toFixed(2)}€`, 12);
    addText(`Sous-traitance: ${reportData.contractorCost.toFixed(2)}€`, 12);
    addText(`Coût par ordre de travail: ${reportData.costPerWorkOrder.toFixed(2)}€`, 12);
    
    currentY += 10;

    // Stock et approvisionnement
    addText('STOCK ET APPROVISIONNEMENT', 16, true);
    addText(`Pièces consommées: ${reportData.partsConsumed}`, 12);
    addText(`Rotation des stocks: ${reportData.inventoryTurnover.toFixed(1)}`, 12);
    addText(`Ruptures de stock: ${reportData.stockouts}`, 12);
    addText(`Achats d'urgence: ${reportData.emergencyPurchases}`, 12);
    
    currentY += 10;

    // Alertes et incidents
    addText('ALERTES ET INCIDENTS', 16, true);
    addText(`Total des alertes: ${reportData.totalAlerts}`, 12);
    addText(`Alertes critiques: ${reportData.criticalAlerts}`, 12);
    addText(`Incidents de sécurité: ${reportData.safetyIncidents}`, 12);
    addText(`Problèmes de qualité: ${reportData.qualityIssues}`, 12);
    
    currentY += 10;

    // Domaines d'amélioration
    if (reportData.improvementAreas && reportData.improvementAreas.length > 0) {
      addText('DOMAINES D\'AMÉLIORATION', 16, true);
      reportData.improvementAreas.forEach(area => {
        addText(`• ${area}`, 11);
      });
      currentY += 5;
    }

    // Recommandations
    if (reportData.recommendations && reportData.recommendations.length > 0) {
      addText('RECOMMANDATIONS', 16, true);
      reportData.recommendations.forEach(recommendation => {
        addText(`• ${recommendation}`, 11);
      });
    }

    // Pied de page
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Ce rapport a été généré automatiquement par Smart GMAO DiagFix', pageWidth / 2, pageHeight - 15, { align: 'center' });
    pdf.text('Plateforme de gestion de maintenance assistée par intelligence artificielle', pageWidth / 2, pageHeight - 10, { align: 'center' });

    return Buffer.from(pdf.output('arraybuffer'));
  }

  async sendMaintenanceReportPDF(res: Response, reportData: MaintenanceReportData) {
    try {
      const pdfBuffer = await this.generateMaintenanceReportPDF(reportData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="rapport-intervention-${reportData.reportNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating maintenance report PDF:", error);
      throw error;
    }
  }

  async sendMonthlyReportPDF(res: Response, reportData: MonthlyReportData) {
    try {
      const pdfBuffer = await this.generateMonthlyReportPDF(reportData);
      
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

export const pdfGeneratorFallback = new PDFGeneratorFallback();