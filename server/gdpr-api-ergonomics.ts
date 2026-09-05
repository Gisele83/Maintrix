/**
 * 📋 GDPR API ERGONOMICS OPTIMIZATION
 * 
 * Améliorations UX pour les endpoints GDPR :
 * - Réponses streamlined et user-friendly
 * - Statuts clairs et informatifs
 * - Progress tracking export/delete
 * - Notifications temps réel
 * - Interface simplifiée pour utilisateurs
 */

import { Request, Response } from 'express';
import { db } from './db';
import { 
  gdprRequests, 
  userProfiles, 
  auditLogs, 
  dataRetention 
} from '../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

// Types pour l'optimisation GDPR
export interface GDPRRequestStatus {
  id: string;
  type: 'access' | 'portability' | 'deletion' | 'rectification';
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';
  progress: {
    percentage: number;
    currentStep: string;
    estimatedCompletion: Date;
    stepsCompleted: string[];
    stepsRemaining: string[];
  };
  submittedDate: Date;
  lastUpdated: Date;
  statusHistory: Array<{
    status: string;
    timestamp: Date;
    note?: string;
  }>;
  dataTypes: string[];
  estimatedSize?: string;
  downloadReady?: boolean;
  downloadUrl?: string;
  expiresAt?: Date;
}

export interface GDPRUserDashboard {
  userId: number;
  tenantId: string;
  summary: {
    totalRequests: number;
    pendingRequests: number;
    completedRequests: number;
    rejectedRequests: number;
  };
  activeRequests: GDPRRequestStatus[];
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: Date;
    status: 'success' | 'warning' | 'error' | 'info';
  }>;
  userRights: {
    hasAccessRight: boolean;
    hasPortabilityRight: boolean;
    hasDeletionRight: boolean;
    hasRectificationRight: boolean;
    cooldownPeriods: {
      access: number; // days until next request allowed
      portability: number;
      deletion: number;
      rectification: number;
    };
  };
  dataOverview: {
    categoriesStored: string[];
    lastExport?: Date;
    retentionPeriod: number; // days
    scheduledDeletion?: Date;
  };
}

export interface StreamlinedGDPRResponse {
  success: boolean;
  requestId?: string;
  message: string;
  userMessage: string; // Message convivial pour l'utilisateur
  nextSteps?: string[];
  estimatedCompletion?: string;
  supportContact?: string;
  trackingUrl?: string;
  progress?: {
    current: number;
    total: number;
    description: string;
  };
  errors?: Array<{
    field: string;
    message: string;
    suggestion: string;
  }>;
}

// Engine pour les optimisations GDPR
export class GDPRUXOptimizer {
  
  /**
   * Créer une demande GDPR avec expérience utilisateur optimisée
   */
  static async createOptimizedGDPRRequest(
    tenantId: string,
    userId: number,
    requestType: 'access' | 'portability' | 'deletion' | 'rectification',
    userEmail: string,
    additionalData?: any
  ): Promise<StreamlinedGDPRResponse> {
    try {
      // 1. Vérifications préalables avec messages conviviaux
      const validationResult = await this.validateGDPRRequest(tenantId, userId, requestType);
      if (!validationResult.valid) {
        return {
          success: false,
          message: validationResult.technicalMessage,
          userMessage: validationResult.userFriendlyMessage,
          errors: validationResult.errors,
          nextSteps: validationResult.suggestions
        };
      }

      // 2. Créer la demande avec statut initial
      const requestId = `gdpr-${requestType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await db.insert(gdprRequests).values({
        id: requestId,
        tenantId,
        requestType,
        subjectEmail: userEmail,
        subjectUserId: userId,
        status: 'pending',
        requestData: {
          ...additionalData,
          userAgent: 'gdpr-ux-optimizer',
          requestSource: 'user_dashboard',
          automaticProcessing: this.canAutoProcess(requestType)
        },
        requestDate: new Date()
      });

      // 3. Initialiser le suivi de progrès
      await this.initializeProgressTracking(requestId, requestType);

      // 4. Démarrer le traitement automatique si possible
      if (this.canAutoProcess(requestType)) {
        await this.startAutomaticProcessing(requestId, requestType, tenantId, userId);
      }

      // 5. Générer la réponse optimisée
      const estimatedDays = this.getEstimatedProcessingTime(requestType);
      const trackingUrl = `/gdpr/track/${requestId}`;

      return {
        success: true,
        requestId,
        message: `GDPR ${requestType} request created successfully`,
        userMessage: this.getUserFriendlyCreationMessage(requestType),
        nextSteps: this.getNextStepsForUser(requestType),
        estimatedCompletion: `${estimatedDays} jour${estimatedDays > 1 ? 's' : ''}`,
        trackingUrl,
        supportContact: 'support@smartgmao.com',
        progress: {
          current: 1,
          total: this.getTotalSteps(requestType),
          description: 'Demande reçue et en cours de validation'
        }
      };

    } catch (error: any) {
      console.error('GDPR request creation failed:', error);
      return {
        success: false,
        message: `GDPR request creation failed: ${error.message}`,
        userMessage: 'Une erreur est survenue lors de la création de votre demande. Veuillez réessayer ou contacter le support.',
        supportContact: 'support@smartgmao.com',
        nextSteps: [
          'Vérifiez votre connexion internet',
          'Réessayez dans quelques minutes',
          'Contactez le support si le problème persiste'
        ]
      };
    }
  }

  /**
   * Valider une demande GDPR avec messages conviviaux
   */
  private static async validateGDPRRequest(
    tenantId: string,
    userId: number,
    requestType: string
  ): Promise<{
    valid: boolean;
    technicalMessage: string;
    userFriendlyMessage: string;
    errors?: Array<{ field: string; message: string; suggestion: string }>;
    suggestions?: string[];
  }> {
    const errors: Array<{ field: string; message: string; suggestion: string }> = [];

    // Vérifier les périodes de refroidissement
    const cooldownCheck = await this.checkCooldownPeriod(tenantId, userId, requestType);
    if (!cooldownCheck.allowed) {
      return {
        valid: false,
        technicalMessage: `Cooldown period not met: ${cooldownCheck.daysRemaining} days remaining`,
        userFriendlyMessage: `Vous devez attendre encore ${cooldownCheck.daysRemaining} jour${cooldownCheck.daysRemaining > 1 ? 's' : ''} avant de pouvoir faire une nouvelle demande de ce type.`,
        suggestions: [
          'Consultez vos demandes précédentes dans votre tableau de bord',
          'Contactez le support si vous avez des questions urgentes',
          `Vous pourrez refaire une demande le ${cooldownCheck.nextAllowedDate.toLocaleDateString('fr-FR')}`
        ]
      };
    }

    // Vérifier les demandes en cours
    const activeRequests = await db
      .select()
      .from(gdprRequests)
      .where(
        and(
          eq(gdprRequests.tenantId, tenantId),
          eq(gdprRequests.subjectUserId, userId),
          eq(gdprRequests.requestType, requestType),
          sql`status IN ('pending', 'processing')`
        )
      );

    if (activeRequests.length > 0) {
      return {
        valid: false,
        technicalMessage: `Active request exists: ${activeRequests[0].id}`,
        userFriendlyMessage: 'Vous avez déjà une demande en cours de traitement pour ce type de requête.',
        suggestions: [
          'Consultez le statut de votre demande actuelle',
          'Attendez que votre demande actuelle soit traitée',
          'Contactez le support pour des modifications à votre demande existante'
        ]
      };
    }

    return {
      valid: true,
      technicalMessage: 'Validation passed',
      userFriendlyMessage: 'Votre demande peut être traitée'
    };
  }

  /**
   * Vérifier les périodes de refroidissement
   */
  private static async checkCooldownPeriod(
    tenantId: string,
    userId: number,
    requestType: string
  ): Promise<{
    allowed: boolean;
    daysRemaining: number;
    nextAllowedDate: Date;
  }> {
    // Périodes de refroidissement (en jours)
    const cooldownPeriods: Record<string, number> = {
      access: 30,        // 1 mois
      portability: 90,   // 3 mois
      deletion: 365,     // 1 an
      rectification: 30  // 1 mois
    };

    const cooldownDays = cooldownPeriods[requestType] || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cooldownDays);

    const recentRequests = await db
      .select({ requestDate: gdprRequests.requestDate })
      .from(gdprRequests)
      .where(
        and(
          eq(gdprRequests.tenantId, tenantId),
          eq(gdprRequests.subjectUserId, userId),
          eq(gdprRequests.requestType, requestType),
          sql`request_date > ${cutoffDate}`
        )
      )
      .orderBy(desc(gdprRequests.requestDate))
      .limit(1);

    if (recentRequests.length === 0) {
      return {
        allowed: true,
        daysRemaining: 0,
        nextAllowedDate: new Date()
      };
    }

    const lastRequestDate = recentRequests[0].requestDate ?? new Date();
    const nextAllowedDate = new Date(lastRequestDate);
    nextAllowedDate.setDate(nextAllowedDate.getDate() + cooldownDays);
    
    const now = new Date();
    const daysRemaining = Math.ceil((nextAllowedDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    return {
      allowed: daysRemaining <= 0,
      daysRemaining: Math.max(0, daysRemaining),
      nextAllowedDate
    };
  }

  /**
   * Initialiser le suivi de progrès
   */
  private static async initializeProgressTracking(requestId: string, requestType: string): Promise<void> {
    try {
      // Logger l'initialisation dans audit trail
      await db.insert(auditLogs).values({
        tenantId: 'system', // Request system audit
        userId: null,
        action: 'GDPR_REQUEST_INITIALIZED',
        resourceType: 'gdpr_request',
        resourceId: requestId,
        newValues: {
          requestType,
          step: 1,
          totalSteps: this.getTotalSteps(requestType),
          description: 'GDPR request initialized with progress tracking'
        },
        ipAddress: 'system',
        userAgent: 'gdpr-ux-optimizer',
        success: true
      });
    } catch (error) {
      console.error('Failed to initialize progress tracking:', error);
    }
  }

  /**
   * Démarrer le traitement automatique
   */
  private static async startAutomaticProcessing(
    requestId: string,
    requestType: string,
    tenantId: string,
    userId: number
  ): Promise<void> {
    try {
      // Pour les demandes d'accès et de portabilité, démarrer le traitement automatique
      if (requestType === 'access' || requestType === 'portability') {
        // Mettre à jour le statut
        await db
          .update(gdprRequests)
          .set({ 
            status: 'processing',
            processedDate: new Date()
          })
          .where(eq(gdprRequests.id, requestId));

        // Logger le début du traitement
        await this.logProgressUpdate(requestId, 2, 'Traitement automatique démarré');

        // Simuler le traitement (en production, cela serait une tâche en arrière-plan)
        setTimeout(async () => {
          await this.completeAutomaticProcessing(requestId, requestType, tenantId, userId);
        }, 5000); // 5 secondes pour la démo
      }
    } catch (error) {
      console.error('Failed to start automatic processing:', error);
    }
  }

  /**
   * Terminer le traitement automatique
   */
  private static async completeAutomaticProcessing(
    requestId: string,
    requestType: string,
    tenantId: string,
    userId: number
  ): Promise<void> {
    try {
      // Simuler la génération de données
      const responseData = await this.generateResponseData(requestType, tenantId, userId);
      
      // Mettre à jour la demande
      await db
        .update(gdprRequests)
        .set({
          status: 'completed',
          completionDate: new Date(),
          responseData
        })
        .where(eq(gdprRequests.id, requestId));

      // Logger la complétion
      await this.logProgressUpdate(requestId, this.getTotalSteps(requestType), 'Traitement terminé avec succès');

    } catch (error) {
      console.error('Failed to complete automatic processing:', error);
      
      // Marquer comme échec
      await db
        .update(gdprRequests)
        .set({ status: 'rejected' })
        .where(eq(gdprRequests.id, requestId));
    }
  }

  /**
   * Générer les données de réponse
   */
  private static async generateResponseData(
    requestType: string,
    tenantId: string,
    userId: number
  ): Promise<any> {
    const userData = await db
      .select()
      .from(userProfiles)
      .where(
        and(
          eq(userProfiles.tenantId, tenantId),
          eq(userProfiles.id, userId)
        )
      )
      .limit(1);

    if (requestType === 'access' || requestType === 'portability') {
      return {
        userProfile: userData[0] || null,
        dataCategories: [
          'Informations de profil',
          'Données d\'activité',
          'Préférences utilisateur',
          'Historique de connexion'
        ],
        exportFormat: requestType === 'portability' ? 'JSON' : 'Human-readable',
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
        downloadUrl: `/gdpr/download/${userId}/${Date.now()}`
      };
    }

    return {
      requestType,
      processedAt: new Date(),
      affectedRecords: 1
    };
  }

  /**
   * Logger une mise à jour de progrès
   */
  private static async logProgressUpdate(requestId: string, step: number, description: string): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        tenantId: 'system',
        userId: null,
        action: 'GDPR_PROGRESS_UPDATE',
        resourceType: 'gdpr_request',
        resourceId: requestId,
        newValues: {
          step,
          description,
          timestamp: new Date()
        },
        ipAddress: 'system',
        userAgent: 'gdpr-ux-optimizer',
        success: true
      });
    } catch (error) {
      console.error('Failed to log progress update:', error);
    }
  }

  /**
   * Générer le dashboard utilisateur GDPR
   */
  static async generateUserDashboard(tenantId: string, userId: number): Promise<GDPRUserDashboard> {
    try {
      // Récupérer les demandes de l'utilisateur
      const userRequests = await db
        .select()
        .from(gdprRequests)
        .where(
          and(
            eq(gdprRequests.tenantId, tenantId),
            eq(gdprRequests.subjectUserId, userId)
          )
        )
        .orderBy(desc(gdprRequests.requestDate));

      // Calculer les statistiques
      const summary = {
        totalRequests: userRequests.length,
        pendingRequests: userRequests.filter(r => r.status === 'pending' || r.status === 'processing').length,
        completedRequests: userRequests.filter(r => r.status === 'completed').length,
        rejectedRequests: userRequests.filter(r => r.status === 'rejected').length
      };

      // Demandes actives avec progrès
      const activeRequests: GDPRRequestStatus[] = [];
      for (const request of userRequests.filter(r => r.status === 'pending' || r.status === 'processing')) {
        const progress = await this.calculateRequestProgress(request.id);
        activeRequests.push({
          id: request.id,
          type: request.requestType as any,
          status: request.status as any,
          progress,
          submittedDate: request.requestDate ?? new Date(),
          lastUpdated: request.processedDate || request.requestDate || new Date(),
          statusHistory: await this.getStatusHistory(request.id),
          dataTypes: ['Profile', 'Activity', 'Preferences'], // Mock
          downloadReady: request.status === 'completed',
          downloadUrl: request.responseData?.downloadUrl
        });
      }

      // Activité récente
      const recentActivity = await this.getRecentActivity(tenantId, userId);

      // Droits utilisateur et périodes de refroidissement
      const userRights = await this.calculateUserRights(tenantId, userId);

      // Aperçu des données
      const dataOverview = await this.getDataOverview(tenantId, userId);

      return {
        userId,
        tenantId,
        summary,
        activeRequests,
        recentActivity,
        userRights,
        dataOverview
      };

    } catch (error) {
      console.error('Failed to generate GDPR dashboard:', error);
      throw error;
    }
  }

  /**
   * Calculer le progrès d'une demande
   */
  private static async calculateRequestProgress(requestId: string): Promise<GDPRRequestStatus['progress']> {
    // Récupérer les logs de progrès
    const progressLogs = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.resourceId, requestId),
          sql`action IN ('GDPR_REQUEST_INITIALIZED', 'GDPR_PROGRESS_UPDATE')`
        )
      )
      .orderBy(desc(auditLogs.timestamp));

    const latestLog = progressLogs[0];
    const currentStep = latestLog?.newValues?.step || 1;
    const totalSteps = latestLog?.newValues?.totalSteps || 4;
    const currentStepDescription = latestLog?.newValues?.description || 'Traitement en cours';

    // Estimer la date de complétion
    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(estimatedCompletion.getDate() + Math.max(1, totalSteps - currentStep));

    return {
      percentage: Math.round((currentStep / totalSteps) * 100),
      currentStep: currentStepDescription,
      estimatedCompletion,
      stepsCompleted: progressLogs.reverse().map(log => log.newValues?.description || 'Step completed'),
      stepsRemaining: Array.from({ length: totalSteps - currentStep }, (_, i) => `Étape ${currentStep + i + 1}`)
    };
  }

  /**
   * Récupérer l'historique des statuts
   */
  private static async getStatusHistory(requestId: string): Promise<Array<{ status: string; timestamp: Date; note?: string }>> {
    const statusLogs = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.resourceId, requestId),
          sql`action LIKE 'GDPR_%'`
        )
      )
      .orderBy(auditLogs.timestamp);

    return statusLogs.map(log => ({
      status: log.action.replace('GDPR_', '').toLowerCase(),
      timestamp: log.timestamp ?? new Date(),
      note: log.newValues?.description as string | undefined
    }));
  }

  /**
   * Récupérer l'activité récente
   */
  private static async getRecentActivity(tenantId: string, userId: number): Promise<Array<{
    type: string;
    description: string;
    timestamp: Date;
    status: 'success' | 'warning' | 'error' | 'info';
  }>> {
    const activityLogs = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, tenantId),
          eq(auditLogs.userId, userId),
          sql`action LIKE 'GDPR_%'`
        )
      )
      .orderBy(desc(auditLogs.timestamp))
      .limit(10);

    return activityLogs.map(log => ({
      type: log.action,
      description: log.newValues?.description || 'GDPR activity',
      timestamp: log.timestamp ?? new Date(),
      status: (log.success ? 'success' : 'error') as 'success' | 'error'
    }));
  }

  /**
   * Calculer les droits utilisateur
   */
  private static async calculateUserRights(tenantId: string, userId: number): Promise<GDPRUserDashboard['userRights']> {
    const cooldownChecks = await Promise.all([
      this.checkCooldownPeriod(tenantId, userId, 'access'),
      this.checkCooldownPeriod(tenantId, userId, 'portability'),
      this.checkCooldownPeriod(tenantId, userId, 'deletion'),
      this.checkCooldownPeriod(tenantId, userId, 'rectification')
    ]);

    return {
      hasAccessRight: cooldownChecks[0].allowed,
      hasPortabilityRight: cooldownChecks[1].allowed,
      hasDeletionRight: cooldownChecks[2].allowed,
      hasRectificationRight: cooldownChecks[3].allowed,
      cooldownPeriods: {
        access: cooldownChecks[0].daysRemaining,
        portability: cooldownChecks[1].daysRemaining,
        deletion: cooldownChecks[2].daysRemaining,
        rectification: cooldownChecks[3].daysRemaining
      }
    };
  }

  /**
   * Récupérer l'aperçu des données
   */
  private static async getDataOverview(tenantId: string, userId: number): Promise<GDPRUserDashboard['dataOverview']> {
    // Récupérer les informations de rétention
    const retentionInfo = await db
      .select()
      .from(dataRetention)
      .where(
        and(
          eq(dataRetention.tenantId, tenantId),
          eq(dataRetention.resourceId, userId.toString())
        )
      )
      .limit(1);

    const lastExport = await db
      .select({ completionDate: gdprRequests.completionDate })
      .from(gdprRequests)
      .where(
        and(
          eq(gdprRequests.tenantId, tenantId),
          eq(gdprRequests.subjectUserId, userId),
          sql`request_type IN ('access', 'portability')`,
          eq(gdprRequests.status, 'completed')
        )
      )
      .orderBy(desc(gdprRequests.completionDate))
      .limit(1);

    return {
      categoriesStored: [
        'Informations de profil',
        'Données d\'activité',
        'Préférences',
        'Historique de maintenance'
      ],
      lastExport: lastExport[0]?.completionDate || undefined,
      retentionPeriod: retentionInfo[0]?.retentionPeriod || 365,
      scheduledDeletion: retentionInfo[0]?.scheduledDeletion || undefined
    };
  }

  // Méthodes utilitaires
  private static canAutoProcess(requestType: string): boolean {
    return ['access', 'portability'].includes(requestType);
  }

  private static getEstimatedProcessingTime(requestType: string): number {
    const processingTimes: Record<string, number> = {
      access: 3,
      portability: 7,
      deletion: 30,
      rectification: 14
    };
    return processingTimes[requestType] || 7;
  }

  private static getTotalSteps(requestType: string): number {
    const stepCounts: Record<string, number> = {
      access: 4,       // Validation, Extraction, Préparation, Livraison
      portability: 5,  // Validation, Extraction, Formatage, Emballage, Livraison
      deletion: 6,     // Validation, Analyse, Sauvegarde, Suppression, Vérification, Confirmation
      rectification: 3 // Validation, Modification, Confirmation
    };
    return stepCounts[requestType] || 4;
  }

  private static getUserFriendlyCreationMessage(requestType: string): string {
    const messages: Record<string, string> = {
      access: 'Votre demande d\'accès aux données a été reçue avec succès. Nous préparerons un résumé complet de toutes vos informations.',
      portability: 'Votre demande de portabilité des données a été enregistrée. Nous préparerons vos données dans un format facilement réutilisable.',
      deletion: 'Votre demande de suppression des données a été reçue. Nous examinerons soigneusement votre demande conformément à la réglementation.',
      rectification: 'Votre demande de correction des données a été enregistrée. Nous examinerons et corrigerons les informations nécessaires.'
    };
    return messages[requestType] || 'Votre demande GDPR a été reçue et sera traitée dans les délais légaux.';
  }

  private static getNextStepsForUser(requestType: string): string[] {
    const steps: Record<string, string[]> = {
      access: [
        'Surveillez votre email pour les mises à jour',
        'Consultez cette page pour suivre le progrès',
        'Vos données seront disponibles au téléchargement une fois prêtes'
      ],
      portability: [
        'Nous préparerons vos données au format JSON',
        'Vous recevrez un lien de téléchargement sécurisé',
        'Le fichier sera disponible pendant 30 jours'
      ],
      deletion: [
        'Notre équipe examinera votre demande',
        'Nous vérifierons les obligations légales de conservation',
        'Vous recevrez une confirmation une fois la suppression effectuée'
      ],
      rectification: [
        'Préparez les documents justificatifs si nécessaire',
        'Notre équipe vérifiera les modifications demandées',
        'Les corrections seront appliquées dans tous nos systèmes'
      ]
    };
    return steps[requestType] || ['Votre demande sera traitée dans les délais légaux'];
  }
}

// API Routes optimisées pour GDPR
export const optimizedGDPRRoutes = {
  
  /**
   * POST /api/gdpr/request - Créer une demande GDPR optimisée
   */
  async createRequest(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).user?.id;
      const { requestType, userEmail, additionalData } = req.body;
      
      if (!tenantId) {
        return res.status(400).json({ 
          success: false,
          message: 'Tenant ID required',
          userMessage: 'Erreur de configuration. Veuillez vous reconnecter.'
        });
      }
      
      if (!userId) {
        return res.status(401).json({ 
          success: false,
          message: 'Authentication required',
          userMessage: 'Vous devez être connecté pour faire une demande GDPR.'
        });
      }

      const result = await GDPRUXOptimizer.createOptimizedGDPRRequest(
        tenantId,
        userId,
        requestType,
        userEmail,
        additionalData
      );
      
      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      console.error('Failed to create GDPR request:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        userMessage: 'Une erreur technique est survenue. Veuillez réessayer ou contacter le support.',
        supportContact: 'support@smartgmao.com'
      });
    }
  },

  /**
   * GET /api/gdpr/dashboard - Dashboard utilisateur GDPR
   */
  async getDashboard(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).user?.id;
      
      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Tenant ID and User ID required',
          userMessage: 'Erreur d\'authentification. Veuillez vous reconnecter.'
        });
      }

      const dashboard = await GDPRUXOptimizer.generateUserDashboard(tenantId, userId);
      res.json(dashboard);
    } catch (error) {
      console.error('Failed to generate GDPR dashboard:', error);
      res.status(500).json({ 
        error: 'Failed to generate dashboard',
        userMessage: 'Impossible de charger vos informations GDPR. Veuillez réessayer.'
      });
    }
  },

  /**
   * GET /api/gdpr/track/:requestId - Suivre une demande GDPR
   */
  async trackRequest(req: Request, res: Response) {
    try {
      const { requestId } = req.params;
      const tenantId = (req as any).tenantId;
      const userId = (req as any).user?.id;
      
      if (!tenantId || !userId) {
        return res.status(400).json({ 
          error: 'Authentication required',
          userMessage: 'Vous devez être connecté pour suivre votre demande.'
        });
      }

      // Récupérer la demande
      const [request] = await db
        .select()
        .from(gdprRequests)
        .where(
          and(
            eq(gdprRequests.id, requestId),
            eq(gdprRequests.tenantId, tenantId),
            eq(gdprRequests.subjectUserId, userId)
          )
        )
        .limit(1);

      if (!request) {
        return res.status(404).json({ 
          error: 'Request not found',
          userMessage: 'Demande introuvable. Vérifiez l\'ID de votre demande.'
        });
      }

      // Calculer le progrès
      const progress = await GDPRUXOptimizer['calculateRequestProgress'](requestId);
      const statusHistory = await GDPRUXOptimizer['getStatusHistory'](requestId);

      const trackingInfo: GDPRRequestStatus = {
        id: request.id,
        type: request.requestType as any,
        status: request.status as any,
        progress,
        submittedDate: request.requestDate ?? new Date(),
        lastUpdated: request.processedDate || request.requestDate || new Date(),
        statusHistory,
        dataTypes: ['Profile', 'Activity', 'Preferences'],
        downloadReady: request.status === 'completed',
        downloadUrl: request.responseData?.downloadUrl,
        expiresAt: request.responseData?.expiresAt ? new Date(request.responseData.expiresAt) : undefined
      };

      res.json({
        success: true,
        request: trackingInfo,
        userMessage: this.getStatusMessage(request.status ?? 'pending')
      });
    } catch (error: any) {
      console.error('Failed to track GDPR request:', error);
      res.status(500).json({ 
        error: 'Failed to track request',
        userMessage: 'Impossible de récupérer les informations de suivi. Veuillez réessayer.'
      });
    }
  },

  /**
   * GET /api/gdpr/download/:requestId - Télécharger les données
   */
  async downloadData(req: Request, res: Response) {
    try {
      const { requestId } = req.params;
      const tenantId = (req as any).tenantId;
      const userId = (req as any).user?.id;

      // Vérifier la demande
      const [request] = await db
        .select()
        .from(gdprRequests)
        .where(
          and(
            eq(gdprRequests.id, requestId),
            eq(gdprRequests.tenantId, tenantId),
            eq(gdprRequests.subjectUserId, userId),
            eq(gdprRequests.status, 'completed')
          )
        )
        .limit(1);

      if (!request) {
        return res.status(404).json({ 
          error: 'Download not available',
          userMessage: 'Téléchargement non disponible. Vérifiez que votre demande est complétée.'
        });
      }

      // Vérifier l'expiration
      if (request.responseData?.expiresAt && new Date() > new Date(request.responseData.expiresAt)) {
        return res.status(410).json({ 
          error: 'Download expired',
          userMessage: 'Le lien de téléchargement a expiré. Veuillez faire une nouvelle demande.'
        });
      }

      // Générer le fichier de données
      const responseData = request.responseData || {};
      const filename = `gdpr-export-${requestId}-${Date.now()}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json({
        exportInfo: {
          requestId,
          exportDate: new Date(),
          requestType: request.requestType,
          dataIncluded: responseData.dataCategories || []
        },
        userData: responseData.userProfile || {},
        metadata: {
          generatedAt: responseData.generatedAt,
          expiresAt: responseData.expiresAt,
          format: responseData.exportFormat || 'JSON'
        }
      });

    } catch (error) {
      console.error('Failed to download GDPR data:', error);
      res.status(500).json({ 
        error: 'Download failed',
        userMessage: 'Erreur lors du téléchargement. Veuillez réessayer ou contacter le support.'
      });
    }
  },

  // Méthode utilitaire pour les messages de statut
  getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      pending: 'Votre demande a été reçue et est en attente de traitement.',
      processing: 'Votre demande est actuellement en cours de traitement.',
      completed: 'Votre demande a été traitée avec succès.',
      rejected: 'Votre demande n\'a pas pu être traitée. Contactez le support pour plus d\'informations.',
      cancelled: 'Votre demande a été annulée.'
    };
    return messages[status] || 'Statut inconnu';
  }
};
