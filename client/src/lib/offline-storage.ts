/**
 * Système de stockage offline pour Maintrix
 * Gère la synchronisation des données entre mode online et offline
 */

interface OfflineData {
  equipment: any[];
  maintenanceCases: any[];
  diagnosticSessions: any[];
  workOrders: any[];
  userProfile: any;
  lastSync: number;
}

interface PendingAction {
  id: string;
  type: 'diagnostic' | 'work_order' | 'equipment_update';
  data: any;
  timestamp: number;
  retryCount: number;
}

class OfflineStorageManager {
  private readonly STORAGE_KEY = 'gmao_offline_data';
  private readonly PENDING_ACTIONS_KEY = 'gmao_pending_actions';
  private readonly MAX_RETRY_COUNT = 3;

  /**
   * Vérifie si l'application est en mode offline
   */
  isOffline(): boolean {
    return !navigator.onLine;
  }

  /**
   * Sauvegarde des données pour utilisation offline
   */
  async saveOfflineData(data: Partial<OfflineData>): Promise<void> {
    try {
      const existingData = this.getOfflineData();
      const updatedData = {
        ...existingData,
        ...data,
        lastSync: Date.now()
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedData));
      console.log('✅ Données sauvegardées pour utilisation offline');
    } catch (error) {
      console.error('❌ Erreur sauvegarde offline:', error);
    }
  }

  /**
   * Récupère les données offline
   */
  getOfflineData(): OfflineData {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('❌ Erreur lecture données offline:', error);
    }

    return {
      equipment: [],
      maintenanceCases: [],
      diagnosticSessions: [],
      workOrders: [],
      userProfile: null,
      lastSync: 0
    };
  }

  /**
   * Ajoute une action en attente de synchronisation
   */
  addPendingAction(action: Omit<PendingAction, 'id' | 'timestamp' | 'retryCount'>): void {
    try {
      const actions = this.getPendingActions();
      const newAction: PendingAction = {
        ...action,
        id: `${action.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0
      };

      actions.push(newAction);
      localStorage.setItem(this.PENDING_ACTIONS_KEY, JSON.stringify(actions));
      console.log(`📝 Action ajoutée en attente: ${newAction.type}`);
    } catch (error) {
      console.error('❌ Erreur ajout action pendante:', error);
    }
  }

  /**
   * Récupère les actions en attente
   */
  getPendingActions(): PendingAction[] {
    try {
      const data = localStorage.getItem(this.PENDING_ACTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ Erreur lecture actions pendantes:', error);
      return [];
    }
  }

  /**
   * Supprime une action en attente
   */
  removePendingAction(actionId: string): void {
    try {
      const actions = this.getPendingActions().filter(a => a.id !== actionId);
      localStorage.setItem(this.PENDING_ACTIONS_KEY, JSON.stringify(actions));
    } catch (error) {
      console.error('❌ Erreur suppression action pendante:', error);
    }
  }

  /**
   * Synchronise les actions en attente quand la connexion revient
   */
  async syncPendingActions(): Promise<void> {
    if (this.isOffline()) {
      console.log('⚠️ Toujours offline, synchronisation reportée');
      return;
    }

    const actions = this.getPendingActions();
    console.log(`🔄 Synchronisation de ${actions.length} actions en attente`);

    for (const action of actions) {
      try {
        await this.processPendingAction(action);
        this.removePendingAction(action.id);
        console.log(`✅ Action synchronisée: ${action.type}`);
      } catch (error) {
        console.error(`❌ Erreur synchronisation action ${action.id}:`, error);
        
        // Incrémenter le compteur de retry
        action.retryCount++;
        if (action.retryCount >= this.MAX_RETRY_COUNT) {
          console.warn(`⚠️ Action abandonnée après ${this.MAX_RETRY_COUNT} tentatives:`, action.id);
          this.removePendingAction(action.id);
        } else {
          // Sauvegarder avec le nouveau compteur
          const updatedActions = this.getPendingActions().map(a => 
            a.id === action.id ? action : a
          );
          localStorage.setItem(this.PENDING_ACTIONS_KEY, JSON.stringify(updatedActions));
        }
      }
    }
  }

  /**
   * Traite une action en attente
   */
  private async processPendingAction(action: PendingAction): Promise<void> {
    const apiRequest = (await import('./queryClient')).apiRequest;
    
    switch (action.type) {
      case 'diagnostic':
        await apiRequest('POST', '/api/diagnostic-sessions', action.data);
        break;
      case 'work_order':
        await apiRequest('POST', '/api/work-orders', action.data);
        break;
      case 'equipment_update':
        await apiRequest('PUT', `/api/equipment/${action.data.id}`, action.data);
        break;
      default:
        throw new Error(`Type d'action non supporté: ${action.type}`);
    }
  }

  /**
   * Recherche offline dans les équipements
   */
  searchOfflineEquipment(query: string): any[] {
    const data = this.getOfflineData();
    if (!query.trim()) return data.equipment;

    const lowerQuery = query.toLowerCase();
    return data.equipment.filter(equipment => 
      equipment.name?.toLowerCase().includes(lowerQuery) ||
      equipment.equipmentId?.toLowerCase().includes(lowerQuery) ||
      equipment.type?.toLowerCase().includes(lowerQuery) ||
      equipment.location?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Recherche offline dans les cas de maintenance
   */
  searchOfflineMaintenanceCases(equipmentType?: string, symptoms?: string): any[] {
    const data = this.getOfflineData();
    let cases = data.maintenanceCases;

    if (equipmentType) {
      cases = cases.filter(c => 
        c.equipmentType?.toLowerCase().includes(equipmentType.toLowerCase())
      );
    }

    if (symptoms) {
      const lowerSymptoms = symptoms.toLowerCase();
      cases = cases.filter(c => 
        c.symptoms?.toLowerCase().includes(lowerSymptoms) ||
        c.diagnosis?.toLowerCase().includes(lowerSymptoms)
      );
    }

    return cases;
  }

  /**
   * Diagnostic offline basique basé sur les cas historiques
   */
  performOfflineDiagnosis(equipmentType: string, symptoms: string): any {
    const cases = this.searchOfflineMaintenanceCases(equipmentType, symptoms);
    
    if (cases.length === 0) {
      return {
        diagnosis: 'Aucun cas similaire trouvé offline',
        confidence: 0,
        recommendations: ['Vérifier les connexions de base', 'Documenter les symptômes pour analyse en ligne'],
        isOffline: true
      };
    }

    // Algorithme de matching simple basé sur la correspondance des mots-clés
    const symptomWords = symptoms.toLowerCase().split(/\s+/);
    const scoredCases = cases.map(case_ => {
      const caseSymptoms = case_.symptoms.toLowerCase();
      const matchCount = symptomWords.filter(word => 
        caseSymptoms.includes(word)
      ).length;
      
      return {
        ...case_,
        matchScore: matchCount / symptomWords.length
      };
    }).sort((a, b) => b.matchScore - a.matchScore);

    const bestMatch = scoredCases[0];
    const confidence = Math.min(bestMatch.matchScore * 0.8, 0.9); // Max 90% en offline

    return {
      diagnosis: bestMatch.diagnosis,
      solution: bestMatch.solution,
      confidence: confidence,
      recommendations: [
        bestMatch.solution,
        'Confirmer le diagnostic en ligne dès que possible',
        'Documenter toutes les actions effectuées'
      ],
      isOffline: true,
      similarCases: scoredCases.slice(0, 3)
    };
  }

  /**
   * Nettoie les données anciennes
   */
  cleanupOldData(maxAgeHours: number = 72): void {
    try {
      const data = this.getOfflineData();
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
      
      if (data.lastSync < cutoffTime) {
        console.log('🧹 Nettoyage des données offline anciennes');
        localStorage.removeItem(this.STORAGE_KEY);
      }

      // Nettoyer les actions en attente très anciennes
      const actions = this.getPendingActions().filter(
        action => action.timestamp > cutoffTime
      );
      localStorage.setItem(this.PENDING_ACTIONS_KEY, JSON.stringify(actions));
    } catch (error) {
      console.error('❌ Erreur nettoyage données:', error);
    }
  }

  /**
   * Obtient les statistiques du stockage offline
   */
  getStorageStats(): any {
    const data = this.getOfflineData();
    const actions = this.getPendingActions();
    
    return {
      equipmentCount: data.equipment.length,
      maintenanceCasesCount: data.maintenanceCases.length,
      diagnosticSessionsCount: data.diagnosticSessions.length,
      workOrdersCount: data.workOrders.length,
      pendingActionsCount: actions.length,
      lastSyncDate: new Date(data.lastSync),
      isOffline: this.isOffline()
    };
  }
}

export const offlineStorage = new OfflineStorageManager();

// Écouter les changements de connectivité
window.addEventListener('online', () => {
  console.log('🌐 Connexion rétablie - Démarrage de la synchronisation');
  offlineStorage.syncPendingActions();
});

window.addEventListener('offline', () => {
  console.log('📱 Mode offline activé');
});

// Nettoyage périodique
setInterval(() => {
  offlineStorage.cleanupOldData();
}, 60 * 60 * 1000); // Toutes les heures