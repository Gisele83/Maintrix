import { useOffline } from '../contexts/OfflineContext';
import { useDatabase } from '../contexts/DatabaseContext';

const API_BASE_URL = 'http://your-server-url.com/api'; // Replace with your actual server URL

interface DiagnosticRequest {
  equipmentType: string;
  equipmentId?: string;
  symptoms: string[];
  zone?: string;
  sector?: string;
  urgencyLevel: string;
  mlMode: string;
}

interface DiagnosticResponse {
  suggestions: any[];
  confidenceScore: number;
  riskLevel: string;
  estimatedCost: number;
  insights: string[];
}

class ApiService {
  private isOnline: boolean = true;
  private executeQuery: any = null;

  constructor() {
    // These will be set by the hook
  }

  setOnlineStatus(isOnline: boolean) {
    this.isOnline = isOnline;
  }

  setDatabaseQuery(executeQuery: any) {
    this.executeQuery = executeQuery;
  }

  async performDiagnostic(request: DiagnosticRequest): Promise<DiagnosticResponse> {
    if (this.isOnline) {
      try {
        const response = await fetch(`${API_BASE_URL}/diagnostic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();
        
        // Cache the result for offline use
        await this.cacheData(`diagnostic_${Date.now()}`, data);
        
        return data;
      } catch (error) {
        console.error('API call failed, falling back to offline mode:', error);
        return this.performOfflineDiagnostic(request);
      }
    } else {
      return this.performOfflineDiagnostic(request);
    }
  }

  private async performOfflineDiagnostic(request: DiagnosticRequest): Promise<DiagnosticResponse> {
    // Offline diagnostic logic using cached data and simple rules
    const symptoms = request.symptoms.join(' ').toLowerCase();
    
    let suggestions = [];
    let confidenceScore = 0.6; // Lower confidence for offline
    let riskLevel = 'medium';
    let estimatedCost = 100;

    // Simple pattern matching for common issues
    if (symptoms.includes('vibration') || symptoms.includes('bruit')) {
      suggestions.push({
        issue: 'Problème de roulement ou d\'alignement',
        solution: 'Vérifier les roulements et l\'alignement',
        priority: 'high',
        estimatedTime: 120,
      });
      riskLevel = 'high';
      estimatedCost = 250;
      confidenceScore = 0.7;
    } else if (symptoms.includes('temperature') || symptoms.includes('chauffe')) {
      suggestions.push({
        issue: 'Surchauffe du système',
        solution: 'Vérifier le système de refroidissement',
        priority: 'high',
        estimatedTime: 90,
      });
      riskLevel = 'high';
      estimatedCost = 180;
      confidenceScore = 0.75;
    } else if (symptoms.includes('fuite') || symptoms.includes('huile')) {
      suggestions.push({
        issue: 'Fuite hydraulique',
        solution: 'Inspecter les joints et raccords',
        priority: 'medium',
        estimatedTime: 60,
      });
      estimatedCost = 120;
    } else {
      suggestions.push({
        issue: 'Diagnostic général requis',
        solution: 'Inspection complète recommandée',
        priority: 'medium',
        estimatedTime: 180,
      });
    }

    return {
      suggestions,
      confidenceScore,
      riskLevel,
      estimatedCost,
      insights: [
        'Diagnostic effectué en mode hors ligne',
        'Synchronisation recommandée pour un diagnostic plus précis'
      ],
    };
  }

  async saveDiagnosticOffline(diagnostic: any): Promise<number> {
    if (!this.executeQuery) {
      throw new Error('Database not available');
    }

    const result = await this.executeQuery(`
      INSERT INTO diagnostics (
        equipment_type, equipment_id, symptoms, zone, sector, 
        urgency_level, ml_mode, suggestions, confidence_score, 
        risk_level, estimated_cost, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      diagnostic.equipmentType,
      diagnostic.equipmentId || '',
      JSON.stringify(diagnostic.symptoms),
      diagnostic.zone || '',
      diagnostic.sector || '',
      diagnostic.urgencyLevel,
      diagnostic.mlMode,
      JSON.stringify(diagnostic.suggestions),
      diagnostic.confidenceScore,
      diagnostic.riskLevel,
      diagnostic.estimatedCost,
    ]);

    return result.insertId;
  }

  async getOfflineDiagnostics(): Promise<any[]> {
    if (!this.executeQuery) {
      return [];
    }

    const result = await this.executeQuery(
      'SELECT * FROM diagnostics ORDER BY created_at DESC'
    );

    return result.rows._array.map((row: any) => ({
      ...row,
      symptoms: JSON.parse(row.symptoms || '[]'),
      suggestions: JSON.parse(row.suggestions || '[]'),
    }));
  }

  async saveFeedback(feedback: any): Promise<void> {
    if (!this.executeQuery) {
      throw new Error('Database not available');
    }

    await this.executeQuery(`
      INSERT INTO feedback (
        diagnostic_id, rating, accuracy_rating, time_saved, 
        comments, suggestions, synced
      ) VALUES (?, ?, ?, ?, ?, ?, 0)
    `, [
      feedback.diagnosticId,
      feedback.rating,
      feedback.accuracyRating,
      feedback.timeSaved,
      feedback.comments || '',
      feedback.suggestions || '',
    ]);
  }

  private async cacheData(key: string, data: any): Promise<void> {
    if (!this.executeQuery) return;

    try {
      await this.executeQuery(`
        INSERT OR REPLACE INTO offline_cache (key, data, expires_at) 
        VALUES (?, ?, datetime('now', '+24 hours'))
      `, [key, JSON.stringify(data)]);
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  async getCachedData(key: string): Promise<any> {
    if (!this.executeQuery) return null;

    try {
      const result = await this.executeQuery(
        'SELECT data FROM offline_cache WHERE key = ? AND expires_at > datetime("now")',
        [key]
      );

      if (result.rows.length > 0) {
        return JSON.parse(result.rows._array[0].data);
      }
    } catch (error) {
      console.error('Failed to get cached data:', error);
    }

    return null;
  }
}

export const apiService = new ApiService();

// Hook to initialize the service with context data
export const useApiService = () => {
  const { isOnline } = useOffline();
  const { executeQuery } = useDatabase();

  apiService.setOnlineStatus(isOnline);
  apiService.setDatabaseQuery(executeQuery);

  return apiService;
};