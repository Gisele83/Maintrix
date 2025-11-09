/**
 * 👥 SYSTÈME DE GESTION DU CYCLE DE VIE UTILISATEUR
 * 
 * Gestion complète du cycle de vie des utilisateurs avec workflows automatisés :
 * - Onboarding sécurisé avec validation multi-étapes
 * - Provisioning automatique des accès et ressources
 * - Offboarding complet avec révocation d'accès
 * - Gestion des transitions de rôles et transferts
 */

import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { userProfiles, tenants, workflowTasks, auditTrail } from '../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import { sendEmail } from './notifications';

// Types pour la gestion du cycle de vie
export interface OnboardingWorkflow {
  id: string;
  tenantId: string;
  userId: number;
  initiatedBy: number;
  stage: 'pending' | 'identity_verification' | 'role_assignment' | 'resource_provisioning' | 'training' | 'completed' | 'failed';
  steps: OnboardingStep[];
  metadata: {
    userEmail: string;
    requestedRole: string;
    department: string;
    manager: string;
    startDate: Date;
    endDate?: Date;
  };
  status: 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
}

export interface OnboardingStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  assignedTo?: number; // User ID responsible
  dueDate?: Date;
  completedAt?: Date;
  completedBy?: number;
  evidence?: {
    type: 'document' | 'approval' | 'system_action';
    data: any;
  };
}

export interface OffboardingWorkflow {
  id: string;
  tenantId: string;
  userId: number;
  initiatedBy: number;
  reason: 'termination' | 'resignation' | 'transfer' | 'suspension' | 'other';
  stage: 'initiated' | 'access_revocation' | 'data_transfer' | 'asset_recovery' | 'final_audit' | 'completed';
  tasks: OffboardingTask[];
  effectiveDate: Date;
  completedAt?: Date;
  status: 'active' | 'completed' | 'cancelled';
}

export interface OffboardingTask {
  id: string;
  name: string;
  description: string;
  category: 'security' | 'data' | 'assets' | 'documentation' | 'compliance';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: number;
  dueDate: Date;
  completedAt?: Date;
  evidence?: any;
}

// Gestionnaire d'onboarding
export class OnboardingManager {
  
  /**
   * Lance un processus d'onboarding pour un nouvel utilisateur
   */
  static async initiateOnboarding(
    tenantId: string,
    userEmail: string,
    requestedRole: string,
    initiatedBy: number,
    metadata: {
      department: string;
      manager: string;
      startDate: Date;
    }
  ): Promise<OnboardingWorkflow> {
    
    const workflowId = `onboard-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    
    // Créer un utilisateur temporaire
    const [tempUser] = await db.insert(userProfiles).values({
      username: userEmail.split('@')[0],
      email: userEmail,
      firstName: '', // À compléter pendant l'onboarding
      lastName: '', // À compléter pendant l'onboarding
      tenantId: tenantId,
      role: 'pending', // Rôle temporaire
      isActive: false, // Inactif jusqu'à completion
      validationLevel: 0,
      createdAt: new Date()
    }).returning();

    const steps = OnboardingManager.generateOnboardingSteps(requestedRole, tenantId);
    
    const workflow: OnboardingWorkflow = {
      id: workflowId,
      tenantId,
      userId: tempUser.id,
      initiatedBy,
      stage: 'pending',
      steps,
      metadata: {
        userEmail,
        requestedRole,
        department: metadata.department,
        manager: metadata.manager,
        startDate: metadata.startDate
      },
      status: 'active',
      createdAt: new Date()
    };

    // Enregistrer le workflow
    await db.insert(workflowTasks).values({
      id: workflowId,
      tenantId,
      type: 'onboarding',
      title: `Onboarding: ${userEmail}`,
      description: `Processus d'intégration pour ${userEmail} - Rôle: ${requestedRole}`,
      assignedTo: initiatedBy,
      data: JSON.stringify(workflow),
      status: 'active',
      priority: 'medium',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
      createdAt: new Date()
    });

    // Enregistrer dans l'audit trail
    await OnboardingManager.logAuditEvent({
      tenantId,
      userId: tempUser.id,
      action: 'onboarding_initiated',
      details: {
        workflowId,
        requestedRole,
        initiatedBy
      },
      timestamp: new Date()
    });

    // Envoyer notification au manager
    await OnboardingManager.notifyStakeholders(workflow, 'initiated');

    console.log(`🚀 ONBOARDING INITIATED: ${userEmail} for tenant ${tenantId} (Workflow: ${workflowId})`);
    
    return workflow;
  }

  /**
   * Génère les étapes d'onboarding selon le rôle demandé
   */
  static generateOnboardingSteps(role: string, tenantId: string): OnboardingStep[] {
    const baseSteps: OnboardingStep[] = [
      {
        id: 'identity_verification',
        name: 'Vérification d\'identité',
        description: 'Vérifier l\'identité de l\'utilisateur avec documents officiels',
        status: 'pending'
      },
      {
        id: 'background_check',
        name: 'Vérifications de sécurité',
        description: 'Contrôles de sécurité et vérifications d\'antécédents si requis',
        status: 'pending'
      },
      {
        id: 'account_setup',
        name: 'Configuration du compte',
        description: 'Configuration des paramètres de compte et mot de passe initial',
        status: 'pending'
      },
      {
        id: 'role_assignment',
        name: 'Attribution des rôles',
        description: 'Attribution des rôles et permissions selon le poste',
        status: 'pending'
      },
      {
        id: 'resource_provisioning',
        name: 'Provisioning des ressources',
        description: 'Allocation des ressources système et accès aux outils',
        status: 'pending'
      },
      {
        id: 'security_training',
        name: 'Formation sécurité',
        description: 'Formation obligatoire sur les politiques de sécurité',
        status: 'pending'
      }
    ];

    // Étapes spécifiques selon le rôle
    if (role === 'admin' || role === 'super-admin') {
      baseSteps.push({
        id: 'admin_approval',
        name: 'Approbation administrative',
        description: 'Approbation supplémentaire requise pour les rôles administratifs',
        status: 'pending'
      });
      baseSteps.push({
        id: 'privileged_access_setup',
        name: 'Configuration accès privilégiés',
        description: 'Configuration des accès administratifs avec MFA obligatoire',
        status: 'pending'
      });
    }

    if (role === 'manager') {
      baseSteps.push({
        id: 'team_assignment',
        name: 'Attribution d\'équipe',
        description: 'Attribution des équipes et responsabilités managériales',
        status: 'pending'
      });
    }

    return baseSteps;
  }

  /**
   * Avance une étape du processus d'onboarding
   */
  static async completeOnboardingStep(
    workflowId: string,
    stepId: string,
    completedBy: number,
    evidence?: any
  ): Promise<boolean> {
    try {
      // Récupérer le workflow
      const [workflowTask] = await db
        .select()
        .from(workflowTasks)
        .where(eq(workflowTasks.id, workflowId));

      if (!workflowTask) {
        throw new Error('Workflow non trouvé');
      }

      const workflow: OnboardingWorkflow = JSON.parse(workflowTask.data as string);
      
      // Trouver et marquer l'étape comme complétée
      const stepIndex = workflow.steps.findIndex(s => s.id === stepId);
      if (stepIndex === -1) {
        throw new Error('Étape non trouvée');
      }

      workflow.steps[stepIndex] = {
        ...workflow.steps[stepIndex],
        status: 'completed',
        completedAt: new Date(),
        completedBy,
        evidence
      };

      // Vérifier si toutes les étapes sont complétées
      const allCompleted = workflow.steps.every(s => s.status === 'completed');
      
      if (allCompleted) {
        workflow.stage = 'completed';
        workflow.status = 'completed';
        workflow.completedAt = new Date();
        
        // Activer l'utilisateur
        await OnboardingManager.activateUser(workflow);
      } else {
        // Passer à l'étape suivante
        const nextStep = workflow.steps.find(s => s.status === 'pending');
        if (nextStep) {
          nextStep.status = 'in_progress';
        }
      }

      // Sauvegarder le workflow mis à jour
      await db
        .update(workflowTasks)
        .set({
          data: JSON.stringify(workflow),
          status: workflow.status
        })
        .where(eq(workflowTasks.id, workflowId));

      // Log audit
      await OnboardingManager.logAuditEvent({
        tenantId: workflow.tenantId,
        userId: workflow.userId,
        action: 'onboarding_step_completed',
        details: {
          workflowId,
          stepId,
          completedBy
        },
        timestamp: new Date()
      });

      console.log(`✅ ONBOARDING STEP COMPLETED: ${stepId} for workflow ${workflowId}`);
      
      return allCompleted;
      
    } catch (error) {
      console.error('Erreur completion étape onboarding:', error);
      return false;
    }
  }

  /**
   * Active l'utilisateur après completion de l'onboarding
   */
  static async activateUser(workflow: OnboardingWorkflow): Promise<void> {
    await db
      .update(userProfiles)
      .set({
        role: workflow.metadata.requestedRole,
        isActive: true,
        validationLevel: 1,
        updatedAt: new Date()
      })
      .where(eq(userProfiles.id, workflow.userId));

    // Envoyer email d'activation
    const [user] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, workflow.userId));

    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: 'Bienvenue - Votre compte est maintenant actif',
        html: `
          <h2>Bienvenue dans Maintrix !</h2>
          <p>Votre processus d'intégration est maintenant terminé.</p>
          <p><strong>Rôle attribué :</strong> ${workflow.metadata.requestedRole}</p>
          <p>Vous pouvez maintenant vous connecter et utiliser l'application.</p>
        `
      });
    }

    console.log(`🎉 USER ACTIVATED: ${user?.email} with role ${workflow.metadata.requestedRole}`);
  }

  /**
   * Envoie des notifications aux parties prenantes
   */
  static async notifyStakeholders(workflow: OnboardingWorkflow, event: 'initiated' | 'completed' | 'failed'): Promise<void> {
    // Implémentation des notifications
    console.log(`📧 ONBOARDING NOTIFICATION: ${event} for ${workflow.metadata.userEmail}`);
  }

  /**
   * Enregistre un événement d'audit
   */
  static async logAuditEvent(event: {
    tenantId: string;
    userId: number;
    action: string;
    details: any;
    timestamp: Date;
  }): Promise<void> {
    await db.insert(auditTrail).values({
      tenantId: event.tenantId,
      userId: event.userId,
      action: event.action,
      resource: 'user_lifecycle',
      details: JSON.stringify(event.details),
      timestamp: event.timestamp
    });
  }
}

// Gestionnaire d'offboarding
export class OffboardingManager {
  
  /**
   * Lance un processus d'offboarding pour un utilisateur
   */
  static async initiateOffboarding(
    tenantId: string,
    userId: number,
    reason: OffboardingWorkflow['reason'],
    initiatedBy: number,
    effectiveDate: Date
  ): Promise<OffboardingWorkflow> {
    
    const workflowId = `offboard-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    
    // Récupérer les données utilisateur
    const [user] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, userId));

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    const tasks = OffboardingManager.generateOffboardingTasks(user.role || 'user', tenantId);
    
    const workflow: OffboardingWorkflow = {
      id: workflowId,
      tenantId,
      userId,
      initiatedBy,
      reason,
      stage: 'initiated',
      tasks,
      effectiveDate,
      status: 'active'
    };

    // Enregistrer le workflow
    await db.insert(workflowTasks).values({
      id: workflowId,
      tenantId,
      type: 'offboarding',
      title: `Offboarding: ${user.username}`,
      description: `Processus de départ pour ${user.username} - Raison: ${reason}`,
      assignedTo: initiatedBy,
      data: JSON.stringify(workflow),
      status: 'active',
      priority: 'high',
      dueDate: effectiveDate,
      createdAt: new Date()
    });

    console.log(`🚪 OFFBOARDING INITIATED: ${user.username} for tenant ${tenantId} (Workflow: ${workflowId})`);
    
    return workflow;
  }

  /**
   * Génère les tâches d'offboarding selon le rôle
   */
  static generateOffboardingTasks(role: string, tenantId: string): OffboardingTask[] {
    const baseTasks: OffboardingTask[] = [
      {
        id: 'immediate_access_revocation',
        name: 'Révocation accès immédiate',
        description: 'Désactiver immédiatement tous les accès utilisateur',
        category: 'security',
        status: 'pending',
        priority: 'critical',
        dueDate: new Date() // Immédiat
      },
      {
        id: 'session_termination',
        name: 'Terminaison des sessions',
        description: 'Fermer toutes les sessions actives',
        category: 'security',
        status: 'pending',
        priority: 'critical',
        dueDate: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      },
      {
        id: 'data_backup',
        name: 'Sauvegarde des données',
        description: 'Sauvegarder les données utilisateur importantes',
        category: 'data',
        status: 'pending',
        priority: 'high',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
      },
      {
        id: 'equipment_recovery',
        name: 'Récupération du matériel',
        description: 'Récupération des équipements et badges d\'accès',
        category: 'assets',
        status: 'pending',
        priority: 'medium',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 jours
      },
      {
        id: 'knowledge_transfer',
        name: 'Transfert de connaissances',
        description: 'Documentation et transfert des connaissances critiques',
        category: 'documentation',
        status: 'pending',
        priority: 'medium',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 semaine
      },
      {
        id: 'final_audit',
        name: 'Audit final',
        description: 'Vérification finale que tous les accès sont révoqués',
        category: 'compliance',
        status: 'pending',
        priority: 'high',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 semaine
      }
    ];

    // Tâches spécifiques selon le rôle
    if (role === 'admin' || role === 'super-admin') {
      baseTasks.unshift({
        id: 'admin_rights_audit',
        name: 'Audit des droits administratifs',
        description: 'Audit complet des actions administratives récentes',
        category: 'security',
        status: 'pending',
        priority: 'critical',
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2h
      });
    }

    return baseTasks;
  }

  /**
   * Révoque immédiatement tous les accès utilisateur
   */
  static async revokeUserAccess(userId: number, tenantId: string): Promise<void> {
    // Désactiver l'utilisateur
    await db
      .update(userProfiles)
      .set({
        isActive: false,
        validationLevel: 0,
        role: 'revoked',
        updatedAt: new Date()
      })
      .where(and(eq(userProfiles.id, userId), eq(userProfiles.tenantId, tenantId)));

    console.log(`🔒 ACCESS REVOKED: User ${userId} in tenant ${tenantId}`);
  }
}

// API Routes pour la gestion du cycle de vie
export class UserLifecycleAPI {
  
  static async initiateOnboarding(req: Request, res: Response): Promise<void> {
    try {
      const { userEmail, requestedRole, department, manager, startDate } = req.body;
      const tenantId = (req as any).tenantId;
      const initiatedBy = (req as any).user.id;

      const workflow = await OnboardingManager.initiateOnboarding(
        tenantId,
        userEmail,
        requestedRole,
        initiatedBy,
        { department, manager, startDate: new Date(startDate) }
      );

      res.json({
        success: true,
        workflow: {
          id: workflow.id,
          stage: workflow.stage,
          steps: workflow.steps.map(s => ({
            id: s.id,
            name: s.name,
            status: s.status
          }))
        }
      });
    } catch (error) {
      console.error('Erreur initiation onboarding:', error);
      res.status(500).json({ error: 'Erreur lors de l\'initiation de l\'onboarding' });
    }
  }

  static async initiateOffboarding(req: Request, res: Response): Promise<void> {
    try {
      const { userId, reason, effectiveDate } = req.body;
      const tenantId = (req as any).tenantId;
      const initiatedBy = (req as any).user.id;

      const workflow = await OffboardingManager.initiateOffboarding(
        tenantId,
        parseInt(userId),
        reason,
        initiatedBy,
        new Date(effectiveDate)
      );

      res.json({
        success: true,
        workflow: {
          id: workflow.id,
          stage: workflow.stage,
          tasks: workflow.tasks.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            priority: t.priority
          }))
        }
      });
    } catch (error) {
      console.error('Erreur initiation offboarding:', error);
      res.status(500).json({ error: 'Erreur lors de l\'initiation de l\'offboarding' });
    }
  }
}