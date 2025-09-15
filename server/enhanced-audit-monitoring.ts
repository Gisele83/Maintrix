/**
 * 🔒 ENHANCED AUDIT & MONITORING SYSTEM
 * 
 * Système d'audit et monitoring renforcé avec :
 * - Métriques de sécurité temps réel
 * - Détection d'anomalies avancée
 * - Alertes critiques automatiques
 * - Conformité GDPR audit trail
 * - Dashboard de sécurité temps réel
 */

import { Request, Response } from 'express';
import { db } from './db';
import { 
  auditLogs, 
  userSessions, 
  rateLimits, 
  tenants,
  userProfiles 
} from '../shared/schema';
import { eq, and, gte, lte, desc, count, sql } from 'drizzle-orm';
import { z } from 'zod';

// Types pour le monitoring avancé
export interface SecurityMetrics {
  totalEvents: number;
  failedLogins: number;
  suspiciousActivity: number;
  rateLimitViolations: number;
  dataExports: number;
  highRiskActions: number;
  tenantIsolationViolations: number;
  gdprRequests: number;
  averageResponseTime: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

export interface TenantSecurityDashboard {
  tenantId: string;
  securityScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  activeThreats: number;
  recentAlerts: SecurityAlert[];
  complianceStatus: {
    gdpr: boolean;
    dataRetention: boolean;
    auditTrail: boolean;
    encryption: boolean;
  };
  metrics: SecurityMetrics;
}

export interface SecurityAlert {
  id: string;
  tenantId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: 'authentication' | 'authorization' | 'data_access' | 'system' | 'compliance';
  title: string;
  description: string;
  source: string;
  timestamp: Date;
  isResolved: boolean;
  resolvedBy?: number;
  resolvedAt?: Date;
  affectedUsers?: number[];
  impact: 'none' | 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  userId?: number;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
  riskScore: number;
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  compliance: {
    gdprRelevant: boolean;
    auditRequired: boolean;
    retentionPeriod: number; // days
  };
}

// Système d'alertes sécurité temps réel
export class SecurityAlertEngine {
  private static alerts: Map<string, SecurityAlert> = new Map();
  private static subscribers: Map<string, (alert: SecurityAlert) => void> = new Map();

  /**
   * Génère une alerte de sécurité
   */
  static async generateAlert(
    tenantId: string,
    severity: SecurityAlert['severity'],
    type: SecurityAlert['type'],
    title: string,
    description: string,
    source: string,
    impact: SecurityAlert['impact'] = 'medium',
    affectedUsers: number[] = [],
    recommendations: string[] = []
  ): Promise<SecurityAlert> {
    const alert: SecurityAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      severity,
      type,
      title,
      description,
      source,
      timestamp: new Date(),
      isResolved: false,
      affectedUsers,
      impact,
      recommendations
    };

    // Stocker l'alerte
    this.alerts.set(alert.id, alert);

    // Logger l'alerte dans audit trail
    await this.logSecurityAlert(alert);

    // Notifier les abonnés
    this.notifySubscribers(alert);

    // Actions automatiques pour alertes critiques
    if (severity === 'critical' || impact === 'critical') {
      await this.handleCriticalAlert(alert);
    }

    return alert;
  }

  /**
   * Log sécurisé des alertes
   */
  private static async logSecurityAlert(alert: SecurityAlert): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        tenantId: alert.tenantId,
        userId: null, // System-generated
        action: 'SECURITY_ALERT',
        resourceType: 'security_alert',
        resourceId: alert.id,
        newValues: {
          severity: alert.severity,
          type: alert.type,
          title: alert.title,
          description: alert.description,
          impact: alert.impact,
          recommendations: alert.recommendations
        },
        ipAddress: 'system',
        userAgent: 'security-monitoring-system',
        success: true
      });
    } catch (error) {
      console.error('Failed to log security alert:', error);
    }
  }

  /**
   * Gestion automatique des alertes critiques
   */
  private static async handleCriticalAlert(alert: SecurityAlert): Promise<void> {
    console.log(`🚨 CRITICAL SECURITY ALERT: ${alert.title}`);
    console.log(`📍 Tenant: ${alert.tenantId}`);
    console.log(`📝 Description: ${alert.description}`);
    console.log(`⚡ Impact: ${alert.impact}`);
    
    // Actions automatiques selon le type
    switch (alert.type) {
      case 'authentication':
        await this.handleAuthenticationThreat(alert);
        break;
      case 'data_access':
        await this.handleDataAccessThreat(alert);
        break;
      case 'system':
        await this.handleSystemThreat(alert);
        break;
    }
  }

  private static async handleAuthenticationThreat(alert: SecurityAlert): Promise<void> {
    // Révoquer les sessions actives si nécessaire
    if (alert.affectedUsers && alert.affectedUsers.length > 0) {
      try {
        await db.execute(sql`
          UPDATE user_sessions 
          SET is_active = false, 
              terminated_reason = 'security_threat',
              terminated_at = NOW()
          WHERE user_id = ANY(${alert.affectedUsers}) 
          AND tenant_id = ${alert.tenantId}
          AND is_active = true
        `);
        
        console.log(`🔒 Revoked sessions for ${alert.affectedUsers.length} users`);
      } catch (error) {
        console.error('Failed to revoke sessions:', error);
      }
    }
  }

  private static async handleDataAccessThreat(alert: SecurityAlert): Promise<void> {
    // Logger l'accès suspect
    console.log(`🔍 Data access threat detected: ${alert.description}`);
    // Actions supplémentaires selon les besoins
  }

  private static async handleSystemThreat(alert: SecurityAlert): Promise<void> {
    // Actions système selon la menace
    console.log(`⚠️ System threat detected: ${alert.description}`);
  }

  /**
   * Notifier les abonnés aux alertes
   */
  private static notifySubscribers(alert: SecurityAlert): void {
    this.subscribers.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Failed to notify alert subscriber:', error);
      }
    });
  }

  /**
   * S'abonner aux alertes sécurité
   */
  static subscribe(tenantId: string, callback: (alert: SecurityAlert) => void): string {
    const subscriptionId = `sub-${tenantId}-${Date.now()}`;
    this.subscribers.set(subscriptionId, callback);
    return subscriptionId;
  }

  /**
   * Se désabonner des alertes
   */
  static unsubscribe(subscriptionId: string): void {
    this.subscribers.delete(subscriptionId);
  }

  /**
   * Récupérer les alertes actives d'un tenant
   */
  static getActiveAlerts(tenantId: string): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.tenantId === tenantId && !alert.isResolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Résoudre une alerte
   */
  static async resolveAlert(alertId: string, resolvedBy: number): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.isResolved = true;
    alert.resolvedBy = resolvedBy;
    alert.resolvedAt = new Date();

    // Logger la résolution
    await db.insert(auditLogs).values({
      tenantId: alert.tenantId,
      userId: resolvedBy,
      action: 'RESOLVE_SECURITY_ALERT',
      resourceType: 'security_alert',
      resourceId: alertId,
      newValues: { resolved: true, resolvedBy, resolvedAt: alert.resolvedAt },
      ipAddress: 'system',
      userAgent: 'security-monitoring-system',
      success: true
    });

    return true;
  }
}

// Système de métriques de sécurité temps réel
export class SecurityMetricsEngine {
  
  /**
   * Calculer les métriques de sécurité pour un tenant
   */
  static async calculateSecurityMetrics(
    tenantId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<SecurityMetrics> {
    try {
      const { start, end } = timeRange;

      // 1. Total des événements d'audit
      const [totalEventsResult] = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.tenantId, tenantId),
            gte(auditLogs.timestamp, start),
            lte(auditLogs.timestamp, end)
          )
        );
      
      // 2. Échecs de connexion
      const [failedLoginsResult] = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.tenantId, tenantId),
            eq(auditLogs.action, 'LOGIN'),
            eq(auditLogs.success, false),
            gte(auditLogs.timestamp, start),
            lte(auditLogs.timestamp, end)
          )
        );

      // 3. Activités suspectes (rate limiting, accès non autorisés)
      const [suspiciousResult] = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.tenantId, tenantId),
            eq(auditLogs.success, false),
            gte(auditLogs.timestamp, start),
            lte(auditLogs.timestamp, end)
          )
        );

      // 4. Violations de rate limiting
      const [rateLimitResult] = await db
        .select({ count: count() })
        .from(rateLimits)
        .where(
          and(
            eq(rateLimits.identifier, tenantId),
            eq(rateLimits.isBlocked, true),
            gte(rateLimits.windowStart, start),
            lte(rateLimits.windowStart, end)
          )
        );

      // 5. Exports de données
      const [dataExportsResult] = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.tenantId, tenantId),
            eq(auditLogs.action, 'EXPORT'),
            gte(auditLogs.timestamp, start),
            lte(auditLogs.timestamp, end)
          )
        );

      // 6. Actions à haut risque (DELETE, admin actions)
      const [highRiskResult] = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.tenantId, tenantId),
            sql`action IN ('DELETE', 'ADMIN', 'SECURITY_ALERT', 'KEY_ROTATION')`,
            gte(auditLogs.timestamp, start),
            lte(auditLogs.timestamp, end)
          )
        );

      const totalEvents = totalEventsResult?.count || 0;
      const failedLogins = failedLoginsResult?.count || 0;
      const suspiciousActivity = suspiciousResult?.count || 0;
      const rateLimitViolations = rateLimitResult?.count || 0;
      const dataExports = dataExportsResult?.count || 0;
      const highRiskActions = highRiskResult?.count || 0;

      // Calcul de la santé du système
      let systemHealth: SecurityMetrics['systemHealth'] = 'healthy';
      if (failedLogins > 50 || suspiciousActivity > 20 || rateLimitViolations > 10) {
        systemHealth = 'critical';
      } else if (failedLogins > 20 || suspiciousActivity > 10 || rateLimitViolations > 5) {
        systemHealth = 'warning';
      }

      return {
        totalEvents,
        failedLogins,
        suspiciousActivity,
        rateLimitViolations,
        dataExports,
        highRiskActions,
        tenantIsolationViolations: 0, // Calculer séparément si nécessaire
        gdprRequests: 0, // Calculer séparément si nécessaire
        averageResponseTime: 150, // Mock pour l'instant
        systemHealth
      };
    } catch (error) {
      console.error('Failed to calculate security metrics:', error);
      throw error;
    }
  }

  /**
   * Générer le dashboard de sécurité d'un tenant
   */
  static async generateSecurityDashboard(tenantId: string): Promise<TenantSecurityDashboard> {
    const timeRange = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24h
      end: new Date()
    };

    const metrics = await this.calculateSecurityMetrics(tenantId, timeRange);
    const activeAlerts = SecurityAlertEngine.getActiveAlerts(tenantId);
    
    // Calcul du score de sécurité (0-100)
    let securityScore = 100;
    securityScore -= Math.min(30, metrics.failedLogins * 2); // Max -30 points
    securityScore -= Math.min(25, metrics.suspiciousActivity * 5); // Max -25 points
    securityScore -= Math.min(20, metrics.rateLimitViolations * 10); // Max -20 points
    securityScore -= Math.min(15, activeAlerts.length * 5); // Max -15 points
    securityScore = Math.max(0, securityScore);

    // Niveau de risque basé sur le score
    let riskLevel: TenantSecurityDashboard['riskLevel'] = 'low';
    if (securityScore < 30) riskLevel = 'critical';
    else if (securityScore < 50) riskLevel = 'high';
    else if (securityScore < 70) riskLevel = 'medium';

    return {
      tenantId,
      securityScore,
      riskLevel,
      activeThreats: activeAlerts.filter(a => a.impact === 'high' || a.impact === 'critical').length,
      recentAlerts: activeAlerts.slice(0, 10), // 10 dernières alertes
      complianceStatus: {
        gdpr: true, // À calculer selon les vrais critères
        dataRetention: true,
        auditTrail: true,
        encryption: true
      },
      metrics
    };
  }
}

// Enhanced Audit Engine avec détection temps réel
export class EnhancedAuditEngine {
  
  /**
   * Logger un événement d'audit enrichi
   */
  static async logAuditEvent(
    tenantId: string,
    userId: number | null,
    action: string,
    resourceType: string,
    resourceId: string | null = null,
    oldValues: any = null,
    newValues: any = null,
    ipAddress: string = 'unknown',
    userAgent: string = 'unknown',
    sessionId: string | null = null,
    success: boolean = true,
    errorMessage: string | null = null,
    dataClassification: AuditEvent['dataClassification'] = 'internal'
  ): Promise<void> {
    try {
      // Calculer le score de risque
      const riskScore = await this.calculateRiskScore(action, resourceType, success, userId);
      
      // Déterminer si c'est pertinent pour GDPR
      const gdprRelevant = this.isGDPRRelevant(action, resourceType, dataClassification);
      
      // Logger dans auditLogs
      await db.insert(auditLogs).values({
        tenantId,
        userId,
        action,
        resourceType,
        resourceId,
        oldValues,
        newValues,
        ipAddress,
        userAgent,
        sessionId,
        success,
        errorMessage
      });

      // Analyser en temps réel pour détecter les anomalies
      await this.analyzeForAnomalies(tenantId, userId, action, resourceType, success, riskScore);
      
    } catch (error) {
      console.error('Enhanced audit logging failed:', error);
      // Fallback vers console logging pour ne pas perdre l'audit trail
      console.log('AUDIT_FALLBACK:', {
        tenantId, userId, action, resourceType, success,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Calculer le score de risque d'une action
   */
  private static async calculateRiskScore(
    action: string,
    resourceType: string,
    success: boolean,
    userId: number | null
  ): Promise<number> {
    let riskScore = 0;

    // Actions à haut risque
    const highRiskActions = ['DELETE', 'EXPORT', 'ADMIN', 'KEY_ROTATION', 'DECRYPT'];
    if (highRiskActions.includes(action)) riskScore += 30;

    // Resources sensibles
    const sensitiveResources = ['user_data', 'encryption_keys', 'audit_logs', 'tenants'];
    if (sensitiveResources.includes(resourceType)) riskScore += 20;

    // Échecs d'opération
    if (!success) riskScore += 25;

    // Opérations système (sans userId)
    if (!userId) riskScore += 10;

    return Math.min(100, riskScore);
  }

  /**
   * Déterminer si l'action est pertinente pour GDPR
   */
  private static isGDPRRelevant(
    action: string,
    resourceType: string,
    dataClassification: AuditEvent['dataClassification']
  ): boolean {
    // Toutes les actions sur données personnelles
    const personalDataResources = ['user_profiles', 'user_data', 'contacts', 'employees'];
    if (personalDataResources.includes(resourceType)) return true;

    // Actions sensibles
    const gdprActions = ['EXPORT', 'DELETE', 'ACCESS', 'MODIFY'];
    if (gdprActions.includes(action)) return true;

    // Données confidentielles ou restreintes
    if (dataClassification === 'confidential' || dataClassification === 'restricted') return true;

    return false;
  }

  /**
   * Analyse temps réel pour détecter les anomalies
   */
  private static async analyzeForAnomalies(
    tenantId: string,
    userId: number | null,
    action: string,
    resourceType: string,
    success: boolean,
    riskScore: number
  ): Promise<void> {
    try {
      // Détection d'anomalies basée sur patterns
      
      // 1. Échecs répétés
      if (!success && userId) {
        const recentFailures = await db
          .select({ count: count() })
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.tenantId, tenantId),
              eq(auditLogs.userId, userId),
              eq(auditLogs.success, false),
              gte(auditLogs.timestamp, new Date(Date.now() - 60 * 60 * 1000)) // 1 heure
            )
          );

        const failureCount = recentFailures[0]?.count || 0;
        if (failureCount >= 5) {
          await SecurityAlertEngine.generateAlert(
            tenantId,
            'warning',
            'authentication',
            'Échecs répétés détectés',
            `${failureCount} échecs d'authentification/autorisation en 1 heure pour l'utilisateur ${userId}`,
            'enhanced-audit-engine',
            'medium',
            [userId],
            ['Vérifier les tentatives d\'accès', 'Considérer la révocation de session']
          );
        }
      }

      // 2. Actions à haut risque
      if (riskScore >= 50) {
        await SecurityAlertEngine.generateAlert(
          tenantId,
          riskScore >= 75 ? 'error' : 'warning',
          'system',
          'Action à haut risque détectée',
          `Action ${action} sur ${resourceType} avec score de risque ${riskScore}`,
          'enhanced-audit-engine',
          riskScore >= 75 ? 'high' : 'medium',
          userId ? [userId] : [],
          ['Vérifier la légitimité de l\'action', 'Examiner le contexte d\'accès']
        );
      }

      // 3. Volume d'activité anormal
      if (userId) {
        const recentActivity = await db
          .select({ count: count() })
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.tenantId, tenantId),
              eq(auditLogs.userId, userId),
              gte(auditLogs.timestamp, new Date(Date.now() - 15 * 60 * 1000)) // 15 minutes
            )
          );

        const activityCount = recentActivity[0]?.count || 0;
        if (activityCount >= 50) { // Plus de 50 actions en 15 min
          await SecurityAlertEngine.generateAlert(
            tenantId,
            'warning',
            'system',
            'Volume d\'activité anormal',
            `${activityCount} actions en 15 minutes pour l'utilisateur ${userId}`,
            'enhanced-audit-engine',
            'medium',
            [userId],
            ['Vérifier l\'automatisation', 'Examiner les patterns d\'usage']
          );
        }
      }

    } catch (error) {
      console.error('Anomaly analysis failed:', error);
    }
  }

  /**
   * Générer un rapport d'audit personnalisé
   */
  static async generateAuditReport(
    tenantId: string,
    timeRange: { start: Date; end: Date },
    filters: {
      userId?: number;
      action?: string;
      resourceType?: string;
      success?: boolean;
      minRiskScore?: number;
    } = {}
  ): Promise<{
    events: any[];
    summary: {
      totalEvents: number;
      successRate: number;
      riskDistribution: { low: number; medium: number; high: number };
      topActions: Array<{ action: string; count: number }>;
      topUsers: Array<{ userId: number; count: number }>;
    };
  }> {
    const { start, end } = timeRange;
    
    // Note: Requête construite avec filtres ci-dessous

    // Construire les conditions de filtres
    const whereConditions = [
      eq(auditLogs.tenantId, tenantId),
      gte(auditLogs.timestamp, start),
      lte(auditLogs.timestamp, end)
    ];
    
    // Appliquer les filtres
    if (filters.userId) {
      whereConditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters.action) {
      whereConditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters.resourceType) {
      whereConditions.push(eq(auditLogs.resourceType, filters.resourceType));
    }
    if (filters.success !== undefined) {
      whereConditions.push(eq(auditLogs.success, filters.success));
    }
    
    // Construire la requête avec tous les filtres
    const query = db
      .select()
      .from(auditLogs)
      .where(and(...whereConditions));

    const events = await query.orderBy(desc(auditLogs.timestamp));

    // Calculs de résumé
    const totalEvents = events.length;
    const successfulEvents = events.filter(e => e.success).length;
    const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;

    // Distribution du risque (simulation basée sur patterns)
    const riskDistribution = {
      low: events.filter(e => e.success && !['DELETE', 'EXPORT', 'ADMIN'].includes(e.action)).length,
      medium: events.filter(e => !e.success || ['UPDATE', 'MODIFY'].includes(e.action)).length,
      high: events.filter(e => ['DELETE', 'EXPORT', 'ADMIN', 'KEY_ROTATION'].includes(e.action)).length
    };

    // Top actions
    const actionCounts = events.reduce((acc, event) => {
      acc[event.action] = (acc[event.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topActions = Object.entries(actionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    // Top users
    const userCounts = events.reduce((acc, event) => {
      if (event.userId) {
        acc[event.userId] = (acc[event.userId] || 0) + 1;
      }
      return acc;
    }, {} as Record<number, number>);
    
    const topUsers = Object.entries(userCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId: parseInt(userId), count }));

    return {
      events,
      summary: {
        totalEvents,
        successRate,
        riskDistribution,
        topActions,
        topUsers
      }
    };
  }
}

// API Routes pour le monitoring avancé
export const enhancedAuditRoutes = {
  
  /**
   * GET /api/security/dashboard - Dashboard de sécurité tenant
   */
  async getDashboard(req: Request, res: Response) {
    try {
      const tenantId = req.params.tenantId || (req as any).tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const dashboard = await SecurityMetricsEngine.generateSecurityDashboard(tenantId);
      res.json(dashboard);
    } catch (error) {
      console.error('Failed to generate security dashboard:', error);
      res.status(500).json({ error: 'Failed to generate security dashboard' });
    }
  },

  /**
   * GET /api/security/metrics - Métriques de sécurité
   */
  async getMetrics(req: Request, res: Response) {
    try {
      const tenantId = req.params.tenantId || (req as any).tenantId;
      const { startDate, endDate } = req.query;
      
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const timeRange = {
        start: startDate ? new Date(startDate as string) : new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate as string) : new Date()
      };

      const metrics = await SecurityMetricsEngine.calculateSecurityMetrics(tenantId, timeRange);
      res.json(metrics);
    } catch (error) {
      console.error('Failed to calculate security metrics:', error);
      res.status(500).json({ error: 'Failed to calculate security metrics' });
    }
  },

  /**
   * GET /api/security/alerts - Alertes de sécurité actives
   */
  async getAlerts(req: Request, res: Response) {
    try {
      const tenantId = req.params.tenantId || (req as any).tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const alerts = SecurityAlertEngine.getActiveAlerts(tenantId);
      res.json(alerts);
    } catch (error) {
      console.error('Failed to get security alerts:', error);
      res.status(500).json({ error: 'Failed to get security alerts' });
    }
  },

  /**
   * POST /api/security/alerts/:alertId/resolve - Résoudre une alerte
   */
  async resolveAlert(req: Request, res: Response) {
    try {
      const { alertId } = req.params;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const resolved = await SecurityAlertEngine.resolveAlert(alertId, userId);
      
      if (!resolved) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      res.json({ success: true, resolved: true });
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      res.status(500).json({ error: 'Failed to resolve alert' });
    }
  },

  /**
   * GET /api/security/audit-report - Rapport d'audit personnalisé
   */
  async getAuditReport(req: Request, res: Response) {
    try {
      const tenantId = req.params.tenantId || (req as any).tenantId;
      const { startDate, endDate, userId, action, resourceType, success } = req.query;
      
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const timeRange = {
        start: startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate as string) : new Date()
      };

      const filters: any = {};
      if (userId) filters.userId = parseInt(userId as string);
      if (action) filters.action = action as string;
      if (resourceType) filters.resourceType = resourceType as string;
      if (success !== undefined) filters.success = success === 'true';

      const report = await EnhancedAuditEngine.generateAuditReport(tenantId, timeRange, filters);
      res.json(report);
    } catch (error) {
      console.error('Failed to generate audit report:', error);
      res.status(500).json({ error: 'Failed to generate audit report' });
    }
  }
};
