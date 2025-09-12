import { db } from "./db";
import { tenants, licenseTypes, licenseHistory, userProfiles } from "@shared/schema";
import { eq, count } from "drizzle-orm";
import { randomBytes } from "crypto";

// 📜 LICENCE SYSTEM: Automatic licensing based on user count
export interface LicenseInfo {
  type: string;
  displayName: string;
  description: string;
  minUsers: number;
  maxUsers: number | null;
  licensedUsers: number;
}

export class LicenseService {
  
  // 🎯 DÉFINITION DES PALIERS DE LICENCES
  private static readonly LICENSE_TIERS = [
    {
      name: "solo",
      displayName: "Licence Solo",
      description: "Parfaite pour un utilisateur unique",
      minUsers: 1,
      maxUsers: 1,
      monthlyPrice: 29.99,
      yearlyPrice: 299.99,
      features: { basicSupport: true, standardFeatures: true }
    },
    {
      name: "team",
      displayName: "Licence Équipe",
      description: "Idéale pour les petites équipes (2-5 utilisateurs)",
      minUsers: 2,
      maxUsers: 5,
      monthlyPrice: 89.99,
      yearlyPrice: 899.99,
      features: { basicSupport: true, standardFeatures: true, teamCollaboration: true }
    },
    {
      name: "enterprise_s",
      displayName: "Licence Entreprise S",
      description: "Pour les équipes moyennes (6-11 utilisateurs)",
      minUsers: 6,
      maxUsers: 11,
      monthlyPrice: 189.99,
      yearlyPrice: 1899.99,
      features: { 
        basicSupport: true, 
        standardFeatures: true, 
        teamCollaboration: true, 
        advancedReporting: true,
        prioritySupport: true 
      }
    },
    {
      name: "enterprise_m",
      displayName: "Licence Entreprise M",
      description: "Pour les entreprises moyennes (12-20 utilisateurs)",
      minUsers: 12,
      maxUsers: 20,
      monthlyPrice: 349.99,
      yearlyPrice: 3499.99,
      features: { 
        basicSupport: true, 
        standardFeatures: true, 
        teamCollaboration: true, 
        advancedReporting: true,
        prioritySupport: true,
        customIntegrations: true 
      }
    },
    {
      name: "enterprise_l",
      displayName: "Licence Entreprise L",
      description: "Pour les grandes entreprises (21+ utilisateurs)",
      minUsers: 21,
      maxUsers: null, // Illimité
      monthlyPrice: 599.99,
      yearlyPrice: 5999.99,
      features: { 
        basicSupport: true, 
        standardFeatures: true, 
        teamCollaboration: true, 
        advancedReporting: true,
        prioritySupport: true,
        customIntegrations: true,
        dedicatedSupport: true,
        whiteLabeling: true 
      }
    }
  ];

  // 🚀 INITIALISER LES TYPES DE LICENCES (à exécuter au démarrage)
  static async initializeLicenseTypes(): Promise<void> {
    try {
      console.log("🔄 Initializing license types...");
      
      for (const licenseData of this.LICENSE_TIERS) {
        // Vérifier si le type existe déjà
        const existingLicense = await db
          .select()
          .from(licenseTypes)
          .where(eq(licenseTypes.name, licenseData.name))
          .limit(1);

        if (existingLicense.length === 0) {
          await db.insert(licenseTypes).values({
            name: licenseData.name,
            displayName: licenseData.displayName,
            description: licenseData.description,
            minUsers: licenseData.minUsers,
            maxUsers: licenseData.maxUsers,
            monthlyPrice: licenseData.monthlyPrice.toString(),
            yearlyPrice: licenseData.yearlyPrice.toString(),
            features: licenseData.features,
          });
          console.log(`✅ Created license type: ${licenseData.displayName}`);
        }
      }
      
      console.log("✅ License types initialization completed");
    } catch (error) {
      console.error("❌ Error initializing license types:", error);
    }
  }

  // 🎯 DÉTERMINER LA LICENCE APPROPRIÉE SELON LE NOMBRE D'UTILISATEURS
  static determineLicenseType(userCount: number): LicenseInfo {
    for (const tier of this.LICENSE_TIERS) {
      if (userCount >= tier.minUsers && (tier.maxUsers === null || userCount <= tier.maxUsers)) {
        return {
          type: tier.name,
          displayName: tier.displayName,
          description: tier.description,
          minUsers: tier.minUsers,
          maxUsers: tier.maxUsers,
          licensedUsers: tier.maxUsers || userCount, // Si illimité, utiliser le count actuel
        };
      }
    }
    
    // Par défaut, retourner la licence solo
    return {
      type: "solo",
      displayName: "Licence Solo",
      description: "Parfaite pour un utilisateur unique",
      minUsers: 1,
      maxUsers: 1,
      licensedUsers: 1,
    };
  }

  // 🔄 METTRE À JOUR LA LICENCE D'UN TENANT
  static async updateTenantLicense(
    tenantId: string, 
    reason: "user_added" | "user_removed" | "manual_upgrade" | "tenant_created",
    changedBy?: number
  ): Promise<void> {
    try {
      // 1. Compter les utilisateurs actifs du tenant
      const userCountResult = await db
        .select({ count: count() })
        .from(userProfiles)
        .where(eq(userProfiles.tenantId, tenantId));
      
      const currentUserCount = userCountResult[0]?.count || 0;

      // 2. Récupérer les informations actuelles du tenant
      const currentTenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (currentTenant.length === 0) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      const tenant = currentTenant[0];

      // 3. Déterminer la nouvelle licence
      const newLicense = this.determineLicenseType(currentUserCount);

      // 4. Vérifier le type de licence et agir en conséquence
      if (tenant.licenseType === "custom") {
        // 🚨 LICENCE PERSONNALISÉE : Ne pas changer automatiquement, juste mettre à jour le count
        await db
          .update(tenants)
          .set({
            currentUsers: currentUserCount,
          })
          .where(eq(tenants.id, tenantId));
        
        console.log(`✅ Updated custom license tenant ${tenantId} user count to ${currentUserCount} (max: ${tenant.maxUsers})`);
      } else {
        // 5. Pour les licences automatiques, vérifier si une mise à jour est nécessaire
        if (tenant.licenseType !== newLicense.type) {
          // 6. Générer une nouvelle clé de licence
          const newLicenseKey = this.generateLicenseKey(tenantId, newLicense.licensedUsers);

          // 7. Enregistrer l'historique des licences
          await db.insert(licenseHistory).values({
            tenantId: tenantId,
            previousLicenseType: tenant.licenseType,
            newLicenseType: newLicense.type,
            userCountAtChange: currentUserCount,
            reason: reason,
            changedBy: changedBy || null,
            automaticUpdate: changedBy === undefined,
          });

          // 8. Mettre à jour le tenant avec la nouvelle licence
          await db
            .update(tenants)
            .set({
              licenseType: newLicense.type,
              licensedUsers: newLicense.licensedUsers,
              currentUsers: currentUserCount,
              maxUsers: newLicense.maxUsers || 999999, // Très grand nombre pour illimité
              licenseKey: newLicenseKey,
              licenseUpdatedAt: new Date(),
            })
            .where(eq(tenants.id, tenantId));

          console.log(`✅ Updated tenant ${tenantId} license from ${tenant.licenseType} to ${newLicense.type} (${currentUserCount} users)`);
        } else {
          // Juste mettre à jour le nombre d'utilisateurs actuels
          await db
            .update(tenants)
            .set({
              currentUsers: currentUserCount,
            })
            .where(eq(tenants.id, tenantId));
        }
      }

    } catch (error) {
      console.error(`❌ Error updating tenant license for ${tenantId}:`, error);
      throw error;
    }
  }

  // 🔑 GÉNÉRER UNE CLÉ DE LICENCE UNIQUE (Format: SM + 13 chiffres)
  static generateLicenseKey(tenantId: string, maxUsers: number): string {
    // Génération d'un nombre à 13 chiffres basé sur tenant et nombre d'utilisateurs
    const usersPadded = maxUsers.toString().padStart(4, '0');
    const tenantHash = parseInt(tenantId.slice(-8), 16) % 1000000; // 6 chiffres du tenant
    const tenantPadded = tenantHash.toString().padStart(6, '0');
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    // Format: SM + 4 chiffres (maxUsers) + 6 chiffres (tenant) + 3 chiffres (random)
    return `SM${usersPadded}${tenantPadded}${randomSuffix}`;
  }

  // 📊 RÉCUPÉRER LES INFORMATIONS DE LICENCE D'UN TENANT
  static async getTenantLicenseInfo(tenantId: string): Promise<LicenseInfo | null> {
    try {
      const tenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (tenant.length === 0) return null;

      const tenantData = tenant[0];
      const userCount = tenantData.currentUsers || 0;

      return {
        type: tenantData.licenseType || "solo",
        displayName: this.LICENSE_TIERS.find(t => t.name === tenantData.licenseType)?.displayName || "Licence Solo",
        description: this.LICENSE_TIERS.find(t => t.name === tenantData.licenseType)?.description || "",
        minUsers: this.LICENSE_TIERS.find(t => t.name === tenantData.licenseType)?.minUsers || 1,
        maxUsers: this.LICENSE_TIERS.find(t => t.name === tenantData.licenseType)?.maxUsers || 1,
        licensedUsers: tenantData.licensedUsers || 1,
      };
    } catch (error) {
      console.error(`❌ Error getting tenant license info for ${tenantId}:`, error);
      return null;
    }
  }

  /**
   * Vérifier si un tenant peut ajouter un nouvel utilisateur
   * @param tenantId - ID du tenant
   * @returns Promise<void> - Lève une erreur si la limite est atteinte
   */
  static async enforceUserLimit(tenantId: string): Promise<void> {
    try {
      // Récupérer les informations du tenant
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) {
        const error = new Error("Tenant introuvable");
        (error as any).code = "TENANT_NOT_FOUND";
        throw error;
      }

      // Compter les utilisateurs actuels
      const [userCount] = await db
        .select({ count: count() })
        .from(userProfiles)
        .where(eq(userProfiles.tenantId, tenantId));

      const currentUsers = userCount.count || 0;
      const maxUsers = tenant.maxUsers || tenant.licensedUsers || 1;

      if (currentUsers >= maxUsers) {
        const error = new Error("Nombre d'utilisateurs atteint pour votre licence");
        (error as any).code = "USER_LIMIT_REACHED";
        (error as any).details = {
          currentUsers,
          maxUsers,
          licenseType: tenant.licenseType
        };
        throw error;
      }

      console.log(`✅ User limit check passed for tenant ${tenantId}: ${currentUsers}/${maxUsers} users`);
    } catch (error) {
      console.error(`❌ User limit check failed for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  // 📈 RÉCUPÉRER L'HISTORIQUE DES LICENCES D'UN TENANT
  static async getTenantLicenseHistory(tenantId: string): Promise<any[]> {
    try {
      return await db
        .select()
        .from(licenseHistory)
        .where(eq(licenseHistory.tenantId, tenantId))
        .orderBy(licenseHistory.createdAt);
    } catch (error) {
      console.error(`❌ Error getting tenant license history for ${tenantId}:`, error);
      return [];
    }
  }

  // 🎯 INITIALISER LA LICENCE LORS DE LA CRÉATION D'UN TENANT avec nombre d'utilisateurs personnalisé
  static async initializeTenantLicense(tenantId: string, maxUsers: number, initialUserCount: number = 1): Promise<void> {
    // Utiliser le nombre max défini par l'admin au lieu de déterminer automatiquement
    const licenseKey = this.generateLicenseKey(tenantId, maxUsers);

    await db
      .update(tenants)
      .set({
        licenseType: "custom", // Licence personnalisée basée sur le nombre défini
        licensedUsers: maxUsers,
        currentUsers: initialUserCount,
        maxUsers: maxUsers,
        licenseKey: licenseKey,
        licenseGeneratedAt: new Date(),
        licenseUpdatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    // Enregistrer dans l'historique
    await db.insert(licenseHistory).values({
      tenantId: tenantId,
      previousLicenseType: null,
      newLicenseType: "custom",
      userCountAtChange: initialUserCount,
      reason: "tenant_created",
      changedBy: null,
      automaticUpdate: true,
    });

    console.log(`✅ Initialized custom license for tenant ${tenantId}: ${maxUsers} users max (${initialUserCount} initial)`);
  }
}