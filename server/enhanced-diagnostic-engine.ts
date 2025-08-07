import { db } from './db';
import { maintenanceCases, diagnosticSessions } from '../shared/schema';
import { eq, and, like, desc } from 'drizzle-orm';

interface HistoricalMatch {
  caseId: number;
  equipmentType: string;
  symptoms: string;
  diagnosis: string;
  solution: string;
  confidence: number;
  duration: number;
  urgency: string;
  similarity: number;
}

export class EnhancedDiagnosticEngine {
  /**
   * Enhanced diagnostic using historical maintenance cases
   */
  async analyzeWithHistory(data: {
    equipmentType: string;
    symptoms: string;
    symptomsChecked?: string[];
    urgency: string;
    zone?: string;
    sector?: string;
  }): Promise<{
    suggestions: any[];
    historicalMatches: HistoricalMatch[];
    confidence: number;
    learningSource: string;
  }> {
    console.log('🧠 Starting enhanced diagnostic with historical data...');
    
    try {
      // 1. Search for exact equipment type matches
      const exactMatches = await this.findExactMatches(data.equipmentType, data.symptoms);
      
      // 2. Search for similar equipment types
      const similarMatches = await this.findSimilarMatches(data.equipmentType, data.symptoms);
      
      // 3. Search for symptom-based matches across all equipment
      const symptomMatches = await this.findSymptomMatches(data.symptoms);
      
      // 4. Combine and rank all matches
      const allMatches = [
        ...exactMatches.map(m => ({ ...m, similarity: 1.0 })),
        ...similarMatches.map(m => ({ ...m, similarity: 0.8 })),
        ...symptomMatches.map(m => ({ ...m, similarity: 0.6 }))
      ];
      
      // 5. Sort by confidence and similarity
      const rankedMatches = allMatches
        .sort((a, b) => (b.confidence * b.similarity) - (a.confidence * a.similarity))
        .slice(0, 5);
      
      // 6. Generate suggestions based on historical data
      const suggestions = rankedMatches.map((match, index) => ({
        diagnosis: match.diagnosis,
        solution: match.solution,
        confidence: Math.round(match.confidence * match.similarity * 100),
        matchingCases: 1,
        caseId: match.caseId,
        duration: match.duration,
        riskLevel: this.mapUrgencyToRisk(match.urgency),
        costEstimate: this.estimateRepairCost(match.duration, data.equipmentType),
        aiInsights: this.generateHistoricalInsights(match, data),
        historicalMatch: true,
        equipmentType: match.equipmentType,
        originalSymptoms: match.symptoms,
        priority: index + 1
      }));
      
      const avgConfidence = suggestions.length > 0 
        ? suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length 
        : 50;
      
      console.log(`✅ Found ${suggestions.length} historical matches with avg confidence: ${avgConfidence}%`);
      
      return {
        suggestions,
        historicalMatches: rankedMatches,
        confidence: avgConfidence,
        learningSource: 'historical_database'
      };
      
    } catch (error) {
      console.error('❌ Enhanced diagnostic failed:', error);
      throw error;
    }
  }

  private async findExactMatches(equipmentType: string, symptoms: string): Promise<HistoricalMatch[]> {
    const matches = await db.select()
      .from(maintenanceCases)
      .where(and(
        eq(maintenanceCases.equipmentType, equipmentType),
        like(maintenanceCases.symptoms, `%${symptoms}%`)
      ))
      .orderBy(desc(maintenanceCases.confidence))
      .limit(10);
    
    return matches.map(match => ({
      caseId: match.id,
      equipmentType: match.equipmentType,
      symptoms: match.symptoms,
      diagnosis: match.diagnosis,
      solution: match.solution,
      confidence: match.confidence || 0.8,
      duration: match.duration || 120,
      urgency: match.urgency,
      similarity: 1.0
    }));
  }

  private async findSimilarMatches(equipmentType: string, symptoms: string): Promise<HistoricalMatch[]> {
    // Search for similar equipment types (moteur, pompe, compresseur, etc.)
    const equipmentKeywords = this.extractEquipmentKeywords(equipmentType);
    const symptomKeywords = this.extractSymptomKeywords(symptoms);
    
    const matches = await db.select()
      .from(maintenanceCases)
      .where(
        like(maintenanceCases.symptoms, `%${symptomKeywords[0] || symptoms.split(' ')[0]}%`)
      )
      .orderBy(desc(maintenanceCases.confidence))
      .limit(15);
    
    return matches
      .filter(match => equipmentKeywords.some(keyword => 
        match.equipmentType.toLowerCase().includes(keyword.toLowerCase())
      ))
      .map(match => ({
        caseId: match.id,
        equipmentType: match.equipmentType,
        symptoms: match.symptoms,
        diagnosis: match.diagnosis,
        solution: match.solution,
        confidence: match.confidence || 0.7,
        duration: match.duration || 120,
        urgency: match.urgency,
        similarity: 0.8
      }));
  }

  private async findSymptomMatches(symptoms: string): Promise<HistoricalMatch[]> {
    const keywords = this.extractSymptomKeywords(symptoms);
    const matches: HistoricalMatch[] = [];
    
    for (const keyword of keywords.slice(0, 3)) { // Limit to top 3 keywords
      const keywordMatches = await db.select()
        .from(maintenanceCases)
        .where(like(maintenanceCases.symptoms, `%${keyword}%`))
        .orderBy(desc(maintenanceCases.confidence))
        .limit(5);
      
      matches.push(...keywordMatches.map(match => ({
        caseId: match.id,
        equipmentType: match.equipmentType,
        symptoms: match.symptoms,
        diagnosis: match.diagnosis,
        solution: match.solution,
        confidence: (match.confidence || 0.6) * 0.9, // Slightly lower confidence for keyword matches
        duration: match.duration || 120,
        urgency: match.urgency,
        similarity: 0.6
      })));
    }
    
    // Remove duplicates
    const uniqueMatches = matches.filter((match, index, self) => 
      self.findIndex(m => m.caseId === match.caseId) === index
    );
    
    return uniqueMatches.slice(0, 10);
  }

  private extractEquipmentKeywords(equipmentType: string): string[] {
    const keywords = equipmentType.toLowerCase().split(/[\s-_]+/);
    const synonyms: { [key: string]: string[] } = {
      'moteur': ['motor', 'engine', 'électrique'],
      'pompe': ['pump', 'hydraulique', 'centrifuge'],
      'compresseur': ['compressor', 'pneumatique', 'vis'],
      'ventilateur': ['fan', 'soufflante', 'turbine'],
      'convoyeur': ['conveyor', 'transporteur', 'tapis']
    };
    
    const expandedKeywords = [...keywords];
    keywords.forEach(keyword => {
      if (synonyms[keyword]) {
        expandedKeywords.push(...synonyms[keyword]);
      }
    });
    
    return expandedKeywords;
  }

  private extractSymptomKeywords(symptoms: string): string[] {
    const text = symptoms.toLowerCase();
    const keywords: string[] = [];
    
    // Technical symptoms
    const technicalTerms = [
      'vibration', 'température', 'pression', 'bruit', 'fuite', 'usure',
      'défaillance', 'panne', 'arrêt', 'surcharge', 'échauffement',
      'déformation', 'rupture', 'blocage', 'déséquilibre', 'jeu',
      'température élevée', 'vibrations anormales', 'bruit inhabituel'
    ];
    
    technicalTerms.forEach(term => {
      if (text.includes(term)) {
        keywords.push(term);
      }
    });
    
    // If no technical terms found, use the most important words
    if (keywords.length === 0) {
      keywords.push(...symptoms.split(/[\s,.-]+/)
        .filter(word => word.length > 3)
        .slice(0, 5));
    }
    
    return keywords;
  }

  private mapUrgencyToRisk(urgency: string): string {
    switch (urgency.toLowerCase()) {
      case 'high': case 'urgent': case 'critique': return 'Critique';
      case 'medium': case 'moyen': return 'Modéré';
      case 'low': case 'faible': return 'Faible';
      default: return 'Modéré';
    }
  }

  private estimateRepairCost(duration: number, equipmentType: string): string {
    const baseCost = 80; // €/hour
    const equipmentMultiplier = equipmentType.toLowerCase().includes('pompe') ? 1.3 : 
                               equipmentType.toLowerCase().includes('moteur') ? 1.1 : 1.0;
    const cost = Math.round((duration / 60) * baseCost * equipmentMultiplier);
    return `${cost}€ - ${cost + 200}€`;
  }

  private generateHistoricalInsights(match: HistoricalMatch, currentData: any): string {
    const insights: string[] = [];
    
    // Equipment-specific insights
    if (match.equipmentType === currentData.equipmentType) {
      insights.push("🎯 Correspondance exacte d'équipement");
    } else {
      insights.push("🔍 Équipement similaire identifié");
    }
    
    // Confidence insights
    if (match.confidence > 0.8) {
      insights.push("✅ Cas historique haute fiabilité");
    } else if (match.confidence > 0.6) {
      insights.push("⚡ Cas historique fiabilité moyenne");
    }
    
    // Duration insights
    if (match.duration < 60) {
      insights.push("⏱️ Intervention rapide historique");
    } else if (match.duration > 180) {
      insights.push("⏳ Intervention complexe prévue");
    }
    
    // Urgency correlation
    if (match.urgency === currentData.urgency) {
      insights.push("🚨 Même niveau d'urgence confirmé");
    }
    
    return insights.slice(0, 3).join(" • ");
  }

  /**
   * Get learning statistics
   */
  async getLearningStats(): Promise<{
    totalCases: number;
    equipmentTypes: number;
    avgConfidence: number;
    recentCases: number;
  }> {
    const totalCases = await db.select().from(maintenanceCases);
    const uniqueEquipment = [...new Set(totalCases.map(c => c.equipmentType))];
    const avgConfidence = totalCases.reduce((sum, c) => sum + (c.confidence || 0), 0) / totalCases.length;
    const recentCases = totalCases.filter(c => 
      c.createdAt && new Date(c.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length;
    
    return {
      totalCases: totalCases.length,
      equipmentTypes: uniqueEquipment.length,
      avgConfidence: Math.round(avgConfidence * 100),
      recentCases
    };
  }
}