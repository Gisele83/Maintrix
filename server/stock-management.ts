import { stockMovements, spareParts, type StockMovement, type InsertStockMovement } from "@shared/schema";
import { db } from "./db.js";
import { eq, desc, sql } from "drizzle-orm";

export class StockManager {
  
  /**
   * Enregistre un mouvement de stock et met à jour les quantités
   */
  async recordStockMovement(movement: Omit<InsertStockMovement, 'previousStock' | 'newStock'>): Promise<StockMovement> {
    // Récupérer le stock actuel
    const [sparePart] = await db
      .select()
      .from(spareParts)
      .where(eq(spareParts.id, movement.sparePartId));

    if (!sparePart) {
      throw new Error(`Pièce détachée avec l'ID ${movement.sparePartId} non trouvée`);
    }

    const previousStock = sparePart.currentStock || 0;
    let newStock: number;

    // Calculer le nouveau stock selon le type de mouvement
    switch (movement.movementType) {
      case 'IN':
        newStock = previousStock + movement.quantity;
        break;
      case 'OUT':
        newStock = previousStock - movement.quantity;
        if (newStock < 0) {
          throw new Error(`Stock insuffisant. Stock actuel: ${previousStock}, Quantité demandée: ${movement.quantity}`);
        }
        break;
      case 'ADJUSTMENT':
        newStock = movement.quantity; // Adjustment sets absolute value
        break;
      case 'RETURN':
        newStock = previousStock + movement.quantity;
        break;
      default:
        throw new Error(`Type de mouvement invalide: ${movement.movementType}`);
    }

    // Calculer les coûts si non fournis
    const unitCost = movement.unitCost || sparePart.unitPrice?.toString() || '0';
    const totalCost = movement.totalCost || (parseFloat(unitCost.toString()) * movement.quantity).toString();

    // Enregistrer le mouvement de stock
    const [stockMovement] = await db
      .insert(stockMovements)
      .values({
        ...movement,
        previousStock,
        newStock,
        unitCost,
        totalCost,
      })
      .returning();

    // Mettre à jour le stock de la pièce
    await db
      .update(spareParts)
      .set({ 
        currentStock: newStock,
        updatedAt: new Date()
      })
      .where(eq(spareParts.id, movement.sparePartId));

    return stockMovement;
  }

  /**
   * Sortie de stock pour maintenance/réparation
   */
  async outboundForMaintenance(
    sparePartId: number,
    quantity: number,
    workOrderId?: number,
    equipmentId?: number,
    performedBy?: number,
    notes?: string
  ): Promise<StockMovement> {
    return this.recordStockMovement({
      sparePartId,
      movementType: 'OUT',
      quantity,
      reason: 'MAINTENANCE',
      workOrderId,
      equipmentId,
      performedBy,
      notes,
      reference: workOrderId ? `OT-${workOrderId}` : undefined,
    });
  }

  /**
   * Retour de stock (pièce non utilisée)
   */
  async returnToStock(
    sparePartId: number,
    quantity: number,
    workOrderId?: number,
    performedBy?: number,
    notes?: string
  ): Promise<StockMovement> {
    return this.recordStockMovement({
      sparePartId,
      movementType: 'RETURN',
      quantity,
      reason: 'RETURN',
      workOrderId,
      performedBy,
      notes: notes || 'Retour de pièce non utilisée',
      reference: workOrderId ? `OT-${workOrderId}-RET` : undefined,
    });
  }

  /**
   * Entrée de stock (nouveau stock, commande reçue)
   */
  async inboundStock(
    sparePartId: number,
    quantity: number,
    reason: 'PURCHASE' | 'INVENTORY' | 'ADJUSTMENT',
    reference?: string,
    performedBy?: number,
    unitCost?: string,
    notes?: string
  ): Promise<StockMovement> {
    return this.recordStockMovement({
      sparePartId,
      movementType: 'IN',
      quantity,
      reason,
      reference,
      performedBy,
      unitCost,
      notes,
    });
  }

  /**
   * Ajustement de stock (inventaire)
   */
  async adjustStock(
    sparePartId: number,
    newQuantity: number,
    performedBy?: number,
    notes?: string
  ): Promise<StockMovement> {
    return this.recordStockMovement({
      sparePartId,
      movementType: 'ADJUSTMENT',
      quantity: newQuantity,
      reason: 'INVENTORY',
      performedBy,
      notes: notes || 'Ajustement d\'inventaire',
      reference: `INV-${Date.now()}`,
    });
  }

  /**
   * Obtenir l'historique des mouvements pour une pièce
   */
  async getMovementHistory(sparePartId: number): Promise<StockMovement[]> {
    return db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.sparePartId, sparePartId))
      .orderBy(desc(stockMovements.createdAt));
  }

  /**
   * Vérifier si une pièce a un stock suffisant
   */
  async checkStockAvailability(sparePartId: number, requiredQuantity: number): Promise<{
    available: boolean;
    currentStock: number;
    shortage: number;
  }> {
    const [sparePart] = await db
      .select()
      .from(spareParts)
      .where(eq(spareParts.id, sparePartId));

    if (!sparePart) {
      throw new Error(`Pièce détachée avec l'ID ${sparePartId} non trouvée`);
    }

    const currentStock = sparePart.currentStock || 0;
    const available = currentStock >= requiredQuantity;
    const shortage = available ? 0 : requiredQuantity - currentStock;

    return {
      available,
      currentStock,
      shortage,
    };
  }

  /**
   * Réserver du stock pour un ordre de travail
   */
  async reserveStock(
    sparePartId: number,
    quantity: number,
    workOrderId: number,
    performedBy?: number
  ): Promise<StockMovement> {
    // Vérifier la disponibilité
    const availability = await this.checkStockAvailability(sparePartId, quantity);
    
    if (!availability.available) {
      throw new Error(`Stock insuffisant. Disponible: ${availability.currentStock}, Demandé: ${quantity}`);
    }

    return this.recordStockMovement({
      sparePartId,
      movementType: 'OUT',
      quantity,
      reason: 'WORK_ORDER',
      workOrderId,
      performedBy,
      notes: `Réservation pour OT-${workOrderId}`,
      reference: `OT-${workOrderId}-RES`,
    });
  }
  /**
   * Sortie automatique de stock lors de la création d'un ordre de travail
   */
  async autoStockDeductionForWorkOrder(
    workOrderId: number, 
    partsRequired: { sparePartId: number, quantity: number }[]
  ): Promise<{ success: boolean, shortages: any[] }> {
    const shortages = [];
    
    for (const part of partsRequired) {
      try {
        // Vérifier la disponibilité
        const availability = await this.checkStockAvailability(part.sparePartId, part.quantity);
        
        if (!availability.available) {
          shortages.push({
            sparePartId: part.sparePartId,
            required: part.quantity,
            available: availability.currentStock,
            shortage: availability.shortage
          });
          continue;
        }

        // Effectuer la sortie automatique
        await this.recordStockMovement({
          sparePartId: part.sparePartId,
          movementType: 'OUT',
          quantity: part.quantity,
          reason: 'WORK_ORDER',
          workOrderId: workOrderId,
          reference: `AUTO-OT-${workOrderId}`,
          notes: `Sortie automatique pour ordre de travail ${workOrderId}`,
        });

      } catch (error: any) {
        console.error(`Erreur lors de la sortie automatique pour la pièce ${part.sparePartId}:`, error);
        shortages.push({
          sparePartId: part.sparePartId,
          error: error.message
        });
      }
    }

    return {
      success: shortages.length === 0,
      shortages
    };
  }

  /**
   * Retour automatique de stock après ordre de travail
   */
  async autoStockReturnAfterWorkOrder(
    workOrderId: number, 
    partsReturned: { sparePartId: number, quantity: number, condition: string }[]
  ): Promise<void> {
    for (const part of partsReturned) {
      try {
        const movementType = part.condition === 'good' ? 'RETURN' : 'OUT';
        const reason = part.condition === 'good' ? 'RETURN' : 'DAMAGED';
        
        await this.recordStockMovement({
          sparePartId: part.sparePartId,
          movementType: movementType,
          quantity: part.quantity,
          reason: reason,
          workOrderId: workOrderId,
          reference: `AUTO-RETURN-OT-${workOrderId}`,
          notes: `Retour automatique après ordre de travail ${workOrderId} - État: ${part.condition}`,
        });

      } catch (error) {
        console.error(`Erreur lors du retour automatique pour la pièce ${part.sparePartId}:`, error);
      }
    }
  }

  /**
   * Génération d'alertes de stock bas avec recommandations de commande
   */
  async generateLowStockAlerts(): Promise<{ alerts: any[], recommendations: any[] }> {
    try {
      const lowStockParts = await db
        .select()
        .from(spareParts)
        .where(sql`${spareParts.currentStock} <= ${spareParts.minStock}`);

      const alerts = lowStockParts.map(part => ({
        id: part.id,
        partNumber: part.partNumber,
        partName: part.partName,
        currentStock: part.currentStock,
        minStock: part.minStock,
        alertLevel: part.currentStock === 0 ? 'CRITICAL' : 'WARNING',
        message: part.currentStock === 0 
          ? `Stock épuisé pour ${part.partName} (${part.partNumber})`
          : `Stock bas pour ${part.partName} (${part.partNumber}): ${part.currentStock}/${part.minStock}`
      }));

      const recommendations = lowStockParts.map(part => ({
        sparePartId: part.id,
        partNumber: part.partNumber,
        partName: part.partName,
        currentStock: part.currentStock,
        minStock: part.minStock,
        recommendedOrder: Math.max((part.maxStock ?? 0) - (part.currentStock ?? 0), (part.minStock ?? 0) * 2),
        supplier: part.supplier,
        estimatedCost: (Math.max((part.maxStock ?? 0) - (part.currentStock ?? 0), (part.minStock ?? 0) * 2) * parseFloat(part.unitPrice ?? "0")).toFixed(2)
      }));

      return { alerts, recommendations };
    } catch (error) {
      console.error('Erreur lors de la génération des alertes de stock:', error);
      return { alerts: [], recommendations: [] };
    }
  }
}

// Instance singleton
export const stockManager = new StockManager();