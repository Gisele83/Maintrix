import { db } from './db';
import { failureMemory, maintenanceCases } from '../shared/schema';
import { eq, and, like, desc, sql, gte } from 'drizzle-orm';

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  diagnosis: string;
  solution: string;
  confidence: number;
  matchedConditions: string[];
  explanation: string;
  priority: number;
  repairSteps?: string[];
  safetyWarnings?: string[];
  tools?: string[];
  estimatedTime?: number;
}

export interface ExplanationFactor {
  type: 'rule_match' | 'historical_cases' | 'failure_memory' | 'context_signal' | 'recurrence' | 'criticality' | 'recent_intervention';
  label: string;
  detail: string;
  impact: 'high' | 'medium' | 'low';
}

interface DiagnosticRule {
  id: string;
  name: string;
  equipmentPatterns: string[];
  symptomPatterns: string[];
  conditionLogic: 'all' | 'any';
  diagnosis: string;
  solution: string;
  priority: number;
  confidence: number;
  repairSteps?: string[];
  safetyWarnings?: string[];
  tools?: string[];
  estimatedTime?: number;
}

const EXPERT_RULES: DiagnosticRule[] = [
  {
    id: 'R001',
    name: 'Surchauffe moteur électrique',
    equipmentPatterns: ['moteur', 'motor', 'pompe', 'compresseur', 'ventilateur'],
    symptomPatterns: ['surchauffe', 'température élevée', 'chaud', 'overheating', 'hot', 'chaleur excessive'],
    conditionLogic: 'any',
    diagnosis: 'Surchauffe du moteur - causes probables: surcharge, ventilation insuffisante, roulement défaillant',
    solution: 'Vérifier la charge du moteur, nettoyer les ailettes de refroidissement, contrôler les roulements, vérifier le ventilateur de refroidissement',
    priority: 1,
    confidence: 0.85,
    repairSteps: [
      'Arrêter le moteur et laisser refroidir',
      'Mesurer la température avec un thermomètre infrarouge',
      'Vérifier l\'ampérage (ne doit pas dépasser la plaque signalétique)',
      'Nettoyer les ailettes de ventilation',
      'Contrôler l\'état des roulements (bruit, jeu)',
      'Vérifier le fonctionnement du ventilateur'
    ],
    safetyWarnings: ['Port de gants thermiques obligatoire', 'Consignation électrique avant intervention'],
    tools: ['Thermomètre infrarouge', 'Pince ampèremétrique', 'Clés mécaniques'],
    estimatedTime: 120
  },
  {
    id: 'R002',
    name: 'Vibrations anormales',
    equipmentPatterns: ['moteur', 'pompe', 'compresseur', 'ventilateur', 'réducteur', 'turbine'],
    symptomPatterns: ['vibration', 'vibrations', 'tremblement', 'oscillation', 'balourd', 'déséquilibre'],
    conditionLogic: 'any',
    diagnosis: 'Vibrations anormales - causes probables: balourd, désalignement, roulements usés, fixation desserrée',
    solution: 'Effectuer une analyse vibratoire, vérifier l\'alignement, contrôler les fixations, remplacer les roulements si nécessaire',
    priority: 1,
    confidence: 0.82,
    repairSteps: [
      'Mesurer les niveaux de vibration (accéléromètre)',
      'Vérifier le serrage des boulons de fixation',
      'Contrôler l\'alignement arbres/accouplements',
      'Inspecter l\'état des roulements',
      'Vérifier l\'équilibrage du rotor',
      'Effectuer un rééquilibrage si nécessaire'
    ],
    safetyWarnings: ['Ne jamais toucher les parties tournantes', 'Mesures à prendre moteur en marche avec précaution'],
    tools: ['Analyseur vibratoire', 'Comparateur à cadran', 'Clé dynamométrique'],
    estimatedTime: 180
  },
  {
    id: 'R003',
    name: 'Fuite hydraulique',
    equipmentPatterns: ['pompe', 'vérin', 'hydraulique', 'circuit', 'presse', 'grue'],
    symptomPatterns: ['fuite', 'huile', 'pression basse', 'perte de pression', 'suintement', 'leak'],
    conditionLogic: 'any',
    diagnosis: 'Fuite hydraulique - causes probables: joint usé, raccord desserré, flexible endommagé, cylindre rayé',
    solution: 'Localiser la fuite, remplacer les joints ou flexibles défectueux, vérifier la pression du circuit',
    priority: 2,
    confidence: 0.88,
    repairSteps: [
      'Mettre le circuit hors pression',
      'Localiser précisément la fuite (papier absorbant)',
      'Vérifier le serrage des raccords',
      'Inspecter les flexibles (fissures, usure)',
      'Remplacer les joints défectueux',
      'Remettre en pression et vérifier l\'étanchéité'
    ],
    safetyWarnings: ['Circuit sous haute pression - consigner avant intervention', 'Risque de brûlure par huile chaude'],
    tools: ['Manomètre', 'Jeu de joints', 'Clés hydrauliques'],
    estimatedTime: 90
  },
  {
    id: 'R004',
    name: 'Bruit anormal roulement',
    equipmentPatterns: ['moteur', 'pompe', 'réducteur', 'ventilateur', 'convoyeur', 'compresseur'],
    symptomPatterns: ['bruit', 'grincement', 'claquement', 'sifflement', 'grondement', 'roulement'],
    conditionLogic: 'any',
    diagnosis: 'Bruit anormal de roulement - usure avancée, manque de lubrification, contamination',
    solution: 'Vérifier et remplacer les roulements défectueux, relubrifier, contrôler l\'étanchéité',
    priority: 1,
    confidence: 0.80,
    repairSteps: [
      'Identifier la source du bruit (stéthoscope mécanique)',
      'Vérifier le niveau de lubrification',
      'Mesurer le jeu axial et radial des roulements',
      'Contrôler la température du palier',
      'Remplacer le roulement si usé',
      'Appliquer la lubrification correcte (type et quantité)'
    ],
    safetyWarnings: ['Consignation mécanique et électrique', 'Port de protections auditives'],
    tools: ['Stéthoscope mécanique', 'Extracteur de roulement', 'Graisse adaptée'],
    estimatedTime: 150
  },
  {
    id: 'R005',
    name: 'Défaut électrique / court-circuit',
    equipmentPatterns: ['moteur', 'transformateur', 'armoire', 'variateur', 'automate', 'disjoncteur'],
    symptomPatterns: ['court-circuit', 'disjonction', 'arc', 'étincelle', 'fusion', 'déclenchement', 'surcharge électrique'],
    conditionLogic: 'any',
    diagnosis: 'Défaut électrique - court-circuit, surcharge, isolation défectueuse',
    solution: 'Effectuer un test d\'isolement, vérifier les connexions, contrôler les protections',
    priority: 1,
    confidence: 0.87,
    repairSteps: [
      'Consigner l\'installation électrique (LOTO)',
      'Vérifier l\'absence de tension (VAT)',
      'Tester l\'isolement des câbles et bobinages (mégohmmètre)',
      'Inspecter les connexions (serrage, oxydation)',
      'Vérifier le calibrage des protections',
      'Remplacer les composants défaillants'
    ],
    safetyWarnings: ['DANGER ELECTRIQUE - Habilitation requise', 'Consignation obligatoire avant toute intervention', 'Port des EPI électriques'],
    tools: ['Mégohmmètre', 'Multimètre', 'Pince ampèremétrique', 'Testeur VAT'],
    estimatedTime: 120
  },
  {
    id: 'R006',
    name: 'Perte de débit pompe',
    equipmentPatterns: ['pompe', 'pompage', 'station de pompage'],
    symptomPatterns: ['débit faible', 'perte de débit', 'cavitation', 'amorçage', 'pas de débit', 'pression insuffisante'],
    conditionLogic: 'any',
    diagnosis: 'Perte de débit pompe - cavitation, usure roue, colmatage filtre, fuite aspiration',
    solution: 'Vérifier les filtres, contrôler l\'amorçage, inspecter la roue et les garnitures',
    priority: 2,
    confidence: 0.84,
    repairSteps: [
      'Vérifier le niveau dans le réservoir d\'aspiration',
      'Contrôler et nettoyer les filtres d\'aspiration',
      'Vérifier l\'étanchéité de la ligne d\'aspiration',
      'Contrôler le sens de rotation',
      'Inspecter la roue (usure, corrosion)',
      'Vérifier les garnitures mécaniques'
    ],
    safetyWarnings: ['Risque de projection de fluide', 'Consigner la pompe avant ouverture'],
    tools: ['Manomètre', 'Débitmètre', 'Clés mécaniques'],
    estimatedTime: 120
  },
  {
    id: 'R007',
    name: 'Défaut compresseur',
    equipmentPatterns: ['compresseur', 'air comprimé'],
    symptomPatterns: ['pression basse', 'pas de pression', 'fuite air', 'surchauffe compresseur', 'claquement', 'démarrage difficile'],
    conditionLogic: 'any',
    diagnosis: 'Défaut compresseur - fuite réseau, soupape défaillante, filtre colmaté, huile insuffisante',
    solution: 'Contrôler le réseau d\'air, vérifier les soupapes, remplacer les filtres, vérifier le niveau d\'huile',
    priority: 2,
    confidence: 0.83,
    repairSteps: [
      'Vérifier le niveau d\'huile',
      'Contrôler et remplacer les filtres (air, huile, séparateur)',
      'Vérifier les soupapes de sécurité',
      'Rechercher les fuites sur le réseau (détecteur ultrason)',
      'Contrôler la pression de consigne',
      'Vérifier le purgeur automatique'
    ],
    safetyWarnings: ['Réseau sous pression - purger avant intervention', 'Risque de brûlure (air chaud)'],
    tools: ['Détecteur de fuite ultrason', 'Manomètre', 'Clés mécaniques'],
    estimatedTime: 90
  },
  {
    id: 'R008',
    name: 'Défaut convoyeur / chaîne',
    equipmentPatterns: ['convoyeur', 'transporteur', 'bande', 'chaîne', 'tapis'],
    symptomPatterns: ['dérive', 'patinage', 'déchirure', 'blocage', 'usure bande', 'tension'],
    conditionLogic: 'any',
    diagnosis: 'Défaut convoyeur - tension insuffisante, usure bande/chaîne, rouleau bloqué, désalignement',
    solution: 'Régler la tension, aligner les rouleaux, remplacer les éléments usés',
    priority: 2,
    confidence: 0.81,
    repairSteps: [
      'Vérifier la tension de la bande/chaîne',
      'Contrôler l\'alignement des rouleaux',
      'Inspecter l\'état de la bande (fissures, déchirure)',
      'Vérifier la rotation libre des rouleaux',
      'Contrôler le système de guidage',
      'Lubrifier la chaîne si applicable'
    ],
    safetyWarnings: ['Consigner le convoyeur avant intervention', 'Risque d\'entraînement - ne pas porter de vêtements amples'],
    tools: ['Tensiomètre', 'Clés mécaniques', 'Niveau à bulle'],
    estimatedTime: 120
  },
  {
    id: 'R009',
    name: 'Défaut réducteur',
    equipmentPatterns: ['réducteur', 'boîte de vitesse', 'engrenage', 'multiplicateur'],
    symptomPatterns: ['bruit', 'vibration', 'fuite huile', 'échauffement', 'jeu excessif', 'couple insuffisant'],
    conditionLogic: 'any',
    diagnosis: 'Défaut réducteur - usure engrenages, lubrification insuffisante, roulements usés',
    solution: 'Vérifier le niveau et la qualité d\'huile, contrôler les engrenages et roulements',
    priority: 1,
    confidence: 0.79,
    repairSteps: [
      'Vérifier le niveau d\'huile et sa qualité (analyse)',
      'Contrôler la température de fonctionnement',
      'Écouter les bruits anormaux (stéthoscope)',
      'Vérifier le jeu des engrenages',
      'Contrôler l\'état des roulements',
      'Vidanger et remplacer l\'huile si nécessaire'
    ],
    safetyWarnings: ['Consigner l\'équipement', 'Attention aux pièces tournantes'],
    tools: ['Stéthoscope', 'Thermomètre', 'Kit analyse huile'],
    estimatedTime: 180
  },
  {
    id: 'R010',
    name: 'Défaut automate / commande',
    equipmentPatterns: ['automate', 'api', 'plc', 'commande', 'variateur', 'ihm'],
    symptomPatterns: ['erreur', 'alarme', 'défaut communication', 'programme', 'arrêt intempestif', 'reset'],
    conditionLogic: 'any',
    diagnosis: 'Défaut automate/commande - erreur programme, communication, alimentation, capteur défaillant',
    solution: 'Diagnostiquer via logiciel, vérifier les capteurs, contrôler les alimentations et communications',
    priority: 1,
    confidence: 0.76,
    repairSteps: [
      'Lire le code défaut sur l\'automate/IHM',
      'Vérifier l\'alimentation de l\'automate',
      'Contrôler les connexions réseau/bus de terrain',
      'Tester les entrées/sorties concernées',
      'Vérifier les capteurs associés',
      'Redémarrer l\'automate si nécessaire'
    ],
    safetyWarnings: ['Habilitation électrique requise', 'Attention aux mouvements machines au redémarrage'],
    tools: ['Logiciel de programmation', 'Multimètre', 'Câble de connexion'],
    estimatedTime: 90
  }
];

export class DiagnosticRulesEngine {
  private rules: DiagnosticRule[] = EXPERT_RULES;

  evaluateRules(equipmentType: string, symptoms: string, symptomsChecked?: string[]): RuleMatch[] {
    const normalizedEquipment = equipmentType.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizedSymptoms = symptoms.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const allSymptomText = [normalizedSymptoms, ...(symptomsChecked || []).map(s => s.toLowerCase())].join(' ');

    const matches: RuleMatch[] = [];

    for (const rule of this.rules) {
      const equipmentMatch = rule.equipmentPatterns.some(pattern =>
        normalizedEquipment.includes(pattern.toLowerCase()) ||
        pattern.toLowerCase().includes(normalizedEquipment.split(' ')[0])
      );

      if (!equipmentMatch) continue;

      const matchedSymptoms = rule.symptomPatterns.filter(pattern =>
        allSymptomText.includes(pattern.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
      );

      const hasMatch = rule.conditionLogic === 'any'
        ? matchedSymptoms.length > 0
        : matchedSymptoms.length === rule.symptomPatterns.length;

      if (hasMatch) {
        const symptomCoverage = matchedSymptoms.length / rule.symptomPatterns.length;
        const adjustedConfidence = Math.min(rule.confidence * (0.7 + 0.3 * symptomCoverage), 0.95);

        matches.push({
          ruleId: rule.id,
          ruleName: rule.name,
          diagnosis: rule.diagnosis,
          solution: rule.solution,
          confidence: adjustedConfidence,
          matchedConditions: matchedSymptoms,
          explanation: `Règle expert "${rule.name}" activée — ${matchedSymptoms.length} symptôme(s) correspondant(s): ${matchedSymptoms.join(', ')}`,
          priority: rule.priority,
          repairSteps: rule.repairSteps,
          safetyWarnings: rule.safetyWarnings,
          tools: rule.tools,
          estimatedTime: rule.estimatedTime
        });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  async getFailureMemoryMatches(equipmentType: string, symptoms: string, tenantId?: string): Promise<{
    matches: any[];
    explanations: ExplanationFactor[];
  }> {
    try {
      const normalizedType = equipmentType.toLowerCase();
      const keywords = symptoms.toLowerCase().split(/[\s,;.]+/).filter(k => k.length > 3);

      const memoryEntries = await db.select()
        .from(failureMemory)
        .where(
          and(
            sql`LOWER(${failureMemory.equipmentType}) LIKE ${`%${normalizedType.split(' ')[0]}%`}`,
            sql`${failureMemory.confirmedCount} > 0`,
            eq(failureMemory.status, 'active')
          )
        )
        .orderBy(desc(failureMemory.confirmedCount))
        .limit(20);

      const scored = memoryEntries
        .map(entry => {
          const symptomSig = entry.symptomSignature.toLowerCase();
          const matchCount = keywords.filter(k => symptomSig.includes(k)).length;
          const similarity = keywords.length > 0 ? matchCount / keywords.length : 0;
          return { ...entry, similarity };
        })
        .filter(e => e.similarity > 0.2)
        .sort((a, b) => (b.similarity * (b.confirmedCount || 1)) - (a.similarity * (a.confirmedCount || 1)))
        .slice(0, 5);

      const explanations: ExplanationFactor[] = scored.map(entry => ({
        type: 'failure_memory' as const,
        label: `Panne connue — ${entry.confirmedCount} confirmation(s)`,
        detail: `Diagnostic "${entry.diagnosis}" confirmé ${entry.confirmedCount} fois pour ${entry.equipmentType}`,
        impact: (entry.confirmedCount || 0) >= 5 ? 'high' : (entry.confirmedCount || 0) >= 2 ? 'medium' : 'low'
      }));

      return { matches: scored, explanations };
    } catch (error) {
      console.error('Failure memory lookup error:', error);
      return { matches: [], explanations: [] };
    }
  }

  async getHistoricalCaseCount(equipmentType: string, diagnosis: string): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(maintenanceCases)
        .where(
          and(
            sql`LOWER(${maintenanceCases.equipmentType}) LIKE ${`%${equipmentType.toLowerCase().split(' ')[0]}%`}`,
            sql`LOWER(${maintenanceCases.diagnosis}) LIKE ${`%${diagnosis.toLowerCase().split(' ').slice(0, 3).join('%')}%`}`
          )
        );
      return Number(result[0]?.count || 0);
    } catch {
      return 0;
    }
  }
}

export const diagnosticRulesEngine = new DiagnosticRulesEngine();
