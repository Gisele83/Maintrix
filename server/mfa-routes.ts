/**
 * 🔐 ROUTES API MFA COMPLÈTES
 * 
 * Endpoints pour la gestion complète du MFA :
 * - Setup et configuration
 * - Vérification et validation
 * - Gestion des backup codes
 * - Enforcement automatique
 */

import { Router, Request, Response } from 'express';
import { MFAService } from './mfa-system';
import { PIIRedactionService } from './pii-redaction-system';
import { db } from './db';
import { userProfiles } from '../shared/schema';
import { eq } from 'drizzle-orm';

export const mfaRouter = Router();

// Interface pour les requêtes MFA
interface MFARequest extends Request {
  user?: {
    id: number;
    tenantId: string;
    username: string;
    role: string;
    email?: string;
  };
}

/**
 * POST /api/mfa/setup/init
 * Initialise le setup MFA (génération QR code)
 */
mfaRouter.post('/setup/init', async (req: MFARequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userId || !userEmail) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    // Vérifier si MFA déjà configuré
    const isEnabled = await MFAService.isMFAEnabled(userId);
    if (isEnabled) {
      return res.status(400).json({
        success: false,
        message: 'MFA déjà configuré pour cet utilisateur'
      });
    }

    // Générer le secret et QR code
    const mfaSecret = await MFAService.generateMFASecret(userId, userEmail);

    // Log avec redaction PII
    const logData = PIIRedactionService.redactAuditLog({
      action: 'mfa_setup_init',
      userId,
      userEmail,
      timestamp: new Date()
    });
    console.log('🔐 MFA SETUP INIT:', logData);

    res.json({
      success: true,
      data: {
        qrCode: mfaSecret.qrCode,
        backupCodes: mfaSecret.backupCodes,
        secret: mfaSecret.secret // Temporairement pour le frontend
      },
      message: 'Setup MFA initialisé. Scannez le QR code avec votre application d\'authentification.'
    });

  } catch (error) {
    console.error('Erreur init setup MFA:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'initialisation MFA'
    });
  }
});

/**
 * POST /api/mfa/setup/complete
 * Finalise le setup MFA avec vérification code
 */
mfaRouter.post('/setup/complete', async (req: MFARequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { secret, token, backupCodes } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    if (!secret || !token || !backupCodes) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres manquants (secret, token, backupCodes)'
      });
    }

    // Finaliser le setup
    const result = await MFAService.setupMFA(userId, secret, token, backupCodes);

    if (result.success) {
      // Log avec redaction
      const logData = PIIRedactionService.redactAuditLog({
        action: 'mfa_setup_complete',
        userId,
        success: true,
        timestamp: new Date()
      });
      console.log('🔐 MFA SETUP COMPLETE:', logData);

      res.json({
        success: true,
        data: {
          backupCodes: result.backupCodes
        },
        message: 'MFA configuré avec succès. Sauvegardez vos codes de récupération.'
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Erreur completion setup MFA:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la finalisation MFA'
    });
  }
});

/**
 * POST /api/mfa/verify
 * Vérifie un code MFA (TOTP ou backup)
 */
mfaRouter.post('/verify', async (req: MFARequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { token, isBackupCode } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Code MFA requis'
      });
    }

    // Vérifier le code
    const result = await MFAService.verifyMFA(userId, token, isBackupCode);

    // Log avec redaction
    const logData = PIIRedactionService.redactAuditLog({
      action: 'mfa_verify',
      userId,
      success: result.success,
      backupCodeUsed: result.backupCodeUsed,
      timestamp: new Date()
    });
    console.log('🔐 MFA VERIFY:', logData);

    if (result.success) {
      res.json({
        success: true,
        data: {
          backupCodeUsed: result.backupCodeUsed
        },
        message: result.message
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Erreur vérification MFA:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification MFA'
    });
  }
});

/**
 * POST /api/mfa/backup-codes/regenerate
 * Régénère les codes de backup
 */
mfaRouter.post('/backup-codes/regenerate', async (req: MFARequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    // Vérifier que MFA est activé
    const isEnabled = await MFAService.isMFAEnabled(userId);
    if (!isEnabled) {
      return res.status(400).json({
        success: false,
        message: 'MFA non configuré'
      });
    }

    // Régénérer les codes
    const newBackupCodes = await MFAService.regenerateBackupCodes(userId);

    // Log avec redaction
    const logData = PIIRedactionService.redactAuditLog({
      action: 'mfa_backup_codes_regenerate',
      userId,
      timestamp: new Date()
    });
    console.log('🔐 MFA BACKUP CODES REGENERATED:', logData);

    res.json({
      success: true,
      data: {
        backupCodes: newBackupCodes
      },
      message: 'Nouveaux codes de récupération générés'
    });

  } catch (error) {
    console.error('Erreur régénération backup codes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la régénération des codes'
    });
  }
});

/**
 * GET /api/mfa/status
 * Vérifie le statut MFA d'un utilisateur
 */
mfaRouter.get('/status', async (req: MFARequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    const [isRequired, isEnabled] = await Promise.all([
      MFAService.isMFARequired(userId),
      MFAService.isMFAEnabled(userId)
    ]);

    res.json({
      success: true,
      data: {
        required: isRequired,
        enabled: isEnabled,
        setupComplete: isEnabled,
        enforcement: isRequired && !isEnabled ? 'REQUIRED' : 'OPTIONAL'
      },
      message: 'Statut MFA récupéré'
    });

  } catch (error) {
    console.error('Erreur récupération statut MFA:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut'
    });
  }
});

/**
 * POST /api/mfa/disable
 * Désactive MFA (pour les utilisateurs non-admin uniquement)
 */
mfaRouter.post('/disable', async (req: MFARequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    // Vérifier si MFA est obligatoire pour ce rôle
    const isRequired = await MFAService.isMFARequired(userId);
    if (isRequired) {
      return res.status(403).json({
        success: false,
        message: 'MFA obligatoire pour les administrateurs'
      });
    }

    // Désactiver MFA
    const result = await MFAService.disableMFA(userId);

    if (result) {
      // Log avec redaction
      const logData = PIIRedactionService.redactAuditLog({
        action: 'mfa_disable',
        userId,
        userRole,
        timestamp: new Date()
      });
      console.log('🔐 MFA DISABLED:', logData);

      res.json({
        success: true,
        message: 'MFA désactivé avec succès'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la désactivation MFA'
      });
    }

  } catch (error) {
    console.error('Erreur désactivation MFA:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la désactivation MFA'
    });
  }
});

/**
 * Middleware d'enforcement MFA pour les administrateurs
 */
export async function mfaEnforcementMiddleware(req: any, res: Response, next: any) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    // 🔧 TENANT MANAGEMENT BYPASS : Permettre l'accès aux routes de gestion des tenants
    const isTenantManagementRoute = req.path.startsWith('/api/admin/tenants') || 
                                   req.path.startsWith('/api/admin/federated-analytics');
    
    if (isTenantManagementRoute) {
      console.log(`🏢 TENANT MANAGEMENT ACCESS BYPASS: ${req.path} - MFA check skipped for tenant management`);
      return next();
    }

    // Vérifier si MFA est requis
    const isRequired = await MFAService.isMFARequired(userId);
    if (!isRequired) {
      return next(); // MFA pas obligatoire, continuer
    }

    // Vérifier si MFA est configuré
    const isEnabled = await MFAService.isMFAEnabled(userId);
    if (!isEnabled) {
      // Log de tentative d'accès sans MFA
      const logData = PIIRedactionService.redactAuditLog({
        action: 'access_denied_mfa_required',
        userId,
        userRole,
        path: req.path,
        timestamp: new Date()
      });
      console.log('🚨 MFA ENFORCEMENT:', logData);

      return res.status(403).json({
        success: false,
        error: 'MFA_REQUIRED',
        message: 'Configuration MFA obligatoire pour les administrateurs',
        setupRequired: true
      });
    }

    // Vérifier si l'utilisateur a une session MFA valide
    if (!req.session?.mfaVerified) {
      return res.status(403).json({
        success: false,
        error: 'MFA_VERIFICATION_REQUIRED',
        message: 'Vérification MFA requise',
        verificationRequired: true
      });
    }

    next();

  } catch (error) {
    console.error('Erreur enforcement MFA:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification MFA'
    });
  }
}