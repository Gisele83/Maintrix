import axios, { AxiosInstance, AxiosResponse } from 'axios';
import NetInfo from '@react-native-netinfo/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineStorage } from './OfflineStorage';

export interface DiagnosticRequest {
  equipmentType: string;
  symptoms: string;
  symptomsChecked: string[];
  urgency: 'low' | 'medium' | 'high';
  zone?: string;
  sector?: string;
  equipmentId?: string;
  advancedMode?: boolean;
  enhancedMode?: boolean;
  ensembleMode?: boolean;
}

export interface DiagnosticSuggestion {
  id: number;
  diagnosis: string;
  solution: string;
  confidence: number;
  estimatedDuration: number;
  estimatedCost: string;
  riskLevel: string;
  aiInsights: string;
  equipmentType: string;
  urgency: string;
  mlMetrics?: {
    neuralNetwork?: number;
    svm?: number;
    anomalyScore?: number;
    ensembleAgreement?: number;
  };
}

export interface DiagnosticResponse {
  suggestions: DiagnosticSuggestion[];
  sessionId: number;
  mlEnabled: boolean;
  advancedML: boolean;
  enhancedML: boolean;
  ensembleML: boolean;
}

export interface MaintenanceCase {
  id: number;
  equipmentType: string;
  symptoms: string;
  diagnosis: string;
  solution: string;
  estimatedDuration: number;
  estimatedCost: string;
  createdAt: string;
}

export interface FeedbackData {
  sessionId: number;
  rating: number;
  helpful: boolean | null;
  comments: string;
  suggestionsAccuracy: string;
  timestamp: string;
}

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;
  private offlineStorage: OfflineStorage;

  constructor() {
    // Default to localhost for development, can be configured
    this.baseURL = __DEV__ ? 'http://localhost:5000' : 'https://your-production-api.com';
    this.offlineStorage = new OfflineStorage();
    
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for offline handling
    this.api.interceptors.request.use(
      async (config) => {
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) {
          throw new Error('NO_INTERNET');
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.message === 'NO_INTERNET' || error.code === 'NETWORK_ERROR') {
          // Try to get data from offline storage
          const offlineData = await this.offlineStorage.getOfflineData(error.config.url);
          if (offlineData) {
            return { data: offlineData };
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Set base URL for production
  setBaseURL(url: string): void {
    this.baseURL = url;
    this.api.defaults.baseURL = url;
  }

  // Diagnostic Methods
  async getDiagnostic(request: DiagnosticRequest): Promise<DiagnosticResponse> {
    try {
      const response: AxiosResponse<DiagnosticResponse> = await this.api.post(
        '/api/diagnostic',
        request
      );
      
      // Cache successful response for offline use
      await this.offlineStorage.cacheResponse('/api/diagnostic', response.data);
      
      return response.data;
    } catch (error: any) {
      if (error.message === 'NO_INTERNET') {
        // Try to get offline diagnostic
        const offlineResult = await this.offlineStorage.getOfflineDiagnostic(request);
        if (offlineResult) {
          return offlineResult;
        }
      }
      throw error;
    }
  }

  // History Methods
  async getHistory(): Promise<MaintenanceCase[]> {
    try {
      const response: AxiosResponse<MaintenanceCase[]> = await this.api.get('/api/history');
      
      // Cache history for offline use
      await this.offlineStorage.cacheResponse('/api/history', response.data);
      
      return response.data;
    } catch (error: any) {
      if (error.message === 'NO_INTERNET') {
        const offlineHistory = await this.offlineStorage.getOfflineHistory();
        if (offlineHistory) {
          return offlineHistory;
        }
      }
      throw error;
    }
  }

  // Feedback Methods
  async submitFeedback(feedbackData: FeedbackData): Promise<void> {
    try {
      await this.api.post('/api/feedback', feedbackData);
    } catch (error: any) {
      if (error.message === 'NO_INTERNET') {
        // Store feedback for later sync
        await this.offlineStorage.storePendingFeedback(feedbackData);
      } else {
        throw error;
      }
    }
  }

  // Sync Methods
  async syncOfflineData(): Promise<void> {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      throw new Error('No internet connection for sync');
    }

    // Sync pending feedback
    const pendingFeedback = await this.offlineStorage.getPendingFeedback();
    for (const feedback of pendingFeedback) {
      try {
        await this.api.post('/api/feedback', feedback);
        await this.offlineStorage.removePendingFeedback(feedback.sessionId);
      } catch (error) {
        console.error('Failed to sync feedback:', error);
      }
    }

    // Sync pending diagnostics
    const pendingDiagnostics = await this.offlineStorage.getPendingDiagnostics();
    for (const diagnostic of pendingDiagnostics) {
      try {
        await this.api.post('/api/diagnostic', diagnostic);
        await this.offlineStorage.removePendingDiagnostic(diagnostic.id);
      } catch (error) {
        console.error('Failed to sync diagnostic:', error);
      }
    }
  }

  // Equipment Methods
  async getEquipmentTypes(): Promise<string[]> {
    try {
      const response: AxiosResponse<string[]> = await this.api.get('/api/equipment-types');
      await this.offlineStorage.cacheResponse('/api/equipment-types', response.data);
      return response.data;
    } catch (error: any) {
      if (error.message === 'NO_INTERNET') {
        const offlineTypes = await this.offlineStorage.getOfflineEquipmentTypes();
        if (offlineTypes) {
          return offlineTypes;
        }
      }
      throw error;
    }
  }

  // ML Training Methods
  async trainML(): Promise<void> {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      throw new Error('Internet connection required for ML training');
    }
    
    await this.api.post('/api/train-ml');
  }

  // Network status
  async isOnline(): Promise<boolean> {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected ?? false;
  }

  // Configuration
  async getServerConfig(): Promise<any> {
    try {
      const response = await this.api.get('/api/config');
      return response.data;
    } catch (error) {
      return null;
    }
  }
}

export const apiService = new ApiService();