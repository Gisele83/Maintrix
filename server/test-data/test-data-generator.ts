/**
 * Générateur de données de test pour Smart GMAO DiagFix
 * Crée des données réalistes pour tester toutes les fonctionnalités
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { 
  userProfiles, equipmentRegistry, workOrders, preventiveMaintenancePlans, 
  spareParts, stockMovements, maintenanceCounters, alertsNotifications,
  diagnosticSessions, tenants, reorderRules
} from '../../shared/schema';
import bcrypt from 'bcrypt';

export interface TestDataOptions {
  clearExisting?: boolean;
  equipmentCount?: number;
  workOrderCount?: number;
  userCount?: number;
  sparePartsCount?: number;
}

export class TestDataGenerator {
  private static readonly DEFAULT_OPTIONS: Required<TestDataOptions> = {
    clearExisting: true,
    equipmentCount: 25,
    workOrderCount: 50,
    userCount: 10,
    sparePartsCount: 100,
  };

  /**
   * Génère un jeu de données de test complet
   */
  static async generateTestData(options: TestDataOptions = {}): Promise<void> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    console.log('🧪 Génération des données de test...');
    
    if (opts.clearExisting) {
      await this.clearExistingData();
    }

    // Génération séquentielle pour respecter les dépendances
    const tenantId = await this.createTestTenant();
    const userIds = await this.createTestUsers(opts.userCount, tenantId);
    const equipmentIds = await this.createTestEquipments(opts.equipmentCount, tenantId);
    const sparePartIds = await this.createTestSpareParts(opts.sparePartsCount, tenantId);
    await this.createTestWorkOrders(opts.workOrderCount, userIds, equipmentIds, tenantId);
    await this.createTestPreventiveMaintenance(equipmentIds, userIds, tenantId);
    await this.createTestCounters(equipmentIds, tenantId);
    await this.createTestAlerts(equipmentIds, tenantId);
    await this.createTestDiagnostics(equipmentIds, tenantId);
    await this.createTestStockMovements(sparePartIds, userIds, tenantId);

    console.log('✅ Données de test générées avec succès!');
    console.log(`   - ${opts.userCount} utilisateurs`);
    console.log(`   - ${opts.equipmentCount} équipements`);
    console.log(`   - ${opts.workOrderCount} ordres de travail`);
    console.log(`   - ${opts.sparePartsCount} pièces détachées`);
  }

  /**
   * Nettoie les données existantes
   */
  private static async clearExistingData(): Promise<void> {
    console.log('🧹 Nettoyage des données existantes...');
    
    try {
      // Utiliser SQL raw pour supprimer en cascade et éviter les contraintes FK
      console.log('  → Suppression des données de test existantes...');
      await db.execute(sql`DELETE FROM tenants WHERE name LIKE '%Test%' OR domain LIKE '%test%'`);
      
      console.log('  → Nettoyage terminé');
    } catch (error) {
      console.warn('  ⚠️ Certaines données peuvent déjà être supprimées:', error.message);
    }
  }

  /**
   * Crée un tenant de test
   */
  private static async createTestTenant(): Promise<string> {
    const [tenant] = await db.insert(tenants).values({
      name: 'Entreprise Test GMAO',
      domain: 'test.smartgmao.com',
      plan: 'enterprise',
      isActive: true,
      maxUsers: 100,
      features: { modules: ['equipment-management', 'work-orders', 'preventive-maintenance', 'inventory-simple'] },
      contactEmail: 'contact@test.smartgmao.com',
      contactPhone: '+33 1 23 45 67 89',
      billingAddress: { 
        street: '123 Rue de la Maintenance', 
        city: 'Paris', 
        postalCode: '75001', 
        country: 'France' 
      },
      settings: { 
        industry: 'Industrie manufacturière',
        companySize: '51-200 employés' 
      },
    }).returning({ id: tenants.id });

    return tenant.id;
  }

  /**
   * Crée des utilisateurs de test
   */
  private static async createTestUsers(count: number, tenantId: string): Promise<string[]> {
    console.log(`👥 Création de ${count} utilisateurs de test...`);
    
    const testUsers = [
      {
        username: 'admin_test',
        email: 'admin@test.smartgmao.com',
        fullName: 'Administrateur Test',
        role: 'admin' as const,
        department: 'IT',
      },
      {
        username: 'technicien_test',
        email: 'technicien@test.smartgmao.com',
        fullName: 'Jean Dupont',
        role: 'technician' as const,
        department: 'Maintenance',
      },
      {
        username: 'responsable_test',
        email: 'responsable@test.smartgmao.com',
        fullName: 'Marie Martin',
        role: 'supervisor' as const,
        department: 'Maintenance',
      },
    ];

    const userIds: string[] = [];
    const passwordHash = await bcrypt.hash('Test123!', 10);

    for (let i = 0; i < count; i++) {
      const userData = testUsers[i % testUsers.length];
      const userIndex = Math.floor(i / testUsers.length) + 1;
      
      const timestamp = Date.now();
      const [user] = await db.insert(userProfiles).values({
        tenantId,
        username: `${userData.username}_${timestamp}_${userIndex}`,
        email: userData.email.replace('@', `${timestamp}_${userIndex}@`),
        password: passwordHash,
        firstName: userData.fullName.split(' ')[0],
        lastName: userData.fullName.split(' ')[1] || '',
        role: userData.role,
        department: userData.department,
        isActive: true,
      }).returning({ id: userProfiles.id });

      userIds.push(user.id);
    }

    return userIds;
  }

  /**
   * Crée des équipements de test
   */
  private static async createTestEquipments(count: number, tenantId: string): Promise<string[]> {
    console.log(`🏭 Création de ${count} équipements de test...`);
    
    const equipmentTypes = [
      { type: 'Compresseur', brand: 'Atlas Copco', model: 'GA 22', location: 'Zone A' },
      { type: 'Pompe', brand: 'Grundfos', model: 'CR 15-3', location: 'Zone B' },
      { type: 'Moteur électrique', brand: 'Siemens', model: '1LA7 090', location: 'Zone C' },
      { type: 'Convoyeur', brand: 'Rexnord', model: 'FT 1000', location: 'Zone D' },
      { type: 'Variateur', brand: 'ABB', model: 'ACS550', location: 'Zone E' },
      { type: 'Transformateur', brand: 'Schneider', model: 'MINERA 630', location: 'Zone F' },
      { type: 'Groupe électrogène', brand: 'Caterpillar', model: 'C18 ACERT', location: 'Externe' },
      { type: 'Climatisation', brand: 'Daikin', model: 'VRV IV', location: 'Bureaux' },
    ];

    const equipmentIds: string[] = [];

    for (let i = 0; i < count; i++) {
      const equipment = equipmentTypes[i % equipmentTypes.length];
      const equipmentNumber = i + 1;
      
      const [created] = await db.insert(equipmentRegistry).values({
        tenantId,
        equipmentId: `EQ${Date.now()}_${equipmentNumber.toString().padStart(3, '0')}`,
        equipmentName: `${equipment.type} ${equipmentNumber.toString().padStart(3, '0')}`,
        equipmentType: equipment.type,
        manufacturer: equipment.brand,
        model: equipment.model,
        serialNumber: `SN${Date.now()}${equipmentNumber}`,
        location: equipment.location,
        installationDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000 * 3), // 0-3 ans
        warrantyExpiry: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000 * 2), // 0-2 ans
        operationalState: Math.random() > 0.1 ? 'operational' : 'maintenance',
        criticalityLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      }).returning({ id: equipmentRegistry.id });

      equipmentIds.push(created.id);
    }

    return equipmentIds;
  }

  /**
   * Crée des pièces détachées de test
   */
  private static async createTestSpareParts(count: number, tenantId: string): Promise<string[]> {
    console.log(`🔧 Création de ${count} pièces détachées de test...`);
    
    const partTypes = [
      { name: 'Filtre à air', category: 'Filtration', unit: 'pièce', minStock: 5, cost: 25.50 },
      { name: 'Courroie', category: 'Transmission', unit: 'mètre', minStock: 10, cost: 12.30 },
      { name: 'Roulement', category: 'Mécanique', unit: 'pièce', minStock: 8, cost: 45.80 },
      { name: 'Joint torique', category: 'Étanchéité', unit: 'lot', minStock: 20, cost: 8.90 },
      { name: 'Contacteur', category: 'Électrique', unit: 'pièce', minStock: 3, cost: 78.60 },
      { name: 'Fusible', category: 'Protection', unit: 'pièce', minStock: 50, cost: 2.15 },
      { name: 'Huile hydraulique', category: 'Fluide', unit: 'litre', minStock: 100, cost: 8.45 },
      { name: 'Graisse', category: 'Lubrification', unit: 'tube', minStock: 25, cost: 15.20 },
    ];

    const sparePartIds: string[] = [];

    for (let i = 0; i < count; i++) {
      const part = partTypes[i % partTypes.length];
      const partNumber = i + 1;
      
      const [created] = await db.insert(spareParts).values({
        tenantId,
        partNumber: `SP${Date.now()}_${partNumber.toString().padStart(4, '0')}`,
        partName: `${part.name} ${partNumber > partTypes.length ? Math.ceil(partNumber / partTypes.length) : ''}`.trim(),
        description: `Pièce détachée pour maintenance - ${part.name}`,
        category: part.category,
        unitPrice: (part.cost + (Math.random() - 0.5) * part.cost * 0.3).toString(), // ±30% de variation
        currentStock: Math.floor(Math.random() * part.minStock * 3),
        minStock: part.minStock,
        supplier: ['Fournisseur A', 'Fournisseur B', 'Fournisseur C'][Math.floor(Math.random() * 3)],
      }).returning({ id: spareParts.id });

      sparePartIds.push(created.id);
    }

    return sparePartIds;
  }

  /**
   * Crée des ordres de travail de test
   */
  private static async createTestWorkOrders(
    count: number,
    userIds: string[],
    equipmentIds: string[],
    tenantId: string
  ): Promise<void> {
    console.log(`📋 Création de ${count} ordres de travail de test...`);
    
    const workOrderTypes = [
      { type: 'maintenance', title: 'Maintenance préventive', priority: 'medium' },
      { type: 'repair', title: 'Réparation urgente', priority: 'high' },
      { type: 'inspection', title: 'Inspection réglementaire', priority: 'low' },
      { type: 'upgrade', title: 'Mise à niveau', priority: 'medium' },
    ];

    for (let i = 0; i < count; i++) {
      const workOrder = workOrderTypes[i % workOrderTypes.length];
      const equipmentId = equipmentIds[Math.floor(Math.random() * equipmentIds.length)];
      const assignedTo = userIds[Math.floor(Math.random() * userIds.length)];
      const createdBy = userIds[Math.floor(Math.random() * userIds.length)];
      
      await db.insert(workOrders).values({
        tenantId,
        orderNumber: `WO${Date.now()}${i}`,
        title: `${workOrder.title} - Équipement ${i + 1}`,
        description: `Description détaillée de l'ordre de travail ${i + 1}`,
        equipmentId,
        orderType: workOrder.type,
        priority: workOrder.priority,
        orderStatus: ['open', 'in_progress', 'completed'][Math.floor(Math.random() * 3)],
        assignedTo,
        requestedBy: createdBy,
        scheduledStartDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000), // 0-30 jours
        estimatedDuration: Math.floor(Math.random() * 8) + 1, // 1-8 heures
      });
    }
  }

  /**
   * Crée des plans de maintenance préventive
   */
  private static async createTestPreventiveMaintenance(
    equipmentIds: string[],
    userIds: string[],
    tenantId: string
  ): Promise<void> {
    console.log('🔄 Création des plans de maintenance préventive...');
    
    for (let i = 0; i < Math.min(10, equipmentIds.length); i++) {
      await db.insert(preventiveMaintenancePlans).values({
        tenantId,
        planName: `Plan maintenance ${i + 1}`,
        equipmentType: ['Compresseur', 'Pompe', 'Moteur électrique', 'Convoyeur'][i % 4],
        equipmentIds: [equipmentIds[i]],
        frequency: ['daily', 'weekly', 'monthly', 'quarterly'][Math.floor(Math.random() * 4)],
        nextDue: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
        estimatedDuration: Math.floor(Math.random() * 4) + 1,
        isActive: true,
      });
    }
  }

  /**
   * Crée des compteurs de maintenance
   */
  private static async createTestCounters(equipmentIds: string[], tenantId: string): Promise<void> {
    console.log('⏱️ Création des compteurs de maintenance...');
    
    for (let i = 0; i < Math.min(15, equipmentIds.length); i++) {
      await db.insert(maintenanceCounters).values({
        tenantId,
        equipmentId: equipmentIds[i],
        counterName: `Compteur ${i + 1}`,
        counterType: ['hours', 'cycles', 'kilometers'][Math.floor(Math.random() * 3)],
        currentValue: Math.floor(Math.random() * 1000),
        thresholdWarning: 800 + Math.floor(Math.random() * 200),
        thresholdCritical: 950 + Math.floor(Math.random() * 50),
        lastResetValue: 0,
        lastResetDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        isActive: true,
      });
    }
  }

  /**
   * Crée des alertes de test
   */
  private static async createTestAlerts(equipmentIds: string[], tenantId: string): Promise<void> {
    console.log('🚨 Création des alertes de test...');
    
    const alertTypes = [
      { type: 'maintenance_due', level: 'warning', message: 'Maintenance préventive programmée' },
      { type: 'equipment_failure', level: 'critical', message: 'Panne équipement détectée' },
      { type: 'threshold_exceeded', level: 'warning', message: 'Seuil de compteur atteint' },
    ];

    for (let i = 0; i < 20; i++) {
      const alert = alertTypes[i % alertTypes.length];
      const equipmentId = equipmentIds[Math.floor(Math.random() * equipmentIds.length)];
      
      await db.insert(alertsNotifications).values({
        tenantId,
        type: 'alert',
        title: alert.message,
        message: `${alert.message} pour équipement`,
        severity: alert.level,
        category: alert.type,
        equipmentId,
        isRead: Math.random() > 0.3,
        isResolved: Math.random() > 0.7,
      });
    }
  }

  /**
   * Crée des diagnostics de test
   */
  private static async createTestDiagnostics(equipmentIds: string[], tenantId: string): Promise<void> {
    console.log('🔍 Création des diagnostics de test...');
    
    for (let i = 0; i < 15; i++) {
      await db.insert(diagnosticSessions).values({
        tenantId,
        equipmentId: equipmentIds[Math.floor(Math.random() * equipmentIds.length)],
        sessionType: 'automatic',
        symptoms: `Symptômes observés pour diagnostic ${i + 1}`,
        diagnosis: `Diagnostic établi ${i + 1}`,
        recommendations: `Recommandations d'intervention ${i + 1}`,
        confidence: 0.7 + Math.random() * 0.3, // 70-100%
        sessionStatus: 'completed',
      });
    }
  }

  /**
   * Crée des mouvements de stock de test
   */
  private static async createTestStockMovements(
    sparePartIds: string[],
    userIds: string[],
    tenantId: string
  ): Promise<void> {
    console.log('📦 Création des mouvements de stock...');
    
    for (let i = 0; i < 50; i++) {
      const sparePartId = sparePartIds[Math.floor(Math.random() * sparePartIds.length)];
      const quantity = Math.floor(Math.random() * 10) + 1;
      const isIn = Math.random() > 0.5;
      await db.insert(stockMovements).values({
        tenantId,
        sparePartId: sparePartId,
        movementType: isIn ? 'IN' : 'OUT',
        quantity: quantity,
        previousStock: Math.floor(Math.random() * 50),
        newStock: Math.floor(Math.random() * 50) + quantity * (isIn ? 1 : -1),
        reason: ['PURCHASE', 'MAINTENANCE', 'RETURN'][Math.floor(Math.random() * 3)],
        reference: `MOV${Date.now()}${i}`,
        performedBy: userIds[Math.floor(Math.random() * userIds.length)],
        unitCost: (10 + Math.random() * 100).toString(),
        totalCost: ((10 + Math.random() * 100) * quantity).toString(),
      });
    }
  }
}

// Script d'exécution directe (ES modules)
if (import.meta.url === `file://${process.argv[1]}`) {
  TestDataGenerator.generateTestData({
    clearExisting: true,
    equipmentCount: 25,
    workOrderCount: 50,
    userCount: 8,
    sparePartsCount: 80,
  }).catch(console.error);
}