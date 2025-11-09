import AsyncStorage from '@react-native-async-storage/async-storage';
import SQLite from 'react-native-sqlite-storage';
import { DiagnosticRequest, DiagnosticResponse, DiagnosticSuggestion, MaintenanceCase, FeedbackData } from './ApiService';

// Enable SQLite debugging in development
if (__DEV__) {
  SQLite.enablePromise(true);
  SQLite.DEBUG(true);
}

export interface OfflineDiagnosticData {
  id: string;
  request: DiagnosticRequest;
  response: DiagnosticResponse;
  timestamp: string;
  synced: boolean;
}

export interface PendingFeedback extends FeedbackData {
  id: string;
  timestamp: string;
}

export interface PendingDiagnostic extends DiagnosticRequest {
  id: string;
  timestamp: string;
}

export class OfflineStorage {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.db = await SQLite.openDatabase({
        name: 'Maintrix.db',
        location: 'default',
        createFromLocation: 1,
      });

      await this.createTables();
      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tables = [
      // Offline diagnostics table
      `CREATE TABLE IF NOT EXISTS offline_diagnostics (
        id TEXT PRIMARY KEY,
        equipment_type TEXT,
        symptoms TEXT,
        symptoms_checked TEXT,
        urgency TEXT,
        zone TEXT,
        sector TEXT,
        equipment_id TEXT,
        response_data TEXT,
        timestamp TEXT,
        synced INTEGER DEFAULT 0
      )`,

      // Pending feedback table
      `CREATE TABLE IF NOT EXISTS pending_feedback (
        id TEXT PRIMARY KEY,
        session_id INTEGER,
        rating INTEGER,
        helpful INTEGER,
        comments TEXT,
        suggestions_accuracy TEXT,
        timestamp TEXT,
        synced INTEGER DEFAULT 0
      )`,

      // Cached maintenance history
      `CREATE TABLE IF NOT EXISTS cached_history (
        id INTEGER PRIMARY KEY,
        equipment_type TEXT,
        symptoms TEXT,
        diagnosis TEXT,
        solution TEXT,
        estimated_duration INTEGER,
        estimated_cost TEXT,
        created_at TEXT,
        cached_at TEXT
      )`,

      // Equipment types cache
      `CREATE TABLE IF NOT EXISTS equipment_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_name TEXT UNIQUE,
        cached_at TEXT
      )`,

      // Offline diagnostic patterns (for basic ML)
      `CREATE TABLE IF NOT EXISTS diagnostic_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_type TEXT,
        symptoms_pattern TEXT,
        diagnosis TEXT,
        confidence REAL,
        created_at TEXT
      )`,

      // App settings
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      )`
    ];

    for (const table of tables) {
      await this.db.executeSql(table);
    }
  }

  // Diagnostic Methods
  async getOfflineDiagnostic(request: DiagnosticRequest): Promise<DiagnosticResponse | null> {
    if (!this.db) await this.initializeDatabase();

    try {
      // Try to find similar cached diagnostic
      const [results] = await this.db!.executeSql(
        `SELECT * FROM offline_diagnostics 
         WHERE equipment_type = ? AND symptoms LIKE ?
         ORDER BY timestamp DESC LIMIT 1`,
        [request.equipmentType, `%${request.symptoms}%`]
      );

      if (results.rows.length > 0) {
        const cached = results.rows.item(0);
        return JSON.parse(cached.response_data);
      }

      // Fallback to basic pattern matching
      return await this.getBasicOfflineDiagnostic(request);
    } catch (error) {
      console.error('Error getting offline diagnostic:', error);
      return null;
    }
  }

  private async getBasicOfflineDiagnostic(request: DiagnosticRequest): Promise<DiagnosticResponse | null> {
    if (!this.db) return null;

    try {
      const [results] = await this.db.executeSql(
        `SELECT * FROM diagnostic_patterns 
         WHERE equipment_type = ? AND symptoms_pattern LIKE ?
         ORDER BY confidence DESC LIMIT 3`,
        [request.equipmentType, `%${request.symptoms}%`]
      );

      if (results.rows.length === 0) {
        return this.getDefaultOfflineDiagnostic(request);
      }

      const suggestions: DiagnosticSuggestion[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const pattern = results.rows.item(i);
        suggestions.push({
          id: pattern.id,
          diagnosis: pattern.diagnosis,
          solution: `Solution pour ${pattern.diagnosis} (Mode hors-ligne)`,
          confidence: pattern.confidence,
          estimatedDuration: 60,
          estimatedCost: '€100-300',
          riskLevel: 'medium',
          aiInsights: 'Diagnostic basé sur les données hors-ligne stockées localement.',
          equipmentType: request.equipmentType,
          urgency: request.urgency
        });
      }

      return {
        suggestions,
        sessionId: Date.now(),
        mlEnabled: false,
        advancedML: false,
        enhancedML: false,
        ensembleML: false
      };
    } catch (error) {
      console.error('Error in basic offline diagnostic:', error);
      return null;
    }
  }

  private getDefaultOfflineDiagnostic(request: DiagnosticRequest): DiagnosticResponse {
    const defaultSuggestions: DiagnosticSuggestion[] = [
      {
        id: 1,
        diagnosis: 'Diagnostic hors-ligne générique',
        solution: 'Vérification générale recommandée. Reconnectez-vous pour un diagnostic précis.',
        confidence: 0.5,
        estimatedDuration: 30,
        estimatedCost: '€50-150',
        riskLevel: 'low',
        aiInsights: 'Diagnostic de base disponible hors-ligne. Synchronisation recommandée.',
        equipmentType: request.equipmentType,
        urgency: request.urgency
      }
    ];

    return {
      suggestions: defaultSuggestions,
      sessionId: Date.now(),
      mlEnabled: false,
      advancedML: false,
      enhancedML: false,
      ensembleML: false
    };
  }

  async cacheResponse(endpoint: string, data: any): Promise<void> {
    if (!this.db) await this.initializeDatabase();

    try {
      await AsyncStorage.setItem(`cache_${endpoint}`, JSON.stringify({
        data,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error caching response:', error);
    }
  }

  async getOfflineData(endpoint: string): Promise<any | null> {
    try {
      const cached = await AsyncStorage.getItem(`cache_${endpoint}`);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        // Check if cache is less than 24 hours old
        const cacheAge = Date.now() - new Date(parsedCache.timestamp).getTime();
        if (cacheAge < 24 * 60 * 60 * 1000) {
          return parsedCache.data;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting offline data:', error);
      return null;
    }
  }

  // History Methods
  async getOfflineHistory(): Promise<MaintenanceCase[] | null> {
    if (!this.db) await this.initializeDatabase();

    try {
      const [results] = await this.db!.executeSql(
        `SELECT * FROM cached_history ORDER BY created_at DESC LIMIT 50`
      );

      const history: MaintenanceCase[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const item = results.rows.item(i);
        history.push({
          id: item.id,
          equipmentType: item.equipment_type,
          symptoms: item.symptoms,
          diagnosis: item.diagnosis,
          solution: item.solution,
          estimatedDuration: item.estimated_duration,
          estimatedCost: item.estimated_cost,
          createdAt: item.created_at
        });
      }

      return history;
    } catch (error) {
      console.error('Error getting offline history:', error);
      return null;
    }
  }

  async cacheHistory(history: MaintenanceCase[]): Promise<void> {
    if (!this.db) await this.initializeDatabase();

    try {
      // Clear existing cache
      await this.db!.executeSql('DELETE FROM cached_history');

      // Insert new cache
      for (const item of history) {
        await this.db!.executeSql(
          `INSERT INTO cached_history 
           (id, equipment_type, symptoms, diagnosis, solution, estimated_duration, estimated_cost, created_at, cached_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.equipmentType,
            item.symptoms,
            item.diagnosis,
            item.solution,
            item.estimatedDuration,
            item.estimatedCost,
            item.createdAt,
            new Date().toISOString()
          ]
        );
      }
    } catch (error) {
      console.error('Error caching history:', error);
    }
  }

  // Feedback Methods
  async storePendingFeedback(feedback: FeedbackData): Promise<void> {
    if (!this.db) await this.initializeDatabase();

    try {
      const id = `feedback_${Date.now()}`;
      await this.db!.executeSql(
        `INSERT INTO pending_feedback 
         (id, session_id, rating, helpful, comments, suggestions_accuracy, timestamp, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          id,
          feedback.sessionId,
          feedback.rating,
          feedback.helpful ? 1 : 0,
          feedback.comments,
          feedback.suggestionsAccuracy,
          feedback.timestamp
        ]
      );
    } catch (error) {
      console.error('Error storing pending feedback:', error);
    }
  }

  async getPendingFeedback(): Promise<FeedbackData[]> {
    if (!this.db) await this.initializeDatabase();

    try {
      const [results] = await this.db!.executeSql(
        `SELECT * FROM pending_feedback WHERE synced = 0`
      );

      const feedback: FeedbackData[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const item = results.rows.item(i);
        feedback.push({
          sessionId: item.session_id,
          rating: item.rating,
          helpful: item.helpful === 1,
          comments: item.comments,
          suggestionsAccuracy: item.suggestions_accuracy,
          timestamp: item.timestamp
        });
      }

      return feedback;
    } catch (error) {
      console.error('Error getting pending feedback:', error);
      return [];
    }
  }

  async removePendingFeedback(sessionId: number): Promise<void> {
    if (!this.db) await this.initializeDatabase();

    try {
      await this.db!.executeSql(
        `UPDATE pending_feedback SET synced = 1 WHERE session_id = ?`,
        [sessionId]
      );
    } catch (error) {
      console.error('Error removing pending feedback:', error);
    }
  }

  // Diagnostic Methods
  async getPendingDiagnostics(): Promise<PendingDiagnostic[]> {
    if (!this.db) await this.initializeDatabase();

    try {
      const [results] = await this.db!.executeSql(
        `SELECT * FROM offline_diagnostics WHERE synced = 0`
      );

      const diagnostics: PendingDiagnostic[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        const item = results.rows.item(i);
        diagnostics.push({
          id: item.id,
          equipmentType: item.equipment_type,
          symptoms: item.symptoms,
          symptomsChecked: JSON.parse(item.symptoms_checked || '[]'),
          urgency: item.urgency as 'low' | 'medium' | 'high',
          zone: item.zone,
          sector: item.sector,
          equipmentId: item.equipment_id,
          timestamp: item.timestamp
        });
      }

      return diagnostics;
    } catch (error) {
      console.error('Error getting pending diagnostics:', error);
      return [];
    }
  }

  async removePendingDiagnostic(id: string): Promise<void> {
    if (!this.db) await this.initializeDatabase();

    try {
      await this.db!.executeSql(
        `UPDATE offline_diagnostics SET synced = 1 WHERE id = ?`,
        [id]
      );
    } catch (error) {
      console.error('Error removing pending diagnostic:', error);
    }
  }

  // Equipment Types
  async getOfflineEquipmentTypes(): Promise<string[] | null> {
    if (!this.db) await this.initializeDatabase();

    try {
      const [results] = await this.db!.executeSql(
        `SELECT type_name FROM equipment_types ORDER BY type_name`
      );

      const types: string[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        types.push(results.rows.item(i).type_name);
      }

      return types.length > 0 ? types : [
        'moteur', 'pompe', 'compresseur', 'ventilateur', 'transformateur',
        'variateur', 'convertisseur', 'onduleur', 'ups', 'redresseur',
        'sts', 'rtg', 'mobile_crane', 'reach_stacker', 'straddle_carrier', 'spreader'
      ];
    } catch (error) {
      console.error('Error getting offline equipment types:', error);
      return null;
    }
  }

  async cacheEquipmentTypes(types: string[]): Promise<void> {
    if (!this.db) await this.initializeDatabase();

    try {
      // Clear existing cache
      await this.db!.executeSql('DELETE FROM equipment_types');

      // Insert new cache
      for (const type of types) {
        await this.db!.executeSql(
          `INSERT INTO equipment_types (type_name, cached_at) VALUES (?, ?)`,
          [type, new Date().toISOString()]
        );
      }
    } catch (error) {
      console.error('Error caching equipment types:', error);
    }
  }

  // Settings
  async getSetting(key: string): Promise<string | null> {
    if (!this.db) await this.initializeDatabase();

    try {
      const [results] = await this.db!.executeSql(
        `SELECT value FROM app_settings WHERE key = ?`,
        [key]
      );

      return results.rows.length > 0 ? results.rows.item(0).value : null;
    } catch (error) {
      console.error('Error getting setting:', error);
      return null;
    }
  }

  async setSetting(key: string, value: string): Promise<void> {
    if (!this.db) await this.initializeDatabase();

    try {
      await this.db!.executeSql(
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)`,
        [key, value, new Date().toISOString()]
      );
    } catch (error) {
      console.error('Error setting setting:', error);
    }
  }

  // Cleanup Methods
  async clearCache(): Promise<void> {
    if (!this.db) await this.initializeDatabase();

    try {
      await this.db!.executeSql('DELETE FROM cached_history');
      await this.db!.executeSql('DELETE FROM equipment_types');
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  async getStorageInfo(): Promise<{
    pendingFeedback: number;
    pendingDiagnostics: number;
    cachedHistory: number;
    equipmentTypes: number;
  }> {
    if (!this.db) await this.initializeDatabase();

    try {
      const [feedbackResults] = await this.db!.executeSql(
        'SELECT COUNT(*) as count FROM pending_feedback WHERE synced = 0'
      );
      const [diagnosticResults] = await this.db!.executeSql(
        'SELECT COUNT(*) as count FROM offline_diagnostics WHERE synced = 0'
      );
      const [historyResults] = await this.db!.executeSql(
        'SELECT COUNT(*) as count FROM cached_history'
      );
      const [typesResults] = await this.db!.executeSql(
        'SELECT COUNT(*) as count FROM equipment_types'
      );

      return {
        pendingFeedback: feedbackResults.rows.item(0).count,
        pendingDiagnostics: diagnosticResults.rows.item(0).count,
        cachedHistory: historyResults.rows.item(0).count,
        equipmentTypes: typesResults.rows.item(0).count
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return {
        pendingFeedback: 0,
        pendingDiagnostics: 0,
        cachedHistory: 0,
        equipmentTypes: 0
      };
    }
  }
}

export async function initializeOfflineStorage(): Promise<void> {
  try {
    const storage = new OfflineStorage();
    console.log('Offline storage initialized successfully');
  } catch (error) {
    console.error('Failed to initialize offline storage:', error);
  }
}