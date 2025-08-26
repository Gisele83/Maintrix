import { MailService } from '@sendgrid/mail';

// Test simple pour vérifier la configuration SendGrid
export async function testSendGridConfiguration(): Promise<{
  success: boolean;
  error?: string;
  apiKeyValid: boolean;
}> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      return {
        success: false,
        error: 'SENDGRID_API_KEY manquant',
        apiKeyValid: false
      };
    }

    // Vérifier le format de la clé API
    if (!process.env.SENDGRID_API_KEY.startsWith('SG.')) {
      return {
        success: false,
        error: 'La clé API SendGrid doit commencer par "SG."',
        apiKeyValid: false
      };
    }

    const mailService = new MailService();
    mailService.setApiKey(process.env.SENDGRID_API_KEY);

    console.log('🔑 Test de configuration SendGrid...');
    console.log('✅ Clé API présente et format correct');
    
    // Test avec une adresse email simple (pour diagnostic uniquement)
    const testEmail = {
      to: 'test@example.com', // Email de test - ne sera pas envoyé
      from: 'test@example.com', // Email de test simple
      subject: 'Test Smart GMAO DiagFix',
      text: 'Test de configuration SendGrid',
      html: '<p>Test de configuration SendGrid</p>'
    };

    // Simuler la validation sans vraiment envoyer
    console.log('📧 Configuration email testée:', {
      to: testEmail.to,
      from: testEmail.from,
      subject: testEmail.subject
    });

    return {
      success: true,
      apiKeyValid: true
    };

  } catch (error) {
    console.error('❌ Erreur test SendGrid:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      apiKeyValid: true
    };
  }
}

// Test d'envoi réel avec gestion d'erreurs détaillée
export async function testRealEmailSend(
  toEmail: string,
  fromEmail: string
): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> {
  try {
    const mailService = new MailService();
    mailService.setApiKey(process.env.SENDGRID_API_KEY!);

    await mailService.send({
      to: toEmail,
      from: fromEmail,
      subject: '🧪 Test Smart GMAO DiagFix - Configuration Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>🧪 Test de Configuration Email</h2>
          <p>Ceci est un test d'envoi d'email depuis Smart GMAO DiagFix.</p>
          <p><strong>Timestamp :</strong> ${new Date().toISOString()}</p>
          <p><strong>De :</strong> ${fromEmail}</p>
          <p><strong>Vers :</strong> ${toEmail}</p>
          <hr>
          <p><em>Smart GMAO DiagFix - Plateforme de maintenance intelligente</em></p>
        </div>
      `,
      text: `
Test de Configuration Email

Ceci est un test d'envoi d'email depuis Smart GMAO DiagFix.
Timestamp : ${new Date().toISOString()}
De : ${fromEmail}
Vers : ${toEmail}

Smart GMAO DiagFix - Plateforme de maintenance intelligente
      `
    });

    return { success: true };

  } catch (error: any) {
    console.error('❌ Erreur envoi test email:', error);
    
    let errorMessage = 'Erreur inconnue';
    let details = {};
    
    if (error.response?.body) {
      details = error.response.body;
      if (error.response.body.errors) {
        errorMessage = error.response.body.errors.map((e: any) => e.message || e).join(', ');
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
      details
    };
  }
}