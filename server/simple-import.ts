import fs from 'fs';
import path from 'path';
import { db } from './db';
import { maintenanceCases } from '../shared/schema';

export async function importSampleData(): Promise<{ maintenanceCases: number }> {
  console.log('🔄 Importing sample industrial maintenance cases...');

  // Sample industrial maintenance cases based on common industrial scenarios
  const sampleCases = [
    {
      equipmentType: 'moteur',
      symptoms: 'Vibrations anormales et échauffement du palier arrière',
      diagnosis: 'Défaillance roulement palier arrière',
      solution: 'Remplacement du roulement, vérification alignement et lubrification',
      duration: 180,
      urgency: 'high',
      confidence: 0.88,
      zone: 'production',
      sector: 'mécanique'
    },
    {
      equipmentType: 'pompe',
      symptoms: 'Perte de pression et bruit anormal à l\'aspiration',
      diagnosis: 'Problème d\'amorçage et usure de la roue',
      solution: 'Vérifier circuit aspiration, remplacer roue et joints d\'étanchéité',
      duration: 240,
      urgency: 'medium',
      confidence: 0.85,
      zone: 'production',
      sector: 'hydraulique'
    },
    {
      equipmentType: 'compresseur',
      symptoms: 'Température élevée et chute de pression',
      diagnosis: 'Encrassement échangeur et fuite interne',
      solution: 'Nettoyage échangeur, remplacement segments et valves',
      duration: 360,
      urgency: 'high',
      confidence: 0.82,
      zone: 'production',
      sector: 'pneumatique'
    },
    {
      equipmentType: 'moteur électrique',
      symptoms: 'Échauffement anormal et consommation élevée',
      diagnosis: 'Défaut d\'isolement bobinage stator',
      solution: 'Rebobinage stator, vérification systène de refroidissement',
      duration: 480,
      urgency: 'high',
      confidence: 0.90,
      zone: 'production',
      sector: 'électrique'
    },
    {
      equipmentType: 'réducteur',
      symptoms: 'Bruit et vibrations dans la transmission',
      diagnosis: 'Usure dentures et roulements',
      solution: 'Remplacement pignons et roulements, ajustement jeux',
      duration: 420,
      urgency: 'medium',
      confidence: 0.87,
      zone: 'production',
      sector: 'mécanique'
    },
    {
      equipmentType: 'variateur',
      symptoms: 'Défaut IGBT et surchauffe module puissance',
      diagnosis: 'Défaillance module IGBT',
      solution: 'Remplacement modules IGBT, vérification refroidissement et drivers',
      duration: 300,
      urgency: 'high',
      confidence: 0.92,
      zone: 'production',
      sector: 'électrique'
    },
    {
      equipmentType: 'pompe centrifuge',
      symptoms: 'Cavitation et performance réduite',
      diagnosis: 'NPSH insuffisant et usure roue',
      solution: 'Modification circuit aspiration, remplacement roue et diffuseur',
      duration: 200,
      urgency: 'medium',
      confidence: 0.86,
      zone: 'production',
      sector: 'hydraulique'
    },
    {
      equipmentType: 'convoyeur',
      symptoms: 'Patinage courroie et arrêts intempestifs',
      diagnosis: 'Tension courroie incorrecte et usure poulies',
      solution: 'Réglage tension, remplacement courroie et poulies usées',
      duration: 150,
      urgency: 'low',
      confidence: 0.80,
      zone: 'manutention',
      sector: 'mécanique'
    },
    {
      equipmentType: 'compresseur à vis',
      symptoms: 'Fuite d\'huile et température élevée',
      diagnosis: 'Usure joints et problème refroidissement',
      solution: 'Remplacement joints rotors, nettoyage circuit huile et refroidissement',
      duration: 400,
      urgency: 'medium',
      confidence: 0.84,
      zone: 'production',
      sector: 'pneumatique'
    },
    {
      equipmentType: 'ventilateur industriel',
      symptoms: 'Vibrations importantes et bruit anormal',
      diagnosis: 'Déséquilibre roue et usure paliers',
      solution: 'Équilibrage roue, remplacement paliers et vérification fixations',
      duration: 180,
      urgency: 'medium',
      confidence: 0.83,
      zone: 'ventilation',
      sector: 'mécanique'
    },
    {
      equipmentType: 'automate programmable',
      symptoms: 'Défauts entrées/sorties et communication instable',
      diagnosis: 'Problème cartes E/S et parasitage',
      solution: 'Remplacement cartes défaillantes, amélioration blindage et terre',
      duration: 240,
      urgency: 'high',
      confidence: 0.89,
      zone: 'automatisme',
      sector: 'électrique'
    },
    {
      equipmentType: 'transformateur',
      symptoms: 'Échauffement anormal et bruit magnétique',
      diagnosis: 'Problème isolation et circuit magnétique',
      solution: 'Vérification isolation, resserrage boulonnage circuit magnétique',
      duration: 360,
      urgency: 'high',
      confidence: 0.91,
      zone: 'distribution',
      sector: 'électrique'
    },
    {
      equipmentType: 'pompe doseuse',
      symptoms: 'Débit irrégulier et fuite au presse-étoupe',
      diagnosis: 'Usure membrane et joint presse-étoupe',
      solution: 'Remplacement membrane, joint presse-étoupe et étalonnage',
      duration: 120,
      urgency: 'medium',
      confidence: 0.85,
      zone: 'traitement',
      sector: 'chimique'
    },
    {
      equipmentType: 'agitateur',
      symptoms: 'Vibrations et usure accouplement',
      diagnosis: 'Désalignement arbre et usure accouplement',
      solution: 'Réalignement précis, remplacement accouplement et paliers',
      duration: 200,
      urgency: 'medium',
      confidence: 0.82,
      zone: 'process',
      sector: 'mécanique'
    },
    {
      equipmentType: 'groupe froid',
      symptoms: 'Performance dégradée et consommation élevée',
      diagnosis: 'Encrassement condenseur et fuite frigorigène',
      solution: 'Nettoyage condenseur, recherche fuites et recharge frigorigène',
      duration: 300,
      urgency: 'medium',
      confidence: 0.87,
      zone: 'climatisation',
      sector: 'frigorifique'
    }
  ];

  let imported = 0;
  
  for (const caseData of sampleCases) {
    try {
      await db.insert(maintenanceCases).values({
        ...caseData,
        equipmentId: null, // Will be linked when equipment is imported
        resolved: true
      });
      imported++;
    } catch (error) {
      console.warn('Warning: case might already exist:', error);
    }
  }

  console.log(`✅ Imported ${imported} maintenance cases successfully`);
  
  return { maintenanceCases: imported };
}