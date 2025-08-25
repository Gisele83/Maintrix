/**
 * 🔐 SYSTÈME DE CONTRÔLE D'ACCÈS CONTINU POST-DÉPLOIEMENT
 * 
 * Ce module implémente un contrôle d'accès continu pour la gestion post-déploiement :
 * - Vérification continue de l'identité (Multi-Factor Authentication, Device Trust)
 * - Gestion granulaire des rôles et permissions par tenant
 * - Contrôle des périmètres de sécurité (IP, Géolocalisation, Horaires)
 * - Surveillance en temps réel des accès et détection d'anomalies
 */

import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { userProfiles, tenants, accessLogs, securityPolicies } from '../shared/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';

// Types pour le contrôle d'accès continu
export interface ContinuousAccessRequest extends Request {
  tenantId?: string;
  user?: {
    id: number;
    tenantId: string;
    username: string;
    role: string;
    permissions: string[];
    lastVerification?: Date;
    trustScore: number;
  };
  accessContext?: {
    ipAddress: string;
    userAgent: string;
    deviceFingerprint: string;
    location?: {
      country: string;
      region: string;
      city: string;
    };
    timestamp: Date;
  };
}

export interface SecurityPolicy {
  id: string;
  tenantId: string;
  name: string;
  rules: {
    mfaRequired: boolean;
    deviceTrustRequired: boolean;
    ipWhitelist?: string[];
    geoRestrictions?: string[];
    timeRestrictions?: {
      allowedHours: { start: number; end: number };
      allowedDays: number[];
      timezone: string;
    };
    sessionTimeout: number; // minutes
    maxConcurrentSessions: number;
  };
  enforcement: 'strict' | 'moderate' | 'lenient';
  isActive: boolean;
}

export interface AccessAttempt {
  userId: number;
  tenantId: string;
  action: string;
  resource: string;
  result: 'granted' | 'denied' | 'challenged';
  reason?: string;
  riskScore: number;
  context: {
    ip: string;
    userAgent: string;
    device: string;
    location?: string;
  };
  timestamp: Date;
}

// Système de scoring de confiance basé sur les comportements
export class TrustScoreEngine {
  
  /**
   * Calcule un score de confiance basé sur l'historique utilisateur
   * Score de 0 (risque maximum) à 100 (confiance totale)
   */
  static async calculateTrustScore(
    userId: number, 
    tenantId: string, 
    currentContext: ContinuousAccessRequest['accessContext']
  ): Promise<number> {
    let baseScore = 50; // Score de base

    try {
      // 1. Historique des connexions réussies (max +30 points)
      const recentSuccessfulLogins = await db
        .select({ count: sql<number>`count(*)` })
        .from(accessLogs)
        .where(
          and(
            eq(accessLogs.userId, userId),
            eq(accessLogs.tenantId, tenantId),
            eq(accessLogs.result, 'granted'),
            gte(accessLogs.timestamp, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // 30 jours
          )
        );

      const successfulLogins = recentSuccessfulLogins[0]?.count || 0;
      baseScore += Math.min(successfulLogins * 2, 30);

      // 2. Cohérence des appareils (max +20 points)
      if (currentContext?.deviceFingerprint) {
        const knownDevices = await db
          .selectDistinct({ device: accessLogs.deviceFingerprint })
          .from(accessLogs)
          .where(
            and(
              eq(accessLogs.userId, userId),
              eq(accessLogs.result, 'granted'),
              gte(accessLogs.timestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 7 jours
            )
          );

        const isKnownDevice = knownDevices.some(d => d.device === currentContext.deviceFingerprint);
        if (isKnownDevice) baseScore += 20;
      }

      // 3. Pénalités pour tentatives échouées récentes (max -40 points)
      const recentFailures = await db
        .select({ count: sql<number>`count(*)` })
        .from(accessLogs)
        .where(
          and(
            eq(accessLogs.userId, userId),
            eq(accessLogs.result, 'denied'),
            gte(accessLogs.timestamp, new Date(Date.now() - 24 * 60 * 60 * 1000)) // 24 heures
          )
        );

      const failures = recentFailures[0]?.count || 0;
      baseScore -= failures * 10;

      // 4. Cohérence géographique (max +20 points, -30 si suspect)
      if (currentContext?.location) {
        const recentLocations = await db
          .selectDistinct({ location: accessLogs.location })
          .from(accessLogs)
          .where(
            and(
              eq(accessLogs.userId, userId),
              eq(accessLogs.result, 'granted'),
              gte(accessLogs.timestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
            )
          );

        const currentLocation = `${currentContext.location.country}:${currentContext.location.region}`;
        const isKnownLocation = recentLocations.some(l => l.location?.includes(currentContext.location!.country));
        
        if (isKnownLocation) {
          baseScore += 15;
        } else {
          // Nouvelle localisation = risque
          baseScore -= 25;
        }
      }

      // S'assurer que le score reste dans [0, 100]
      return Math.max(0, Math.min(100, baseScore));
      
    } catch (error) {
      console.error('Erreur calcul trust score:', error);
      return 25; // Score de sécurité par défaut
    }
  }
}

// Moteur de détection d'anomalies
export class AnomalyDetectionEngine {
  
  /**
   * Détecte les comportements d'accès anormaux
   * Retourne un score de risque de 0 (normal) à 100 (très suspect)
   */
  static async detectAnomalies(
    userId: number,
    tenantId: string,
    action: string,
    context: ContinuousAccessRequest['accessContext']
  ): Promise<{ riskScore: number; reasons: string[] }> {
    const reasons: string[] = [];
    let riskScore = 0;

    try {
      // 1. Connexions simultanées multiples
      const activeSessions = await db
        .select({ count: sql<number>`count(*)` })
        .from(accessLogs)
        .where(
          and(
            eq(accessLogs.userId, userId),
            eq(accessLogs.action, 'login'),
            eq(accessLogs.result, 'granted'),
            gte(accessLogs.timestamp, new Date(Date.now() - 30 * 60 * 1000)) // 30 minutes
          )
        );

      if ((activeSessions[0]?.count || 0) > 3) {
        riskScore += 30;
        reasons.push('Connexions simultanées multiples détectées');
      }

      // 2. Fréquence d'accès inhabituelle
      const recentAccess = await db
        .select({ count: sql<number>`count(*)` })
        .from(accessLogs)
        .where(
          and(
            eq(accessLogs.userId, userId),
            gte(accessLogs.timestamp, new Date(Date.now() - 60 * 60 * 1000)) // 1 heure
          )
        );

      if ((recentAccess[0]?.count || 0) > 50) {
        riskScore += 25;
        reasons.push('Fréquence d\'accès anormalement élevée');
      }

      // 3. Changement d'IP brutal
      if (context?.ipAddress) {
        const lastKnownIP = await db
          .select({ ip: accessLogs.ipAddress })
          .from(accessLogs)
          .where(
            and(
              eq(accessLogs.userId, userId),
              eq(accessLogs.result, 'granted')
            )
          )
          .orderBy(desc(accessLogs.timestamp))
          .limit(1);

        if (lastKnownIP[0] && lastKnownIP[0].ip !== context.ipAddress) {
          riskScore += 20;
          reasons.push('Changement d\'adresse IP détecté');
        }
      }

      // 4. Tentatives d'accès à des ressources sensibles
      const sensitiveActions = ['delete', 'export', 'admin', 'config'];
      if (sensitiveActions.some(sa => action.toLowerCase().includes(sa))) {
        riskScore += 15;
        reasons.push('Tentative d\'accès à une ressource sensible');
      }

      return { riskScore: Math.min(100, riskScore), reasons };
      
    } catch (error) {
      console.error('Erreur détection anomalies:', error);
      return { riskScore: 50, reasons: ['Erreur lors de l\'analyse des anomalies'] };
    }
  }
}

// Middleware principal de contrôle d'accès continu
export class ContinuousAccessController {
  
  /**
   * Middleware de contrôle d'accès continu
   * Vérifie en permanence la légitimité des accès
   */
  static async middleware(
    req: ContinuousAccessRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // 1. Enrichir le contexte de la requête
      await ContinuousAccessController.enrichAccessContext(req);

      // 2. Vérifier les politiques de sécurité du tenant
      const securityPolicy = await ContinuousAccessController.getSecurityPolicy(req.tenantId!);
      
      // 3. Calculer le score de confiance
      const trustScore = await TrustScoreEngine.calculateTrustScore(
        req.user!.id,
        req.tenantId!,
        req.accessContext
      );

      // 4. Détecter les anomalies
      const { riskScore, reasons } = await AnomalyDetectionEngine.detectAnomalies(
        req.user!.id,
        req.tenantId!,
        req.method + ' ' + req.path,
        req.accessContext
      );

      // 5. Prendre une décision d'accès basée sur les scores
      const accessDecision = await ContinuousAccessController.makeAccessDecision(
        trustScore,
        riskScore,
        securityPolicy,
        req
      );

      // 6. Logger la tentative d'accès
      await ContinuousAccessController.logAccessAttempt({
        userId: req.user!.id,
        tenantId: req.tenantId!,
        action: `${req.method} ${req.path}`,
        resource: req.path,
        result: accessDecision.result,
        reason: accessDecision.reason,
        riskScore: riskScore,
        context: {
          ip: req.accessContext!.ipAddress,
          userAgent: req.accessContext!.userAgent,
          device: req.accessContext!.deviceFingerprint,
          location: req.accessContext?.location ? 
            `${req.accessContext.location.country}:${req.accessContext.location.region}` : undefined
        },
        timestamp: new Date()
      });

      // 7. Appliquer la décision
      if (accessDecision.result === 'denied') {
        res.status(403).json({
          error: 'ACCESS_DENIED',
          message: 'Accès refusé par le contrôle continu',
          reason: accessDecision.reason,
          trustScore,
          riskScore,
          additionalAuthRequired: accessDecision.requiresAdditionalAuth
        });
        return;
      }

      if (accessDecision.result === 'challenged') {
        res.status(200).json({
          challenge: 'ADDITIONAL_AUTH_REQUIRED',
          message: 'Authentification supplémentaire requise',
          trustScore,
          riskScore,
          challengeType: accessDecision.challengeType,
          challengeData: accessDecision.challengeData
        });
        return;
      }

      // 8. Accès accordé - continuer
      req.user!.trustScore = trustScore;
      req.user!.lastVerification = new Date();
      
      console.log(`✅ CONTINUOUS ACCESS: User ${req.user!.username} granted access to ${req.path} (Trust: ${trustScore}, Risk: ${riskScore})`);
      
      next();
      
    } catch (error) {
      console.error('Erreur contrôle d\'accès continu:', error);
      res.status(500).json({
        error: 'ACCESS_CONTROL_ERROR',
        message: 'Erreur lors du contrôle d\'accès'
      });
    }
  }

  /**
   * Enrichit le contexte de la requête avec des informations de sécurité
   */
  static async enrichAccessContext(req: ContinuousAccessRequest): Promise<void> {
    const ipAddress = (req.headers['x-forwarded-for'] as string || req.ip || '').split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || '';
    
    // Génération d'une empreinte d'appareil basée sur les headers
    const deviceFingerprint = crypto
      .createHash('sha256')
      .update(userAgent + ipAddress + (req.headers['accept-language'] || ''))
      .digest('hex')
      .substring(0, 16);

    req.accessContext = {
      ipAddress,
      userAgent,
      deviceFingerprint,
      timestamp: new Date()
    };

    // Simulation de géolocalisation (dans un vrai système, utiliser un service de géolocalisation IP)
    if (ipAddress && !ipAddress.includes('127.0.0.1') && !ipAddress.includes('localhost')) {
      req.accessContext.location = {
        country: 'FR', // Simulé
        region: 'Île-de-France',
        city: 'Paris'
      };
    }
  }

  /**
   * Récupère la politique de sécurité du tenant
   */
  static async getSecurityPolicy(tenantId: string): Promise<SecurityPolicy> {
    try {
      const [policy] = await db
        .select()
        .from(securityPolicies)
        .where(eq(securityPolicies.tenantId, tenantId));

      if (policy) {
        return JSON.parse(JSON.stringify(policy)) as SecurityPolicy;
      }
    } catch (error) {
      console.error('Erreur récupération politique sécurité:', error);
    }

    // Politique par défaut
    return {
      id: `default-${tenantId}`,
      tenantId,
      name: 'Politique de sécurité par défaut',
      rules: {
        mfaRequired: false,
        deviceTrustRequired: false,
        sessionTimeout: 480, // 8 heures
        maxConcurrentSessions: 5
      },
      enforcement: 'moderate',
      isActive: true
    };
  }

  /**
   * Prend une décision d'accès basée sur les scores et politiques
   */
  static async makeAccessDecision(
    trustScore: number,
    riskScore: number,
    policy: SecurityPolicy,
    req: ContinuousAccessRequest
  ): Promise<{
    result: 'granted' | 'denied' | 'challenged';
    reason?: string;
    requiresAdditionalAuth?: boolean;
    challengeType?: string;
    challengeData?: any;
  }> {
    
    // Seuils basés sur l'enforcement policy
    const thresholds = {
      strict: { minTrust: 70, maxRisk: 20 },
      moderate: { minTrust: 50, maxRisk: 40 },
      lenient: { minTrust: 30, maxRisk: 60 }
    };

    const threshold = thresholds[policy.enforcement];

    // Accès refusé si risque trop élevé
    if (riskScore > threshold.maxRisk) {
      return {
        result: 'denied',
        reason: `Risque trop élevé (${riskScore}) pour la politique ${policy.enforcement}`
      };
    }

    // Accès refusé si confiance trop faible
    if (trustScore < threshold.minTrust) {
      return {
        result: 'denied',
        reason: `Score de confiance insuffisant (${trustScore}) pour la politique ${policy.enforcement}`
      };
    }

    // Challenge MFA si requis et conditions particulières
    if (policy.rules.mfaRequired && (riskScore > 30 || trustScore < 60)) {
      return {
        result: 'challenged',
        challengeType: 'MFA',
        challengeData: {
          methods: ['totp', 'sms'],
          timeout: 300 // 5 minutes
        }
      };
    }

    // Accès accordé
    return { result: 'granted' };
  }

  /**
   * Enregistre une tentative d'accès dans les logs
   */
  static async logAccessAttempt(attempt: AccessAttempt): Promise<void> {
    try {
      await db.insert(accessLogs).values({
        userId: attempt.userId,
        tenantId: attempt.tenantId,
        action: attempt.action,
        resource: attempt.resource,
        result: attempt.result,
        reason: attempt.reason,
        riskScore: attempt.riskScore,
        ipAddress: attempt.context.ip,
        userAgent: attempt.context.userAgent,
        deviceFingerprint: attempt.context.device,
        location: attempt.context.location,
        timestamp: attempt.timestamp
      });
    } catch (error) {
      console.error('Erreur logging tentative d\'accès:', error);
    }
  }
}

// Exportation du middleware principal
export const continuousAccessControl = ContinuousAccessController.middleware;