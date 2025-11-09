/**
 * 📧 MODULE DE NOTIFICATIONS
 * 
 * Système de notifications pour les processus d'onboarding/offboarding
 * et alertes de sécurité
 */

import { Request, Response } from 'express';

// Interface pour l'envoi d'emails
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Envoie un email (simulation pour le développement)
 * Dans un environnement de production, intégrer avec SendGrid, AWS SES, etc.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    console.log(`📧 EMAIL SENT:`);
    console.log(`   To: ${options.to}`);
    console.log(`   Subject: ${options.subject}`);
    console.log(`   Content: ${options.html.substring(0, 100)}...`);
    
    // Simulation d'envoi réussi
    return true;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return false;
  }
}

/**
 * Envoie une notification SMS (simulation)
 */
export async function sendSMS(phone: string, message: string): Promise<boolean> {
  try {
    console.log(`📱 SMS SENT to ${phone}: ${message}`);
    return true;
  } catch (error) {
    console.error('❌ SMS sending failed:', error);
    return false;
  }
}

/**
 * Envoie une notification push (simulation)
 */
export async function sendPushNotification(
  userId: number, 
  title: string, 
  message: string
): Promise<boolean> {
  try {
    console.log(`🔔 PUSH NOTIFICATION to User ${userId}: ${title} - ${message}`);
    return true;
  } catch (error) {
    console.error('❌ Push notification failed:', error);
    return false;
  }
}

/**
 * Template d'email pour l'invitation d'accès tenant
 */
function generateTenantInvitationEmail(tenantData: {
  name: string;
  plan: string;
  maxUsers: number;
  contactEmail: string;
  domain?: string;
  tenantId: string;
}): string {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://maintrix.replit.app' 
    : 'http://localhost:5000';
  
  const loginUrl = tenantData.domain 
    ? `https://${tenantData.domain}` 
    : `${baseUrl}?tenant=${tenantData.tenantId}`;

  const planFeatures = {
    free: ['Smart Diagnostic de base', 'Support communautaire'],
    pro: ['Smart Diagnostic avancé', 'Multi-équipements', 'Export CSV', 'Support prioritaire'],
    business: ['Tout Pro +', 'Rapports avancés', 'API REST', 'Intégrations'],
    enterprise: ['Tout Business +', 'IA Collaborative', 'Sécurité renforcée', 'Support dédié', 'SLA garantis']
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e0e0e0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #666; }
        .btn { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .plan-badge { background: #e3f2fd; color: #1976d2; padding: 5px 15px; border-radius: 20px; font-weight: bold; display: inline-block; margin: 10px 0; }
        .features { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .feature { color: #28a745; margin: 5px 0; }
        .alert { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Bienvenue dans Maintrix</h1>
          <p>Votre accès a été configuré avec succès</p>
        </div>
        
        <div class="content">
          <p>Bonjour,</p>
          
          <p>Excellente nouvelle ! Votre organisation <strong>${tenantData.name}</strong> a maintenant accès à Maintrix, la plateforme de maintenance intelligente qui révolutionne la gestion industrielle.</p>
          
          <div class="plan-badge">Plan ${tenantData.plan.toUpperCase()}</div>
          
          <div class="features">
            <h3>🚀 Vos fonctionnalités incluses :</h3>
            ${(planFeatures[tenantData.plan as keyof typeof planFeatures] || []).map(feature => 
              `<div class="feature">✅ ${feature}</div>`
            ).join('')}
          </div>

          <div class="alert">
            <strong>📊 Votre configuration :</strong><br>
            • Utilisateurs maximum : <strong>${tenantData.maxUsers}</strong><br>
            • Contact principal : <strong>${tenantData.contactEmail}</strong><br>
            • ID Tenant : <code>${tenantData.tenantId}</code>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" class="btn">🔗 ACCÉDER À VOTRE PLATEFORME</a>
          </div>

          <h3>🔧 Premiers pas recommandés :</h3>
          <ol>
            <li><strong>Connexion :</strong> Cliquez sur le lien ci-dessus pour accéder à votre tableau de bord</li>
            <li><strong>Configuration :</strong> Ajoutez vos équipements dans le module GMAO</li>
            <li><strong>Diagnostic :</strong> Testez l'IA de diagnostic sur vos premiers cas</li>
            <li><strong>Formation :</strong> Explorez la documentation intégrée</li>
          </ol>

          <div class="alert">
            <strong>🛡️ Sécurité et conformité garanties :</strong><br>
            • Chiffrement AES-256 de toutes vos données<br>
            • Isolation totale entre tenants<br>
            • Conformité RGPD complète<br>
            • Journaux d'audit complets
          </div>

          <p>Notre équipe support est disponible pour vous accompagner dans la prise en main de la plateforme.</p>
          
          <p>Cordialement,<br>
          <strong>L'équipe Maintrix</strong></p>
        </div>
        
        <div class="footer">
          <p>Maintrix - Plateforme de Maintenance Intelligente</p>
          <p>Cette invitation est personnelle et confidentielle pour ${tenantData.name}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Envoie un email d'invitation d'accès tenant avec lien de connexion
 */
export async function sendTenantAccessNotification(tenantData: {
  name: string;
  plan: string;
  maxUsers: number;
  contactEmail: string;
  domain?: string;
  tenantId: string;
}): Promise<boolean> {
  if (!tenantData.contactEmail) {
    console.error('❌ Cannot send tenant notification: no contact email provided');
    return false;
  }

  const emailContent = generateTenantInvitationEmail(tenantData);

  return await sendEmail({
    to: tenantData.contactEmail,
    subject: `🎉 Accès accordé à Maintrix - ${tenantData.name}`,
    html: emailContent,
    from: 'noreply@smartgmao.com'
  });
}

/**
 * Envoie un email de modification d'accès tenant
 */
export async function sendTenantAccessUpdateNotification(tenantData: {
  name: string;
  plan: string;
  maxUsers: number;
  contactEmail: string;
  domain?: string;
  tenantId: string;
  changes: string[];
}): Promise<boolean> {
  if (!tenantData.contactEmail) {
    return false;
  }

  const changesHtml = tenantData.changes.map(change => `<li>${change}</li>`).join('');
  
  const emailContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e0e0e0; }
        .alert { background: #e3f2fd; border: 1px solid #2196f3; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔄 Mise à jour de votre accès</h1>
          <p>Maintrix</p>
        </div>
        
        <div class="content">
          <p>Bonjour,</p>
          
          <p>Votre accès à Maintrix pour <strong>${tenantData.name}</strong> a été mis à jour.</p>
          
          <div class="alert">
            <h3>📋 Modifications appliquées :</h3>
            <ul>${changesHtml}</ul>
          </div>

          <p>Ces modifications sont effectives immédiatement. Vous pouvez continuer à utiliser la plateforme normalement.</p>
          
          <p>Cordialement,<br>
          <strong>L'équipe Maintrix</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: tenantData.contactEmail,
    subject: `🔄 Mise à jour de votre accès Maintrix - ${tenantData.name}`,
    html: emailContent,
    from: 'noreply@smartgmao.com'
  });
}