import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineDiagnosticDatabase } from './OfflineStorage';

export interface DiagnosticData {
  equipmentType: string;
  symptoms: string;
  symptomsChecked: string[];
  urgency: string;
  zone: string;
  sector: string;
}

export interface DiagnosticSuggestion {
  diagnosis: string;
  solution: string;
  confidence: number;
  duration: number;
  riskLevel: string;
  costEstimate: string;
  aiInsights: string;
  predictiveTips?: string[];
}

export interface DiagnosticResult {
  suggestions: DiagnosticSuggestion[];
  mlEnabled: boolean;
  modelAccuracy: string;
}

import { DEFAULT_SERVER_URL } from '../config/api.config';
const API_BASE_URL = DEFAULT_SERVER_URL;

export async function performDiagnosis(
  diagnosticData: DiagnosticData,
  isOnline: boolean
): Promise<DiagnosticResult> {
  if (isOnline) {
    try {
      return await performOnlineDiagnosis(diagnosticData);
    } catch (error) {
      console.log('Online diagnosis failed, falling back to offline:', error);
      return await performOfflineDiagnosis(diagnosticData);
    }
  } else {
    return await performOfflineDiagnosis(diagnosticData);
  }
}

async function performOnlineDiagnosis(data: DiagnosticData): Promise<DiagnosticResult> {
  const response = await fetch(`${API_BASE_URL}/api/diagnostic-ml`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  return {
    suggestions: result.suggestions || [],
    mlEnabled: result.mlEnabled || false,
    modelAccuracy: result.modelAccuracy || 'unknown',
  };
}

async function performOfflineDiagnosis(data: DiagnosticData): Promise<DiagnosticResult> {
  // Analyse sémantique hors ligne basée sur des règles
  const suggestions = await analyzeOfflineSymptoms(data);
  
  return {
    suggestions,
    mlEnabled: false,
    modelAccuracy: 'offline_rules',
  };
}

async function analyzeOfflineSymptoms(data: DiagnosticData): Promise<DiagnosticSuggestion[]> {
  const offlineDatabase = await offlineDiagnosticDatabase.getAll();
  const suggestions: DiagnosticSuggestion[] = [];

  // Dictionnaire de symptômes pour correspondance hors ligne
  const symptomPatterns = {
    surchauffe: ['chaud', 'chauffe', 'température', 'brûlant', 'échauffement'],
    vibration: ['vibration', 'tremblement', 'oscillation', 'secousse'],
    bruit: ['bruit', 'son', 'grincement', 'sifflement', 'claquement'],
    fuite: ['fuite', 'écoulement', 'perte', 'coulure'],
    blocage: ['bloqué', 'coincé', 'grippé', 'immobilisé'],
    electrique: ['étincelle', 'court-circuit', 'coupure', 'électrique'],
  };

  // Analyser les symptômes du texte
  const symptomsLower = data.symptoms.toLowerCase();
  const detectedPatterns: string[] = [];

  for (const [pattern, keywords] of Object.entries(symptomPatterns)) {
    if (keywords.some(keyword => symptomsLower.includes(keyword))) {
      detectedPatterns.push(pattern);
    }
  }

  // Générer des suggestions basées sur l'équipement et les symptômes détectés
  for (const pattern of detectedPatterns) {
    const suggestion = generateOfflineSuggestion(data.equipmentType, pattern, data.urgency);
    if (suggestion) {
      suggestions.push(suggestion);
    }
  }

  // Si aucune correspondance trouvée, utiliser des suggestions génériques
  if (suggestions.length === 0) {
    suggestions.push(generateGenericSuggestion(data.equipmentType, data.urgency));
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

function generateOfflineSuggestion(
  equipmentType: string,
  symptomPattern: string,
  urgency: string
): DiagnosticSuggestion | null {
  const suggestionMap: Record<string, Record<string, any>> = {
    moteur: {
      surchauffe: {
        diagnosis: 'Surchauffe moteur',
        solution: 'Vérifier le système de refroidissement et la ventilation. Contrôler les roulements.',
        confidence: 85,
        duration: 45,
      },
      vibration: {
        diagnosis: 'Problème d\'alignement moteur',
        solution: 'Vérifier l\'alignement et l\'équilibrage. Contrôler les fixations.',
        confidence: 80,
        duration: 60,
      },
      bruit: {
        diagnosis: 'Usure des roulements moteur',
        solution: 'Remplacer les roulements défaillants. Vérifier la lubrification.',
        confidence: 75,
        duration: 90,
      },
    },
    pompe: {
      fuite: {
        diagnosis: 'Défaillance joint pompe',
        solution: 'Remplacer les joints et vérifier l\'étanchéité du système.',
        confidence: 90,
        duration: 30,
      },
      vibration: {
        diagnosis: 'Cavitation pompe',
        solution: 'Vérifier la pression d\'aspiration et l\'amorçage de la pompe.',
        confidence: 85,
        duration: 45,
      },
      bruit: {
        diagnosis: 'Usure roue pompe',
        solution: 'Contrôler l\'état de la roue et remplacer si nécessaire.',
        confidence: 80,
        duration: 120,
      },
    },
    compresseur: {
      surchauffe: {
        diagnosis: 'Surchauffe compresseur',
        solution: 'Vérifier le niveau d\'huile et le système de refroidissement.',
        confidence: 85,
        duration: 60,
      },
      bruit: {
        diagnosis: 'Problème soupapes compresseur',
        solution: 'Contrôler et ajuster les soupapes. Vérifier la compression.',
        confidence: 80,
        duration: 90,
      },
    },
  };

  const equipmentSuggestions = suggestionMap[equipmentType];
  if (!equipmentSuggestions || !equipmentSuggestions[symptomPattern]) {
    return null;
  }

  const baseSuggestion = equipmentSuggestions[symptomPattern];
  const urgencyMultiplier = urgency === 'high' ? 1.2 : urgency === 'low' ? 0.8 : 1.0;

  return {
    ...baseSuggestion,
    riskLevel: urgency === 'high' ? 'Élevé' : urgency === 'low' ? 'Faible' : 'Moyen',
    costEstimate: `${Math.round(baseSuggestion.duration * 1.5 * urgencyMultiplier)}€`,
    aiInsights: `Analyse hors ligne • Correspondance de symptômes détectée • ${symptomPattern}`,
    predictiveTips: [
      'Effectuer une maintenance préventive régulière',
      'Surveiller les paramètres de fonctionnement',
      'Documenter les interventions',
    ],
  };
}

function generateGenericSuggestion(equipmentType: string, urgency: string): DiagnosticSuggestion {
  return {
    diagnosis: `Diagnostic général ${equipmentType}`,
    solution: `Procéder à une inspection visuelle complète de l'équipement ${equipmentType}. Vérifier les connexions, la lubrification et les paramètres de fonctionnement.`,
    confidence: 60,
    duration: 45,
    riskLevel: urgency === 'high' ? 'Élevé' : urgency === 'low' ? 'Faible' : 'Moyen',
    costEstimate: `${Math.round(45 * 1.5)}€`,
    aiInsights: 'Analyse hors ligne • Diagnostic générique basé sur le type d\'équipement',
    predictiveTips: [
      'Effectuer des contrôles périodiques',
      'Maintenir un carnet de maintenance',
      'Former le personnel à la détection précoce',
    ],
  };
}