import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

export interface TenantInvitationData {
  tenantName: string;
  tenantDomain: string;
  adminEmail: string;
  loginUrl: string;
  superAdminName?: string;
}

export async function sendTenantInvitation(data: TenantInvitationData): Promise<boolean> {
  try {
    const emailContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invitation Smart GMAO DiagFix</title>
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e0e0e0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .highlight { background: #f0f4ff; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Bienvenue sur Smart GMAO DiagFix</h1>
            <p>Votre plateforme de maintenance intelligente est prête</p>
        </div>
        
        <div class="content">
            <h2>Bonjour,</h2>
            
            <p>Félicitations ! Votre tenant <strong>"${data.tenantName}"</strong> a été créé avec succès sur la plateforme Smart GMAO DiagFix.</p>
            
            <div class="highlight">
                <h3>📋 Informations de votre tenant :</h3>
                <ul>
                    <li><strong>Nom :</strong> ${data.tenantName}</li>
                    <li><strong>Domaine :</strong> ${data.tenantDomain}</li>
                    <li><strong>Email administrateur :</strong> ${data.adminEmail}</li>
                </ul>
            </div>
            
            <h3>🔑 Accès à votre plateforme :</h3>
            <p>Cliquez sur le bouton ci-dessous pour accéder à votre interface de maintenance intelligente :</p>
            
            <div style="text-align: center;">
                <a href="${data.loginUrl}" class="btn">🚀 Accéder à Smart GMAO DiagFix</a>
            </div>
            
            <h3>✨ Fonctionnalités disponibles :</h3>
            <ul>
                <li>🤖 <strong>Diagnostic IA avancé</strong> - Analyse automatique des pannes</li>
                <li>📊 <strong>GMAO complète</strong> - Gestion des équipements et interventions</li>
                <li>📈 <strong>Maintenance préventive</strong> - Planification intelligente</li>
                <li>🔧 <strong>Gestion des pièces</strong> - Inventaire et commandes</li>
                <li>📱 <strong>Application mobile</strong> - Travail terrain avec QR codes</li>
                <li>🌐 <strong>Intégrations ERP</strong> - SAP, Maximo, SCADA</li>
            </ul>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p><strong>💡 Astuce :</strong> Commencez par configurer vos équipements dans l'onglet "GMAO" puis explorez les capacités de diagnostic IA dans "Smart Diagnostic".</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Smart GMAO DiagFix</strong> - Plateforme de maintenance industrielle intelligente</p>
            <p>En cas de questions, contactez le support technique.</p>
            ${data.superAdminName ? `<p>Invité par : ${data.superAdminName}</p>` : ''}
        </div>
    </div>
</body>
</html>`;

    await mailService.send({
      to: data.adminEmail,
      from: 'noreply@smart-gmao-diagfix.com', // Remplacez par votre adresse expéditeur vérifiée
      subject: `🚀 Bienvenue sur Smart GMAO DiagFix - Tenant "${data.tenantName}" créé`,
      html: emailContent,
      text: `
Bienvenue sur Smart GMAO DiagFix !

Votre tenant "${data.tenantName}" a été créé avec succès.

Informations :
- Nom : ${data.tenantName}  
- Domaine : ${data.tenantDomain}
- Email : ${data.adminEmail}

Accédez à votre plateforme : ${data.loginUrl}

Fonctionnalités disponibles :
- Diagnostic IA avancé
- GMAO complète  
- Maintenance préventive
- Gestion des pièces
- Application mobile
- Intégrations ERP

Smart GMAO DiagFix - Plateforme de maintenance industrielle intelligente
      `
    });

    return true;
  } catch (error) {
    console.error('Erreur envoi email invitation tenant:', error);
    return false;
  }
}

export async function sendTenantStatusNotification(
  adminEmail: string, 
  tenantName: string, 
  newStatus: 'activated' | 'deactivated' | 'deleted',
  reason?: string
): Promise<boolean> {
  try {
    const statusMessages = {
      activated: {
        subject: `✅ Tenant "${tenantName}" réactivé`,
        title: '✅ Accès restauré',
        message: 'Votre tenant a été réactivé avec succès. Vous pouvez de nouveau accéder à votre plateforme.',
        color: '#10b981'
      },
      deactivated: {
        subject: `⚠️ Tenant "${tenantName}" désactivé`,
        title: '⚠️ Accès suspendu',
        message: 'Votre tenant a été temporairement désactivé. Veuillez contacter le support pour plus d\'informations.',
        color: '#f59e0b'
      },
      deleted: {
        subject: `🗑️ Tenant "${tenantName}" supprimé`,
        title: '🗑️ Tenant supprimé',
        message: 'Votre tenant a été définitivement supprimé de la plateforme.',
        color: '#ef4444'
      }
    };

    const status = statusMessages[newStatus];

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${status.subject}</title>
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; }
        .header { background: ${status.color}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e0e0e0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${status.title}</h1>
            <p>Modification du statut de votre tenant</p>
        </div>
        
        <div class="content">
            <h2>Bonjour,</h2>
            
            <p>${status.message}</p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h3>📋 Détails :</h3>
                <ul>
                    <li><strong>Tenant :</strong> ${tenantName}</li>
                    <li><strong>Statut :</strong> ${newStatus === 'activated' ? 'Actif' : newStatus === 'deactivated' ? 'Désactivé' : 'Supprimé'}</li>
                    ${reason ? `<li><strong>Raison :</strong> ${reason}</li>` : ''}
                </ul>
            </div>
            
            ${newStatus === 'deactivated' ? '<p><strong>Pour réactiver votre tenant, veuillez contacter le support technique.</strong></p>' : ''}
        </div>
        
        <div class="footer">
            <p><strong>Smart GMAO DiagFix</strong> - Plateforme de maintenance industrielle intelligente</p>
        </div>
    </div>
</body>
</html>`;

    await mailService.send({
      to: adminEmail,
      from: 'noreply@smart-gmao-diagfix.com',
      subject: status.subject,
      html: emailContent
    });

    return true;
  } catch (error) {
    console.error('Erreur envoi notification statut tenant:', error);
    return false;
  }
}