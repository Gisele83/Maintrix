import { db } from './db';
import { maintenanceCases, diagnosticSessions, workOrders, equipmentRegistry, failureMemory, failureTrends, feedbackSessions, maintenanceCounters } from '../shared/schema';
import { eq, and, like, desc, sql, gte, count } from 'drizzle-orm';
import { diagnosticRulesEngine, type RuleMatch, type ExplanationFactor } from './diagnostic-rules-engine';
import Anthropic from '@anthropic-ai/sdk';

/*
<important_code_snippet_instructions>
The newest Anthropic model is "claude-sonnet-4-20250514", not "claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022" nor "claude-3-sonnet-20240229". 
</important_code_snippet_instructions>
*/
const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";

export interface HybridDiagnosticRequest {
  equipmentType: string;
  symptoms: string;
  symptomsChecked?: string[];
  urgency: string;
  zone?: string;
  sector?: string;
  equipmentId?: string;
  tenantId?: string;
  userId?: number;
}

export interface DiagnosticSuggestion {
  diagnosis: string;
  solution: string;
  confidence: number;
  source: 'rules' | 'historical' | 'failure_memory' | 'ai_structured';
  explanationFactors: ExplanationFactor[];
  matchingCases: number;
  caseId?: number;
  ruleId?: string;
  duration?: number;
  riskLevel: string;
  costEstimate?: string;
  repairSteps?: string[];
  safetyWarnings?: string[];
  tools?: string[];
  difficulty?: string;
  aiInsights: string;
  priority: number;
}

export interface HybridDiagnosticResult {
  sessionId?: number;
  suggestions: DiagnosticSuggestion[];
  explanationSummary: string;
  contextSignals: ContextSignal[];
  similarIncidents: SimilarIncident[];
  failureTrends: TrendInfo[];
  engineSources: string[];
  overallConfidence: number;
}

interface ContextSignal {
  type: string;
  label: string;
  detail: string;
}

interface SimilarIncident {
  date: string;
  equipmentType: string;
  diagnosis: string;
  resolution: string;
  daysAgo: number;
}

interface TrendInfo {
  failureCode: string;
  occurrences: number;
  direction: string;
  lastOccurrence: string;
}

export class HybridDiagnosticPipeline {
  private anthropic: Anthropic | null = null;

  constructor() {
    try {
      if (process.env.ANTHROPIC_API_KEY) {
        this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      }
    } catch (e) {
      console.warn('Anthropic client not available, AI structuring disabled');
    }
  }

  async runDiagnostic(request: HybridDiagnosticRequest): Promise<HybridDiagnosticResult> {
    console.log(`🔬 Hybrid diagnostic pipeline starting for ${request.equipmentType}...`);

    const [
      ruleResults,
      historicalResults,
      failureMemoryResults,
      contextSignals,
      similarIncidents,
      trends
    ] = await Promise.all([
      this.runRulesEngine(request),
      this.runSimilarityAnalysis(request),
      this.runFailureMemoryLookup(request),
      this.gatherContextSignals(request),
      this.findSimilarIncidents(request),
      this.getFailureTrends(request)
    ]);

    let allSuggestions: DiagnosticSuggestion[] = [
      ...ruleResults,
      ...historicalResults,
      ...failureMemoryResults
    ];

    allSuggestions = this.deduplicateAndRank(allSuggestions);
    allSuggestions = this.enrichWithContext(allSuggestions, contextSignals);

    const top3 = allSuggestions.slice(0, 3);

    let structuredSuggestions = top3;
    if (this.anthropic && top3.length > 0) {
      try {
        structuredSuggestions = await this.structureWithAI(top3, request, contextSignals);
      } catch (error) {
        console.warn('AI structuring failed, using raw results:', error);
      }
    }

    const engineSources = this.getEngineSources(ruleResults, historicalResults, failureMemoryResults);
    const overallConfidence = structuredSuggestions.length > 0
      ? structuredSuggestions[0].confidence
      : 0;

    const explanationSummary = this.buildExplanationSummary(structuredSuggestions, engineSources);

    console.log(`✅ Hybrid diagnostic complete: ${structuredSuggestions.length} suggestions, confidence: ${overallConfidence}%`);

    return {
      suggestions: structuredSuggestions,
      explanationSummary,
      contextSignals,
      similarIncidents,
      failureTrends: trends,
      engineSources,
      overallConfidence
    };
  }

  private async runRulesEngine(request: HybridDiagnosticRequest): Promise<DiagnosticSuggestion[]> {
    const ruleMatches = diagnosticRulesEngine.evaluateRules(
      request.equipmentType,
      request.symptoms,
      request.symptomsChecked
    );

    return ruleMatches.map((match, index) => ({
      diagnosis: match.diagnosis,
      solution: match.solution,
      confidence: Math.round(match.confidence * 100),
      source: 'rules' as const,
      explanationFactors: [{
        type: 'rule_match' as const,
        label: `Règle expert: ${match.ruleName}`,
        detail: match.explanation,
        impact: match.confidence > 0.8 ? 'high' as const : 'medium' as const
      }],
      matchingCases: 0,
      ruleId: match.ruleId,
      duration: match.estimatedTime,
      riskLevel: this.mapUrgencyToRisk(request.urgency),
      repairSteps: match.repairSteps,
      safetyWarnings: match.safetyWarnings,
      tools: match.tools,
      aiInsights: `Diagnostic basé sur règle expert "${match.ruleName}" — ${match.matchedConditions.length} condition(s) vérifiée(s)`,
      priority: index + 1
    }));
  }

  private async runSimilarityAnalysis(request: HybridDiagnosticRequest): Promise<DiagnosticSuggestion[]> {
    try {
      const normalizedType = request.equipmentType.toLowerCase();
      const keywords = request.symptoms.toLowerCase().split(/[\s,;.]+/).filter(k => k.length > 3);

      let cases = await db.select()
        .from(maintenanceCases)
        .where(
          sql`LOWER(${maintenanceCases.equipmentType}) LIKE ${`%${normalizedType.split(' ')[0]}%`}`
        )
        .orderBy(desc(maintenanceCases.confidence))
        .limit(30);

      if (cases.length === 0) {
        cases = await db.select()
          .from(maintenanceCases)
          .orderBy(desc(maintenanceCases.confidence))
          .limit(50);
      }

      const scored = cases.map(c => {
        const caseSymptoms = c.symptoms.toLowerCase();
        const matchCount = keywords.filter(k => caseSymptoms.includes(k)).length;
        const textSimilarity = keywords.length > 0 ? matchCount / keywords.length : 0;

        const checkedMatch = (request.symptomsChecked || []).filter(s =>
          (c.symptomsChecked || []).includes(s)
        ).length;
        const checkedTotal = Math.max((request.symptomsChecked || []).length, 1);
        const checkedSimilarity = checkedMatch / checkedTotal;

        const equipmentMatch = c.equipmentType.toLowerCase().includes(normalizedType.split(' ')[0]) ? 1 : 0.5;
        const urgencyMatch = c.urgency === request.urgency ? 1 : 0.8;

        const baseConf = c.confidence || 0.5;
        const score = baseConf * (0.3 * textSimilarity + 0.25 * checkedSimilarity + 0.25 * equipmentMatch + 0.1 * urgencyMatch + 0.1);

        return { ...c, score: Math.min(score, 0.95) };
      })
        .filter(c => c.score > 0.15)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return scored.map((c, index) => ({
        diagnosis: c.diagnosis,
        solution: c.solution,
        confidence: Math.round(c.score * 100),
        source: 'historical' as const,
        explanationFactors: [{
          type: 'historical_cases' as const,
          label: `Cas historique similaire`,
          detail: `Cas #${c.id} — équipement: ${c.equipmentType}, similarité: ${Math.round(c.score * 100)}%`,
          impact: c.score > 0.7 ? 'high' as const : c.score > 0.4 ? 'medium' as const : 'low' as const
        }],
        matchingCases: 1,
        caseId: c.id,
        duration: c.duration || 120,
        riskLevel: this.mapUrgencyToRisk(c.urgency),
        costEstimate: this.estimateCost(c.duration || 120, c.equipmentType),
        aiInsights: `Basé sur cas historique #${c.id} — similarité ${Math.round(c.score * 100)}%`,
        priority: index + 1
      }));
    } catch (error) {
      console.error('Similarity analysis error:', error);
      return [];
    }
  }

  private async runFailureMemoryLookup(request: HybridDiagnosticRequest): Promise<DiagnosticSuggestion[]> {
    try {
      const { matches, explanations } = await diagnosticRulesEngine.getFailureMemoryMatches(
        request.equipmentType,
        request.symptoms,
        request.tenantId
      );

      return matches.map((m, index) => ({
        diagnosis: m.diagnosis,
        solution: m.solution,
        confidence: Math.round(Math.min((m.confidenceScore || 0.5) * (1 + (m.confirmedCount || 0) * 0.05), 0.98) * 100),
        source: 'failure_memory' as const,
        explanationFactors: explanations.slice(index, index + 1),
        matchingCases: m.confirmedCount || 0,
        duration: m.avgResolutionTime || 120,
        riskLevel: 'Moyen',
        aiInsights: `Panne connue — confirmée ${m.confirmedCount} fois, temps moyen: ${m.avgResolutionTime || '?'}min`,
        priority: index + 1
      }));
    } catch (error) {
      console.error('Failure memory lookup error:', error);
      return [];
    }
  }

  private async gatherContextSignals(request: HybridDiagnosticRequest): Promise<ContextSignal[]> {
    const signals: ContextSignal[] = [];

    try {
      if (request.equipmentId || request.equipmentType) {
        const equipQuery = request.equipmentId
          ? eq(equipmentRegistry.equipmentId, request.equipmentId)
          : sql`LOWER(${equipmentRegistry.equipmentType}) LIKE ${`%${request.equipmentType.toLowerCase().split(' ')[0]}%`}`;

        const equipment = await db.select()
          .from(equipmentRegistry)
          .where(equipQuery)
          .limit(1);

        if (equipment.length > 0) {
          const equip = equipment[0];
          if (equip.criticalityLevel) {
            signals.push({
              type: 'criticality',
              label: `Criticité: ${equip.criticalityLevel}`,
              detail: `Équipement classé ${equip.criticalityLevel} — ${equip.criticalityLevel === 'critical' ? 'intervention prioritaire requise' : 'suivi standard'}`
            });
          }
          if (equip.operationalState && equip.operationalState !== 'operational') {
            signals.push({
              type: 'operational_state',
              label: `État: ${equip.operationalState}`,
              detail: `Équipement actuellement en état "${equip.operationalState}"`
            });
          }
        }
      }

      const recentWOs = await db.select()
        .from(workOrders)
        .where(
          and(
            sql`LOWER(${workOrders.title}) LIKE ${`%${request.equipmentType.toLowerCase().split(' ')[0]}%`} OR LOWER(${workOrders.description}) LIKE ${`%${request.equipmentType.toLowerCase().split(' ')[0]}%`}`,
            gte(workOrders.createdAt, sql`NOW() - INTERVAL '90 days'`)
          )
        )
        .orderBy(desc(workOrders.createdAt))
        .limit(5);

      if (recentWOs.length > 0) {
        const lastWO = recentWOs[0];
        const daysAgo = lastWO.createdAt
          ? Math.floor((Date.now() - new Date(lastWO.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        signals.push({
          type: 'recent_intervention',
          label: `${recentWOs.length} intervention(s) récente(s)`,
          detail: `Dernière intervention il y a ${daysAgo} jour(s): "${lastWO.title}" (${lastWO.status})`
        });

        if (recentWOs.length >= 3) {
          signals.push({
            type: 'recurrence',
            label: `Récurrence détectée`,
            detail: `${recentWOs.length} interventions en 90 jours sur ce type d'équipement — possible problème récurrent`
          });
        }
      }

      try {
        const equipIdForCounters = request.equipmentId
          ? (await db.select({ id: equipmentRegistry.id })
              .from(equipmentRegistry)
              .where(eq(equipmentRegistry.equipmentId, request.equipmentId))
              .limit(1))?.[0]?.id
          : (await db.select({ id: equipmentRegistry.id })
              .from(equipmentRegistry)
              .where(sql`LOWER(${equipmentRegistry.equipmentType}) LIKE ${`%${request.equipmentType.toLowerCase().split(' ')[0]}%`}`)
              .limit(1))?.[0]?.id;

        if (equipIdForCounters) {
          const counters = await db.select()
            .from(maintenanceCounters)
            .where(
              and(
                eq(maintenanceCounters.equipmentId, equipIdForCounters),
                eq(maintenanceCounters.isActive, true)
              )
            );

          const hoursCounter = counters.find(c => c.counterType === 'hours');
          if (hoursCounter && hoursCounter.currentValue != null) {
            const hours = hoursCounter.currentValue;
            const threshold = hoursCounter.thresholdValue;
            const warningPct = hoursCounter.warningThresholdPct || 80;

            let machineHoursLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
            let machineHoursDetail = '';

            if (threshold && hours >= threshold) {
              machineHoursLevel = 'critical';
              machineHoursDetail = `${hours.toLocaleString('fr-FR')}h / seuil ${threshold.toLocaleString('fr-FR')}h — SEUIL DÉPASSÉ, maintenance urgente`;
            } else if (threshold && hours >= threshold * (warningPct / 100)) {
              machineHoursLevel = 'high';
              machineHoursDetail = `${hours.toLocaleString('fr-FR')}h / seuil ${threshold.toLocaleString('fr-FR')}h — approche du seuil (${Math.round(hours / threshold * 100)}%)`;
            } else if (hours >= 10000) {
              machineHoursLevel = 'medium';
              machineHoursDetail = `${hours.toLocaleString('fr-FR')}h — usure progressive probable (roulements, joints, courroies)`;
            } else {
              machineHoursDetail = `${hours.toLocaleString('fr-FR')}h — équipement relativement récent`;
            }

            signals.push({
              type: 'machine_hours',
              label: `Heures machine: ${hours.toLocaleString('fr-FR')}h`,
              detail: machineHoursDetail
            });

            if (machineHoursLevel === 'critical' || machineHoursLevel === 'high') {
              signals.push({
                type: 'machine_hours_alert',
                label: `Alerte heures machine (${machineHoursLevel})`,
                detail: machineHoursDetail
              });
            }
          }

          const otherCounters = counters.filter(c => c.counterType !== 'hours' && c.currentValue != null);
          for (const counter of otherCounters) {
            const val = counter.currentValue!;
            const unit = counter.counterType === 'cycles' ? 'cycles' : counter.counterType === 'kilometers' ? 'km' : counter.counterType;
            const threshInfo = counter.thresholdValue ? ` / seuil ${counter.thresholdValue.toLocaleString('fr-FR')} ${unit}` : '';
            signals.push({
              type: 'counter_data',
              label: `Compteur ${counter.counterType}: ${val.toLocaleString('fr-FR')} ${unit}`,
              detail: `${counter.equipmentName || 'Équipement'} — ${val.toLocaleString('fr-FR')} ${unit}${threshInfo}`
            });
          }
        }
      } catch (counterError) {
        console.error('Machine hours lookup error:', counterError);
      }
    } catch (error) {
      console.error('Context signal gathering error:', error);
    }

    return signals;
  }

  private async findSimilarIncidents(request: HybridDiagnosticRequest): Promise<SimilarIncident[]> {
    try {
      const sessions = await db.select()
        .from(diagnosticSessions)
        .where(
          and(
            sql`LOWER(${diagnosticSessions.equipmentType}) LIKE ${`%${request.equipmentType.toLowerCase().split(' ')[0]}%`}`,
            eq(diagnosticSessions.status, 'completed')
          )
        )
        .orderBy(desc(diagnosticSessions.createdAt))
        .limit(5);

      return sessions.map(s => {
        const daysAgo = s.createdAt
          ? Math.floor((Date.now() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        let resolution = 'N/A';
        try {
          const results = JSON.parse(s.results || '{}');
          if (results.suggestions && results.suggestions.length > 0) {
            resolution = results.suggestions[0].solution || results.suggestions[0].diagnosis || 'N/A';
          }
        } catch { /* ignore */ }

        return {
          date: s.createdAt ? new Date(s.createdAt).toLocaleDateString('fr-FR') : 'N/A',
          equipmentType: s.equipmentType,
          diagnosis: s.selectedDiagnosis || s.symptoms,
          resolution,
          daysAgo
        };
      });
    } catch (error) {
      console.error('Similar incidents error:', error);
      return [];
    }
  }

  private async getFailureTrends(request: HybridDiagnosticRequest): Promise<TrendInfo[]> {
    try {
      const trends = await db.select()
        .from(failureTrends)
        .where(
          sql`LOWER(${failureTrends.equipmentType}) LIKE ${`%${request.equipmentType.toLowerCase().split(' ')[0]}%`}`
        )
        .orderBy(desc(failureTrends.occurrences))
        .limit(5);

      return trends.map(t => ({
        failureCode: t.failureCode,
        occurrences: t.occurrences || 0,
        direction: t.trendDirection || 'stable',
        lastOccurrence: t.lastOccurrenceAt ? new Date(t.lastOccurrenceAt).toLocaleDateString('fr-FR') : 'N/A'
      }));
    } catch (error) {
      console.error('Failure trends error:', error);
      return [];
    }
  }

  private deduplicateAndRank(suggestions: DiagnosticSuggestion[]): DiagnosticSuggestion[] {
    const seen = new Map<string, DiagnosticSuggestion>();

    for (const s of suggestions) {
      const key = s.diagnosis.toLowerCase().substring(0, 50);
      const existing = seen.get(key);

      if (!existing || s.confidence > existing.confidence) {
        if (existing) {
          s.explanationFactors = [...s.explanationFactors, ...existing.explanationFactors];
          s.matchingCases = Math.max(s.matchingCases, existing.matchingCases);
        }
        seen.set(key, s);
      } else if (existing) {
        existing.explanationFactors = [...existing.explanationFactors, ...s.explanationFactors];
        existing.matchingCases = Math.max(existing.matchingCases, s.matchingCases);
      }
    }

    return Array.from(seen.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  private enrichWithContext(suggestions: DiagnosticSuggestion[], signals: ContextSignal[]): DiagnosticSuggestion[] {
    const criticalSignal = signals.find(s => s.type === 'criticality' && s.detail.includes('critical'));
    const recurrenceSignal = signals.find(s => s.type === 'recurrence');
    const machineHoursSignal = signals.find(s => s.type === 'machine_hours');
    const machineHoursAlert = signals.find(s => s.type === 'machine_hours_alert');

    const wearKeywords = ['usure', 'roulement', 'joint', 'courroie', 'palier', 'garniture', 'étanchéité', 'lubrification', 'graissage', 'fatigue', 'vieillissement', 'dégradation', 'bearing', 'seal', 'belt', 'wear'];

    return suggestions.map(s => {
      if (criticalSignal) {
        s.explanationFactors.push({
          type: 'criticality',
          label: criticalSignal.label,
          detail: criticalSignal.detail,
          impact: 'high'
        });
        s.confidence = Math.min(s.confidence + 5, 99);
      }
      if (recurrenceSignal) {
        s.explanationFactors.push({
          type: 'recurrence',
          label: recurrenceSignal.label,
          detail: recurrenceSignal.detail,
          impact: 'medium'
        });
      }

      if (machineHoursSignal) {
        const isWearRelated = wearKeywords.some(kw =>
          s.diagnosis.toLowerCase().includes(kw) || s.solution.toLowerCase().includes(kw)
        );

        if (machineHoursAlert) {
          const isCritical = machineHoursAlert.label.includes('critical');
          const boost = isCritical ? 10 : 5;
          const wearBoost = isWearRelated ? boost : Math.round(boost * 0.5);

          s.confidence = Math.min(s.confidence + wearBoost, 99);
          s.explanationFactors.push({
            type: 'machine_hours',
            label: machineHoursSignal.label,
            detail: `${machineHoursSignal.detail}${isWearRelated ? ' — diagnostic d\'usure renforcé (+' + wearBoost + '%)' : ' — confiance ajustée (+' + wearBoost + '%)'}`,
            impact: isCritical ? 'high' : 'medium'
          });
        } else if (isWearRelated) {
          s.explanationFactors.push({
            type: 'machine_hours',
            label: machineHoursSignal.label,
            detail: `${machineHoursSignal.detail} — heures faibles, usure peu probable`,
            impact: 'low'
          });
          s.confidence = Math.max(s.confidence - 5, 10);
        } else {
          s.explanationFactors.push({
            type: 'machine_hours',
            label: machineHoursSignal.label,
            detail: machineHoursSignal.detail,
            impact: 'low'
          });
        }
      }

      return s;
    });
  }

  private async structureWithAI(
    suggestions: DiagnosticSuggestion[],
    request: HybridDiagnosticRequest,
    contextSignals: ContextSignal[]
  ): Promise<DiagnosticSuggestion[]> {
    if (!this.anthropic) return suggestions;

    const prompt = `Vous êtes un expert en maintenance industrielle. Structurez et enrichissez les diagnostics suivants pour un technicien de terrain.

ÉQUIPEMENT: ${request.equipmentType}
SYMPTÔMES: ${request.symptoms}
${request.symptomsChecked?.length ? `SYMPTÔMES VÉRIFIÉS: ${request.symptomsChecked.join(', ')}` : ''}
URGENCE: ${request.urgency}
${request.zone ? `ZONE: ${request.zone}` : ''}

SIGNAUX CONTEXTUELS:
${contextSignals.map(s => `- ${s.label}: ${s.detail}`).join('\n')}

DIAGNOSTICS CANDIDATS (à structurer, PAS à remplacer):
${suggestions.map((s, i) => `
${i + 1}. [Confiance: ${s.confidence}%] ${s.diagnosis}
   Solution: ${s.solution}
   Source: ${s.source}
   Facteurs: ${s.explanationFactors.map(f => f.label).join(', ')}
`).join('')}

INSTRUCTIONS:
- NE PAS inventer de nouveaux diagnostics. Restructurer et enrichir ceux fournis.
- Pour chaque diagnostic, fournir un résumé clair pour technicien de terrain.
- Ajouter des étapes de réparation concrètes si manquantes.
- Indiquer les avertissements de sécurité pertinents.
- Répondre en JSON avec le format:
{
  "enrichedDiagnostics": [
    {
      "index": 0,
      "structuredDiagnosis": "...",
      "structuredSolution": "...",
      "repairSteps": ["..."],
      "safetyWarnings": ["..."],
      "tools": ["..."],
      "difficulty": "Facile|Moyen|Difficile",
      "estimatedTime": "...",
      "technicianSummary": "..."
    }
  ]
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
        system: 'Vous êtes un assistant de maintenance industrielle. Répondez UNIQUEMENT en JSON valide.'
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return suggestions;

      const parsed = JSON.parse(jsonMatch[0]);
      const enriched = parsed.enrichedDiagnostics || [];

      return suggestions.map((s, i) => {
        const aiEnrich = enriched.find((e: any) => e.index === i);
        if (!aiEnrich) return s;

        return {
          ...s,
          diagnosis: aiEnrich.structuredDiagnosis || s.diagnosis,
          solution: aiEnrich.structuredSolution || s.solution,
          repairSteps: aiEnrich.repairSteps || s.repairSteps,
          safetyWarnings: aiEnrich.safetyWarnings || s.safetyWarnings,
          tools: aiEnrich.tools || s.tools,
          difficulty: aiEnrich.difficulty || s.difficulty,
          aiInsights: aiEnrich.technicianSummary || s.aiInsights,
          explanationFactors: [
            ...s.explanationFactors,
            {
              type: 'context_signal' as const,
              label: 'Structuré par IA',
              detail: 'Diagnostic enrichi par Claude pour clarifier les étapes et recommandations',
              impact: 'low' as const
            }
          ]
        };
      });
    } catch (error) {
      console.warn('AI structuring error:', error);
      return suggestions;
    }
  }

  async recordFeedbackAndLearn(feedbackData: {
    sessionId: number;
    rating: number;
    helpful: boolean | null;
    comments: string;
    suggestionsAccuracy: string;
    actualDiagnosis?: string;
    actualSolution?: string;
  }): Promise<void> {
    try {
      await db.insert(feedbackSessions).values({
        sessionId: feedbackData.sessionId,
        userFeedback: feedbackData.helpful === true ? 'helpful' : feedbackData.helpful === false ? 'not_helpful' : 'partially_helpful',
        feedbackComment: feedbackData.comments,
        actualSolution: feedbackData.actualSolution,
        wasAccurate: feedbackData.rating >= 4,
        difficultyLevel: feedbackData.suggestionsAccuracy
      });

      const session = await db.select()
        .from(diagnosticSessions)
        .where(eq(diagnosticSessions.id, feedbackData.sessionId))
        .limit(1);

      if (session.length === 0) return;

      const diagSession = session[0];
      let selectedDiagnosis = diagSession.selectedDiagnosis;
      let selectedSolution = '';

      try {
        const results = JSON.parse(diagSession.results || '{}');
        if (results.suggestions && results.suggestions.length > 0) {
          selectedDiagnosis = selectedDiagnosis || results.suggestions[0].diagnosis;
          selectedSolution = results.suggestions[0].solution || '';
        }
      } catch { /* ignore */ }

      if (!selectedDiagnosis) return;

      const symptomSig = [diagSession.symptoms, ...(diagSession.symptomsChecked || [])].join(' | ');

      const existing = await db.select()
        .from(failureMemory)
        .where(
          and(
            sql`LOWER(${failureMemory.equipmentType}) = ${diagSession.equipmentType.toLowerCase()}`,
            sql`LOWER(${failureMemory.diagnosis}) LIKE ${`%${selectedDiagnosis.toLowerCase().substring(0, 30)}%`}`
          )
        )
        .limit(1);

      if (feedbackData.rating >= 4 || feedbackData.helpful === true) {
        if (existing.length > 0) {
          await db.update(failureMemory)
            .set({
              confirmedCount: sql`${failureMemory.confirmedCount} + 1`,
              lastConfirmedAt: new Date(),
              confidenceScore: sql`LEAST(${failureMemory.confidenceScore} + 0.02, 0.99)`,
              updatedAt: new Date()
            })
            .where(eq(failureMemory.id, existing[0].id));
        } else {
          await db.insert(failureMemory).values({
            equipmentType: diagSession.equipmentType,
            symptomSignature: symptomSig,
            diagnosis: selectedDiagnosis,
            solution: feedbackData.actualSolution || selectedSolution,
            rootCause: feedbackData.comments || undefined,
            confirmedCount: 1,
            lastConfirmedAt: new Date(),
            confidenceScore: 0.6
          });
        }

        await this.updateFailureTrend(diagSession.equipmentType, selectedDiagnosis, diagSession.zone);

      } else if (feedbackData.rating <= 2 || feedbackData.helpful === false) {
        if (existing.length > 0) {
          await db.update(failureMemory)
            .set({
              invalidatedCount: sql`${failureMemory.invalidatedCount} + 1`,
              lastInvalidatedAt: new Date(),
              confidenceScore: sql`GREATEST(${failureMemory.confidenceScore} - 0.05, 0.1)`,
              updatedAt: new Date()
            })
            .where(eq(failureMemory.id, existing[0].id));
        }

        if (feedbackData.actualDiagnosis && feedbackData.actualSolution) {
          await db.insert(failureMemory).values({
            equipmentType: diagSession.equipmentType,
            symptomSignature: symptomSig,
            diagnosis: feedbackData.actualDiagnosis,
            solution: feedbackData.actualSolution,
            rootCause: feedbackData.comments || undefined,
            confirmedCount: 1,
            lastConfirmedAt: new Date(),
            confidenceScore: 0.55
          });
        }
      }

      console.log(`📚 Learning loop: feedback recorded for session ${feedbackData.sessionId}, rating: ${feedbackData.rating}`);
    } catch (error) {
      console.error('Learning loop error:', error);
    }
  }

  private async updateFailureTrend(equipmentType: string, diagnosis: string, zone?: string | null): Promise<void> {
    try {
      const failureCode = diagnosis.substring(0, 50).replace(/\s+/g, '_').toLowerCase();

      const existing = await db.select()
        .from(failureTrends)
        .where(
          and(
            eq(failureTrends.equipmentType, equipmentType),
            eq(failureTrends.failureCode, failureCode)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const prevOcc = existing[0].occurrences || 1;
        const newDirection = prevOcc > 3 ? 'increasing' : 'stable';

        await db.update(failureTrends)
          .set({
            occurrences: sql`${failureTrends.occurrences} + 1`,
            lastOccurrenceAt: new Date(),
            trendDirection: newDirection,
            affectedZones: zone ? sql`array_append(${failureTrends.affectedZones}, ${zone})` : undefined
          })
          .where(eq(failureTrends.id, existing[0].id));
      } else {
        await db.insert(failureTrends).values({
          equipmentType,
          failureCode,
          occurrences: 1,
          firstOccurrenceAt: new Date(),
          lastOccurrenceAt: new Date(),
          trendDirection: 'stable',
          affectedZones: zone ? [zone] : []
        });
      }
    } catch (error) {
      console.error('Failure trend update error:', error);
    }
  }

  private mapUrgencyToRisk(urgency: string): string {
    switch (urgency) {
      case 'critical': return 'Élevé';
      case 'high': return 'Élevé';
      case 'medium': return 'Moyen';
      default: return 'Faible';
    }
  }

  private estimateCost(duration: number, equipmentType: string): string {
    const hourlyRate = 65;
    const hours = duration / 60;
    const laborCost = hours * hourlyRate;
    const partsCost = laborCost * 0.5;
    const total = laborCost + partsCost;
    return `${Math.round(total)}€ (estimé)`;
  }

  private getEngineSources(rules: DiagnosticSuggestion[], historical: DiagnosticSuggestion[], memory: DiagnosticSuggestion[]): string[] {
    const sources: string[] = [];
    if (rules.length > 0) sources.push('Moteur de règles expert');
    if (historical.length > 0) sources.push('Analyse de similarité historique');
    if (memory.length > 0) sources.push('Mémoire des pannes');
    if (this.anthropic) sources.push('Structuration IA (Claude)');
    return sources;
  }

  private buildExplanationSummary(suggestions: DiagnosticSuggestion[], sources: string[]): string {
    if (suggestions.length === 0) {
      return 'Aucun diagnostic trouvé. Veuillez fournir plus de détails sur les symptômes.';
    }

    const topConf = suggestions[0].confidence;
    const confLevel = topConf >= 80 ? 'Haute' : topConf >= 50 ? 'Moyenne' : 'Faible';
    const allFactors = suggestions.flatMap(s => s.explanationFactors);
    const uniqueFactors = Array.from(new Set(allFactors.map(f => f.label)));

    return `Confiance ${confLevel} (${topConf}%) — ${suggestions.length} diagnostic(s) proposé(s) via ${sources.join(', ')}. Facteurs: ${uniqueFactors.slice(0, 3).join('; ')}.`;
  }
}

export const hybridDiagnosticPipeline = new HybridDiagnosticPipeline();
