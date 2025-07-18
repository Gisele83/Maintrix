import OpenAI from 'openai';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export interface CloudDiagnosticRequest {
  equipmentType: string;
  zone: string;
  sector: string;
  symptoms: string[];
  customSymptoms: string;
  urgency: string;
  context?: string;
}

export interface CloudDiagnosticSuggestion {
  diagnosis: string;
  confidence: number;
  solution: string;
  repairSteps: string[];
  safetyWarnings: string[];
  estimatedTime: string;
  difficulty: 'Facile' | 'Moyen' | 'Difficile';
  tools: string[];
  cost: string;
  riskLevel: 'Faible' | 'Moyen' | 'Élevé';
  source: 'cloud';
}

export interface CloudDiagnosticResponse {
  suggestions: CloudDiagnosticSuggestion[];
  searchPerformed: boolean;
  confidence: number;
  aiInsights: string;
}

export async function performCloudDiagnostic(request: CloudDiagnosticRequest): Promise<CloudDiagnosticResponse> {
  try {
    // Construire le prompt pour l'analyse des symptômes
    const prompt = buildDiagnosticPrompt(request);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: getSystemPrompt()
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      suggestions: result.suggestions || [],
      searchPerformed: true,
      confidence: result.confidence || 0,
      aiInsights: result.aiInsights || "Analyse effectuée par intelligence artificielle"
    };

  } catch (error) {
    console.error('Cloud diagnostic error:', error);
    return {
      suggestions: [],
      searchPerformed: false,
      confidence: 0,
      aiInsights: "Erreur lors de l'analyse cloud"
    };
  }
}

function getSystemPrompt(): string {
  return `Vous êtes un expert en maintenance industrielle spécialisé dans le diagnostic d'équipements.
Votre rôle est d'analyser les symptômes d'équipements industriels et de fournir des diagnostics précis avec solutions.

CONTEXTE D'EXPERTISE:
- Équipements industriels: moteurs, pompes, compresseurs, ventilateurs, réducteurs, etc.
- Équipements portuaires: grues STS, RTG, mobile, reach stackers, straddle carriers, spreaders
- Électronique de puissance: convertisseurs, onduleurs, redresseurs, UPS
- Systèmes pneumatiques et hydrauliques
- Systèmes de contrôle et instrumentation

INSTRUCTIONS DE RÉPONSE:
1. Analysez les symptômes décrits avec votre expertise industrielle
2. Proposez jusqu'à 3 diagnostics les plus probables
3. Fournissez des solutions détaillées et pratiques
4. Incluez les étapes de réparation spécifiques
5. Mentionnez les outils nécessaires
6. Évaluez les risques et niveaux de difficulté
7. Estimez les coûts et temps de réparation

FORMAT DE RÉPONSE:
Répondez uniquement en JSON avec la structure suivante:
{
  "suggestions": [
    {
      "diagnosis": "Diagnostic détaillé",
      "confidence": 85,
      "solution": "Solution complète",
      "repairSteps": ["Étape 1", "Étape 2", "Étape 3"],
      "safetyWarnings": ["Avertissement sécurité 1", "Avertissement sécurité 2"],
      "estimatedTime": "2-4 heures",
      "difficulty": "Moyen",
      "tools": ["Outil 1", "Outil 2"],
      "cost": "€€ (200-500€)",
      "riskLevel": "Moyen"
    }
  ],
  "confidence": 85,
  "aiInsights": "Explication de l'analyse et recommandations"
}

NIVEAUX DE CONFIANCE:
- 90-100%: Diagnostic très certain
- 70-89%: Diagnostic probable
- 50-69%: Diagnostic possible
- <50%: Diagnostic incertain

NIVEAUX DE DIFFICULTÉ:
- Facile: Technicien junior, outils standard
- Moyen: Technicien expérimenté, outils spécialisés
- Difficile: Expert, équipement spécialisé

NIVEAUX DE RISQUE:
- Faible: Maintenance préventive, pas d'urgence
- Moyen: Réparation recommandée sous 1 semaine
- Élevé: Arrêt immédiat recommandé, risque sécurité

Répondez en français et soyez précis dans vos recommandations.`;
}

function buildDiagnosticPrompt(request: CloudDiagnosticRequest): string {
  const symptomsText = [
    ...request.symptoms,
    request.customSymptoms
  ].filter(Boolean).join(', ');

  return `DEMANDE DE DIAGNOSTIC INDUSTRIEL

ÉQUIPEMENT:
- Type: ${request.equipmentType}
- Zone: ${request.zone}
- Secteur: ${request.sector}
- Urgence: ${request.urgency}

SYMPTÔMES OBSERVÉS:
${symptomsText}

${request.context ? `CONTEXTE ADDITIONNEL:\n${request.context}` : ''}

MISSION:
Analysez ces symptômes et fournissez un diagnostic expert avec solutions détaillées.
Concentrez-vous sur les causes les plus probables pour ce type d'équipement.
Proposez des solutions pratiques que peut appliquer un technicien de maintenance.

Répondez au format JSON demandé.`;
}

export async function analyzeSymptomSimilarity(
  unknownSymptom: string, 
  equipmentType: string
): Promise<{
  similarSymptoms: string[];
  suggestedKeywords: string[];
  confidence: number;
}> {
  try {
    const prompt = `Analysez ce symptôme d'équipement industriel et suggérez des termes similaires:

SYMPTÔME: "${unknownSymptom}"
ÉQUIPEMENT: ${equipmentType}

Fournissez des symptômes similaires et mots-clés associés qui pourraient aider à identifier le problème.

Répondez en JSON:
{
  "similarSymptoms": ["symptôme similaire 1", "symptôme similaire 2"],
  "suggestedKeywords": ["mot-clé 1", "mot-clé 2"],
  "confidence": 75
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Vous êtes un expert en maintenance industrielle. Analysez les symptômes et suggérez des termes équivalents."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 500
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      similarSymptoms: result.similarSymptoms || [],
      suggestedKeywords: result.suggestedKeywords || [],
      confidence: result.confidence || 0
    };

  } catch (error) {
    console.error('Symptom similarity analysis error:', error);
    return {
      similarSymptoms: [],
      suggestedKeywords: [],
      confidence: 0
    };
  }
}

export async function generateMaintenanceInsights(
  equipmentType: string,
  diagnosisHistory: any[]
): Promise<{
  insights: string[];
  recommendations: string[];
  patterns: string[];
}> {
  try {
    const historyText = diagnosisHistory
      .slice(0, 10) // Limiter aux 10 derniers
      .map(h => `${h.equipmentType}: ${h.symptoms?.join(', ')} -> ${h.diagnosis}`)
      .join('\n');

    const prompt = `Analysez l'historique de maintenance pour générer des insights:

ÉQUIPEMENT ACTUEL: ${equipmentType}

HISTORIQUE RÉCENT:
${historyText}

Générez des insights sur:
1. Tendances de pannes récurrentes
2. Recommandations de maintenance préventive
3. Patterns identifiés

Répondez en JSON:
{
  "insights": ["Insight 1", "Insight 2"],
  "recommendations": ["Recommandation 1", "Recommandation 2"],
  "patterns": ["Pattern 1", "Pattern 2"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system", 
          content: "Vous êtes un expert en analyse de données de maintenance industrielle."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 800
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      insights: result.insights || [],
      recommendations: result.recommendations || [],
      patterns: result.patterns || []
    };

  } catch (error) {
    console.error('Maintenance insights error:', error);
    return {
      insights: [],
      recommendations: [],
      patterns: []
    };
  }
}