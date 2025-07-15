import { db } from "./db";
import { maintenanceCases, repairProcedures } from "@shared/schema";

async function seedDatabase() {
  console.log("🌱 Seeding database with industrial maintenance cases...");

  try {
    // Insert comprehensive maintenance cases
    const cases = await db.insert(maintenanceCases).values([
      {
        equipmentType: "moteur",
        equipmentId: "MOT-001",
        zone: "production",
        sector: "Ligne 1",
        symptoms: "Bruit anormal et vibrations importantes",
        symptomsChecked: ["bruit_anormal", "vibrations"],
        diagnosis: "Roulement défectueux",
        solution: "Remplacer le roulement côté libre, vérifier l'alignement",
        duration: 135,
        resolved: true,
        urgency: "medium",
        confidence: 0.92,
        createdAt: new Date("2024-01-15T14:30:00Z"),
      },
      {
        equipmentType: "pompe",
        equipmentId: "PUMP-A23",
        zone: "production",
        sector: "Hydraulique",
        symptoms: "Fuite hydraulique et pression faible",
        symptomsChecked: ["fuite", "performance_degradee"],
        diagnosis: "Joint d'étanchéité usé",
        solution: "Remplacer les joints d'étanchéité et vérifier la pression",
        duration: 105,
        resolved: true,
        urgency: "high",
        confidence: 0.89,
        createdAt: new Date("2024-01-14T09:15:00Z"),
      },
      {
        equipmentType: "convoyeur",
        equipmentId: "CONV-B12",
        zone: "conditionnement",
        sector: "Secteur B",
        symptoms: "Arrêt intempestif, capteur défaillant",
        symptomsChecked: ["panne_electrique"],
        diagnosis: "Capteur de position HS",
        solution: "Remplacer le capteur de position et recalibrer",
        duration: 45,
        resolved: true,
        urgency: "medium",
        confidence: 0.95,
        createdAt: new Date("2024-01-13T16:45:00Z"),
      },
      {
        equipmentType: "moteur",
        equipmentId: "MOT-005",
        zone: "production",
        sector: "Ligne 2",
        symptoms: "Surchauffe moteur, température élevée",
        symptomsChecked: ["surchauffe"],
        diagnosis: "Problème de ventilation",
        solution: "Nettoyer le système de refroidissement, remplacer le ventilateur",
        duration: 90,
        resolved: true,
        urgency: "high",
        confidence: 0.87,
        createdAt: new Date("2024-01-12T11:20:00Z"),
      },
      {
        equipmentType: "variateur",
        equipmentId: "VAR-001",
        zone: "production",
        sector: "Automatisme",
        symptoms: "Défaut F001 affichage, moteur ne démarre pas",
        symptomsChecked: ["panne_electrique"],
        diagnosis: "Erreur de paramétrage",
        solution: "Reprogrammer les paramètres par défaut, vérifier les connexions",
        duration: 60,
        resolved: true,
        urgency: "medium",
        confidence: 0.91,
        createdAt: new Date("2024-01-11T08:45:00Z"),
      },
      {
        equipmentType: "compresseur",
        equipmentId: "COMP-A1",
        zone: "utilites",
        sector: "Air comprimé",
        symptoms: "Pression instable, fuite d'air audible",
        symptomsChecked: ["fuite", "performance_degradee"],
        diagnosis: "Clapet anti-retour défaillant",
        solution: "Remplacer le clapet anti-retour, purger le circuit",
        duration: 120,
        resolved: true,
        urgency: "medium",
        confidence: 0.85,
        createdAt: new Date("2024-01-10T15:30:00Z"),
      },
      {
        equipmentType: "capteur",
        equipmentId: "TEMP-01",
        zone: "production",
        sector: "Four",
        symptoms: "Lecture de température incohérente",
        symptomsChecked: ["panne_electrique"],
        diagnosis: "Sonde de température défaillante",
        solution: "Remplacer la sonde PT100, étalonner le système",
        duration: 75,
        resolved: true,
        urgency: "high",
        confidence: 0.93,
        createdAt: new Date("2024-01-09T13:15:00Z"),
      },
      {
        equipmentType: "pompe",
        equipmentId: "PUMP-B15",
        zone: "stockage",
        sector: "Transfert",
        symptoms: "Débit réduit, bruit de cavitation",
        symptomsChecked: ["bruit_anormal", "performance_degradee"],
        diagnosis: "Amorçage déficient",
        solution: "Vérifier l'aspiration, purger l'air, contrôler le niveau",
        duration: 50,
        resolved: true,
        urgency: "medium",
        confidence: 0.88,
        createdAt: new Date("2024-01-08T10:00:00Z"),
      }
    ]).returning();

    console.log(`✅ Inserted ${cases.length} maintenance cases`);

    // Insert some repair procedures for the first case
    const procedures = await db.insert(repairProcedures).values([
      {
        caseId: cases[0].id,
        stepNumber: 1,
        title: "Arrêt et consignation",
        titleEn: "Stop and lock out",
        description: "Arrêter l'équipement et consigner",
        descriptionEn: "Stop equipment and lock out",
        safetyWarning: "Vérifier que l'équipement est complètement arrêté",
        safetyWarningEn: "Verify equipment is completely stopped",
        estimatedTime: 15,
        isCompleted: false,
      },
      {
        caseId: cases[0].id,
        stepNumber: 2,
        title: "Démontage protection",
        titleEn: "Remove protection cover",
        description: "Démonter le capot de protection",
        descriptionEn: "Remove protection cover",
        safetyWarning: "Porter des gants de protection",
        safetyWarningEn: "Wear protective gloves",
        estimatedTime: 20,
        isCompleted: false,
      },
      {
        caseId: cases[0].id,
        stepNumber: 3,
        title: "Remplacement roulement",
        titleEn: "Replace bearing",
        description: "Remplacer le roulement défectueux",
        descriptionEn: "Replace defective bearing",
        safetyWarning: "Utiliser les outils appropriés, éviter les chocs",
        safetyWarningEn: "Use proper tools, avoid impacts",
        estimatedTime: 60,
        isCompleted: false,
      },
      {
        caseId: cases[0].id,
        stepNumber: 4,
        title: "Vérification alignement",
        titleEn: "Check alignment",
        description: "Vérifier l'alignement",
        descriptionEn: "Check alignment",
        safetyWarning: "Contrôler avec un comparateur",
        safetyWarningEn: "Check with dial indicator",
        estimatedTime: 30,
        isCompleted: false,
      },
      {
        caseId: cases[0].id,
        stepNumber: 5,
        title: "Remontage et test",
        titleEn: "Reassemble and test",
        description: "Remonter et tester",
        descriptionEn: "Reassemble and test",
        safetyWarning: "Effectuer un test de fonctionnement",
        safetyWarningEn: "Perform functional test",
        estimatedTime: 20,
        isCompleted: false,
      }
    ]).returning();

    console.log(`✅ Inserted ${procedures.length} repair procedures`);
    console.log("🚀 Database seeded successfully!");

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

// Run the seed if this file is executed directly
async function main() {
  try {
    await seedDatabase();
    console.log("✅ Seeding completed successfully");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

main();

export { seedDatabase };