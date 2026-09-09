import { EventEmitter } from 'events';
import { gmaoStorage } from '../gmao-storage';
import type { 
  InsertSmartNotification,
  SmartNotification,
  UserProfile,
  EquipmentRegistry
} from '@shared/schema';
import { registerBackgroundTask } from "../background-tasks";

interface NotificationRule {
  id: string;
  name: string;
  triggers: {
    type: 'threshold_breach' | 'predictive_alert' | 'maintenance_due' | 'symptom_detected';
    conditions: any;
  }[];
  recipients: {
    roles: string[];
    equipmentTypes?: string[];
    locations?: string[];
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  cooldownMinutes: number;
  escalationRules?: {
    timeoutMinutes: number;
    escalateTo: string[];
  };
}

interface PredictiveAlert {
  equipmentId: number;
  alertType: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  title: string;
  message: string;
  estimatedTimeToFailure?: number;
  actionRequired?: string;
  metadata?: any;
}

export class SmartNotificationEngine extends EventEmitter {
  private notificationRules: NotificationRule[] = [];
  private notificationCooldowns: Map<string, Date> = new Map();
  private userSubscriptions: Map<number, string[]> = new Map(); // userId -> notification types
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.initializeNotificationRules();
  }

  /**
   * Initialize the smart notification engine
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔔 Initializing Smart Notification Engine...');
      
      // Load user preferences and subscriptions
      await this.loadUserSubscriptions();
      
      // Set up periodic cleanup of old notifications
      this.startNotificationCleanup();
      
      this.isInitialized = true;
      console.log('✅ Smart Notification Engine initialized successfully');
      
      this.emit('initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Smart Notification Engine:', error);
      throw error;
    }
  }

  /**
   * Initialize notification rules
   */
  private initializeNotificationRules(): void {
    this.notificationRules = [
      {
        id: 'CRITICAL_THRESHOLD_BREACH',
        name: 'Seuil critique dépassé',
        triggers: [
          {
            type: 'threshold_breach',
            conditions: { severity: 'critical' }
          }
        ],
        recipients: {
          roles: ['maintenance_manager', 'technician_lead', 'operations_manager'],
          equipmentTypes: ['moteur', 'pompe', 'transformateur']
        },
        priority: 'critical',
        cooldownMinutes: 5,
        escalationRules: {
          timeoutMinutes: 15,
          escalateTo: ['plant_manager', 'safety_officer']
        }
      },
      {
        id: 'PREDICTIVE_MAINTENANCE_ALERT',
        name: 'Alerte maintenance prédictive',
        triggers: [
          {
            type: 'predictive_alert',
            conditions: { timeToFailure: { lt: 72 } } // Less than 72 hours
          }
        ],
        recipients: {
          roles: ['maintenance_planner', 'technician_lead'],
          equipmentTypes: ['moteur', 'pompe', 'compresseur']
        },
        priority: 'high',
        cooldownMinutes: 60
      },
      {
        id: 'AUTOMATED_SYMPTOM_DETECTION',
        name: 'Détection automatique de symptômes',
        triggers: [
          {
            type: 'symptom_detected',
            conditions: { confidence: { gt: 0.7 } }
          }
        ],
        recipients: {
          roles: ['technician', 'maintenance_supervisor'],
          equipmentTypes: ['moteur', 'pompe', 'ventilateur']
        },
        priority: 'medium',
        cooldownMinutes: 30
      },
      {
        id: 'OVERDUE_MAINTENANCE',
        name: 'Maintenance en retard',
        triggers: [
          {
            type: 'maintenance_due',
            conditions: { overdueHours: { gt: 24 } }
          }
        ],
        recipients: {
          roles: ['maintenance_manager', 'operations_manager']
        },
        priority: 'high',
        cooldownMinutes: 120
      }
    ];

    console.log(`📋 Loaded ${this.notificationRules.length} smart notification rules`);
  }

  /**
   * Process threshold breach alert
   */
  async processThresholdAlert(alert: any): Promise<void> {
    try {
      const applicableRules = this.findApplicableRules('threshold_breach', alert);
      
      for (const rule of applicableRules) {
        if (this.isOnCooldown(rule.id, alert.equipmentId)) {
          continue;
        }
        
        const recipients = await this.resolveRecipients(rule, alert);
        
        for (const recipient of recipients) {
          const notification: InsertSmartNotification = {
            recipientId: recipient.id,
            equipmentId: alert.equipmentId,
            notificationType: 'threshold_breach',
            severity: this.mapSeverity(alert.severity),
            title: `🚨 ${alert.title}`,
            message: this.enrichMessage(alert.message, alert, recipient),
            actionRequired: this.generateActionRequired(alert, rule),
            estimatedTimeToFailure: alert.estimatedTimeToFailure,
            metadata: {
              originalAlert: alert,
              ruleId: rule.id,
              deviceId: alert.deviceId,
              sensorType: alert.sensorReading?.sensorType,
              threshold: alert.threshold
            }
          };
          
          await this.createNotification(notification);
        }
        
        // Set cooldown
        this.setCooldown(rule.id, alert.equipmentId, rule.cooldownMinutes);
        
        // Schedule escalation if defined
        if (rule.escalationRules) {
          this.scheduleEscalation(rule, alert);
        }
      }
    } catch (error) {
      console.error('Error processing threshold alert:', error);
    }
  }

  /**
   * Process predictive maintenance alert
   */
  async processPredictiveAlert(alert: PredictiveAlert): Promise<void> {
    try {
      const applicableRules = this.findApplicableRules('predictive_alert', alert);
      
      for (const rule of applicableRules) {
        if (this.isOnCooldown(rule.id, alert.equipmentId)) {
          continue;
        }
        
        const recipients = await this.resolveRecipients(rule, alert);
        
        for (const recipient of recipients) {
          const notification: InsertSmartNotification = {
            recipientId: recipient.id,
            equipmentId: alert.equipmentId,
            notificationType: 'predictive_alert',
            severity: alert.severity,
            title: `🔮 ${alert.title}`,
            message: this.enrichMessage(alert.message, alert, recipient),
            actionRequired: alert.actionRequired || this.generatePredictiveAction(alert),
            estimatedTimeToFailure: alert.estimatedTimeToFailure,
            metadata: {
              alertType: alert.alertType,
              ruleId: rule.id,
              prediction: alert.metadata
            }
          };
          
          await this.createNotification(notification);
        }
        
        this.setCooldown(rule.id, alert.equipmentId, rule.cooldownMinutes);
      }
    } catch (error) {
      console.error('Error processing predictive alert:', error);
    }
  }

  /**
   * Process automated symptom detection
   */
  async processSymptomDetection(detection: any): Promise<void> {
    try {
      const applicableRules = this.findApplicableRules('symptom_detected', detection);
      
      for (const rule of applicableRules) {
        if (this.isOnCooldown(rule.id, detection.equipmentId)) {
          continue;
        }
        
        const recipients = await this.resolveRecipients(rule, detection);
        
        for (const recipient of recipients) {
          const notification: InsertSmartNotification = {
            recipientId: recipient.id,
            equipmentId: detection.equipmentId,
            notificationType: 'automated_symptom',
            severity: detection.confidence > 0.8 ? 'critical' : 'warning',
            title: `🎯 Symptôme détecté: ${detection.detectedSymptom}`,
            message: `L'IA a détecté "${detection.detectedSymptom}" avec ${Math.round(detection.confidence * 100)}% de confiance. Algorithme: ${detection.detectionAlgorithm}`,
            actionRequired: `Vérifier l'équipement et confirmer le diagnostic. Conditions détectées: ${detection.details?.map((d: any) => `${d.condition.sensorType} ${d.condition.operator} ${d.condition.value}`).join(', ')}`,
            metadata: {
              detectedSymptom: detection.detectedSymptom,
              symptomCode: detection.symptomCode,
              confidence: detection.confidence,
              algorithm: detection.detectionAlgorithm,
              ruleId: rule.id,
              deviceId: detection.deviceId,
              sensorData: detection.sensorData
            }
          };
          
          await this.createNotification(notification);
        }
        
        this.setCooldown(rule.id, detection.equipmentId, rule.cooldownMinutes);
      }
    } catch (error) {
      console.error('Error processing symptom detection:', error);
    }
  }

  /**
   * Find applicable notification rules for a trigger
   */
  private findApplicableRules(triggerType: string, data: any): NotificationRule[] {
    return this.notificationRules.filter(rule => {
      return rule.triggers.some(trigger => {
        if (trigger.type !== triggerType) return false;
        
        // Check conditions
        if (trigger.conditions) {
          return this.evaluateConditions(trigger.conditions, data);
        }
        
        return true;
      });
    });
  }

  /**
   * Evaluate notification conditions
   */
  private evaluateConditions(conditions: any, data: any): boolean {
    for (const [key, condition] of Object.entries(conditions)) {
      const value = this.getNestedValue(data, key);
      
      if (typeof condition === 'object' && condition !== null) {
        const condObj = condition as any;
        
        if ('gt' in condObj && value <= condObj.gt) return false;
        if ('lt' in condObj && value >= condObj.lt) return false;
        if ('eq' in condObj && value !== condObj.eq) return false;
        if ('in' in condObj && !condObj.in.includes(value)) return false;
      } else {
        if (value !== condition) return false;
      }
    }
    
    return true;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  /**
   * Resolve notification recipients based on rules
   */
  private async resolveRecipients(rule: NotificationRule, data: any): Promise<UserProfile[]> {
    try {
      // Query active users from the database
      let allUsers: UserProfile[] = [];
      try {
        const { db } = await import('../db.js');
        const { userProfiles } = await import('@shared/schema.js');
        const { eq } = await import('drizzle-orm');
        allUsers = await db.select().from(userProfiles).where(eq(userProfiles.isActive, true));
      } catch {
        // DB unavailable — return empty list, no mocks
        return [];
      }

      // Filter recipients based on rule criteria
      return allUsers.filter(user => {
        // Check role match
        if (rule.recipients.roles.length > 0 && !rule.recipients.roles.includes(user.role || '')) {
          return false;
        }

        // Check if user has an email address
        if (!user.email) return false;

        // Check if user is subscribed to this notification type
        const userSubscriptions = this.userSubscriptions.get(user.id) || [];
        if (userSubscriptions.length > 0 && !userSubscriptions.includes(rule.triggers[0].type)) {
          return false;
        }

        return true;
      });
    } catch (error) {
      console.error('Error resolving recipients:', error);
      return [];
    }
  }

  /**
   * Create notification in database
   */
  private async createNotification(notification: InsertSmartNotification): Promise<void> {
    try {
      // Persist to database
      const { db } = await import('../db.js');
      const { smartNotifications } = await import('@shared/schema.js');
      await db.insert(smartNotifications).values(notification);
      console.log(`📢 Smart notification stored: ${notification.title} → user ${notification.recipientId}`);
      // Emit event for real-time updates
      this.emit('notificationCreated', notification);
    } catch (error: any) {
      // Log but don't crash — notification delivery is best-effort
      console.error('Error creating smart notification:', error?.message?.substring(0, 100));
    }
  }

  /**
   * Check if a rule is on cooldown
   */
  private isOnCooldown(ruleId: string, equipmentId: number): boolean {
    const cooldownKey = `${ruleId}_${equipmentId}`;
    const lastTriggered = this.notificationCooldowns.get(cooldownKey);
    
    if (!lastTriggered) return false;
    
    const now = new Date();
    const timeDiff = (now.getTime() - lastTriggered.getTime()) / (1000 * 60); // minutes
    
    return timeDiff < (this.notificationRules.find(r => r.id === ruleId)?.cooldownMinutes || 0);
  }

  /**
   * Set cooldown for a rule
   */
  private setCooldown(ruleId: string, equipmentId: number, minutes: number): void {
    const cooldownKey = `${ruleId}_${equipmentId}`;
    this.notificationCooldowns.set(cooldownKey, new Date());
    
    // Auto-remove cooldown after the specified time
    setTimeout(() => {
      this.notificationCooldowns.delete(cooldownKey);
    }, minutes * 60 * 1000);
  }

  /**
   * Schedule escalation for unacknowledged notifications
   */
  private scheduleEscalation(rule: NotificationRule, alert: any): void {
    if (!rule.escalationRules) return;
    const escalationRules = rule.escalationRules;

    setTimeout(async () => {
      // Check if alert was acknowledged
      const wasAcknowledged = await this.checkIfAcknowledged(rule.id, alert.equipmentId);

      if (!wasAcknowledged) {
        console.log(`⬆️ Escalating alert: ${alert.title}`);

        // Create escalated notifications
        for (const escalateToRole of escalationRules.escalateTo) {
          const escalationAlert = {
            ...alert,
            title: `ESCALÉ: ${alert.title}`,
            message: `ALERTE ESCALÉE - Non traitée après ${escalationRules.timeoutMinutes} minutes: ${alert.message}`,
            severity: 'critical'
          };
          
          // Process as new alert with escalated recipients
          // Implementation would create notifications for escalateToRole users
        }
      }
    }, rule.escalationRules.timeoutMinutes * 60 * 1000);
  }

  /**
   * Check if an alert was acknowledged
   */
  private async checkIfAcknowledged(ruleId: string, equipmentId: number): Promise<boolean> {
    try {
      // In a real implementation, check database for acknowledged notifications
      return false; // Default to not acknowledged for demo
    } catch (error) {
      console.error('Error checking acknowledgment:', error);
      return false;
    }
  }

  /**
   * Map severity levels
   */
  private mapSeverity(severity: string): 'info' | 'warning' | 'critical' | 'emergency' {
    const mapping: { [key: string]: 'info' | 'warning' | 'critical' | 'emergency' } = {
      'normal': 'info',
      'warning': 'warning',
      'critical': 'critical',
      'emergency': 'emergency'
    };
    return mapping[severity] || 'warning';
  }

  /**
   * Enrich notification message with context
   */
  private enrichMessage(baseMessage: string, alert: any, recipient: UserProfile): string {
    const enrichments = [
      baseMessage,
      `\n📍 Destinataire: ${[recipient.firstName, recipient.lastName].filter(Boolean).join(' ') || recipient.username} (${recipient.department})`,
      alert.metadata?.deviceId ? `\n🔧 Capteur: ${alert.metadata.deviceId}` : '',
      alert.estimatedTimeToFailure ? `\n⏰ Temps estimé avant défaillance: ${alert.estimatedTimeToFailure}h` : ''
    ];
    
    return enrichments.filter(Boolean).join('');
  }

  /**
   * Generate action required text
   */
  private generateActionRequired(alert: any, rule: NotificationRule): string {
    const actions = [
      'Inspecter immédiatement l\'équipement',
      'Vérifier les conditions de fonctionnement',
      'Consulter l\'historique de maintenance',
      'Planifier une intervention si nécessaire'
    ];
    
    if (alert.severity === 'critical') {
      actions.unshift('ARRÊT ÉQUIPEMENT RECOMMANDÉ');
    }
    
    return actions.join(' • ');
  }

  /**
   * Generate predictive maintenance action
   */
  private generatePredictiveAction(alert: PredictiveAlert): string {
    const timeToFailure = alert.estimatedTimeToFailure || 0;
    
    if (timeToFailure < 24) {
      return 'URGENT: Planifier maintenance immédiate • Préparer pièces de rechange • Organiser intervention';
    } else if (timeToFailure < 72) {
      return 'Planifier maintenance dans les 24-48h • Vérifier disponibilité pièces • Préparer intervention';
    } else {
      return 'Planifier maintenance préventive • Commander pièces si nécessaire • Programmer intervention';
    }
  }

  /**
   * Load user notification subscriptions
   */
  private async loadUserSubscriptions(): Promise<void> {
    try {
      // In a real implementation, load from database
      // For now, set default subscriptions
      this.userSubscriptions.set(1, ['threshold_breach', 'predictive_alert', 'maintenance_due']);
      this.userSubscriptions.set(2, ['threshold_breach', 'symptom_detected']);
      
      console.log(`👥 Loaded ${this.userSubscriptions.size} user notification subscriptions`);
    } catch (error) {
      console.error('Error loading user subscriptions:', error);
    }
  }

  /**
   * Start periodic cleanup of old notifications
   */
  private startNotificationCleanup(): void {
    // Clean up every hour
    // Tâche C-4 — la promesse de cleanupOldNotifications() était « flottante » :
    // non attendue et non interceptée au point d'appel. Le superviseur l'attend.
    registerBackgroundTask({
      name: 'notifications:cleanup',
      intervalMs: 60 * 60 * 1000,
      criticality: 'C',
      run: () => this.cleanupOldNotifications(),
    });
    
    console.log('🧹 Started periodic notification cleanup');
  }

  /**
   * Clean up old notifications and cooldowns
   */
  private async cleanupOldNotifications(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      // Clean up cooldowns older than 24 hours
      const cooldownCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      for (const [key, date] of this.notificationCooldowns.entries()) {
        if (date < cooldownCutoff) {
          this.notificationCooldowns.delete(key);
        }
      }
      
      console.log('🧹 Cleaned up old notifications and cooldowns');
    } catch (error) {
      console.error('Error during notification cleanup:', error);
    }
  }

  /**
   * Get notification statistics
   */
  getNotificationStats(): any {
    return {
      rulesCount: this.notificationRules.length,
      activeCooldowns: this.notificationCooldowns.size,
      userSubscriptions: this.userSubscriptions.size,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Subscribe user to notification types
   */
  subscribeUser(userId: number, notificationTypes: string[]): void {
    this.userSubscriptions.set(userId, notificationTypes);
    console.log(`📧 User ${userId} subscribed to: ${notificationTypes.join(', ')}`);
  }

  /**
   * Unsubscribe user from notification types
   */
  unsubscribeUser(userId: number, notificationTypes: string[]): void {
    const currentSubscriptions = this.userSubscriptions.get(userId) || [];
    const updatedSubscriptions = currentSubscriptions.filter(type => 
      !notificationTypes.includes(type)
    );
    
    this.userSubscriptions.set(userId, updatedSubscriptions);
    console.log(`📧 User ${userId} unsubscribed from: ${notificationTypes.join(', ')}`);
  }
}

// Export singleton instance
export const smartNotificationEngine = new SmartNotificationEngine();