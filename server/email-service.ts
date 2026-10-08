import { MailService } from '@sendgrid/mail';
import { CredentialNotification } from './credential-generator';

// SendGrid optionnel pour déploiement local
const SENDGRID_ENABLED = !!process.env.SENDGRID_API_KEY;

/**
 * L'envoi de courriel est-il configuré sur cet environnement ?
 *
 * Exporté pour que les pages qui PROMETTENT un courriel puissent dire la
 * vérité. Sans cette information, « mot de passe oublié » répondait « un
 * lien a été envoyé » alors que rien ne partait, et l'utilisateur attendait
 * un message qui ne viendrait jamais.
 */
/**
 * L'adresse d'expéditeur, telle que déclarée dans l'environnement.
 *
 * ═══════════════════════════════════════════════════════════════
 * POURQUOI ELLE N'EST PLUS ÉCRITE DANS LE CODE
 * ═══════════════════════════════════════════════════════════════
 * Six endroits portaient une adresse en dur — « noreply@maintrix-t.com »,
 * « noreply@smartgmao.com » — dont aucune ne correspondait au domaine
 * réellement exploité. SendGrid REFUSE tout message dont l'expéditeur n'est
 * pas une identité vérifiée : la clé aurait été correcte, la configuration
 * complète, et pas un seul courriel ne serait parti. Les échecs étant
 * seulement journalisés, personne ne l'aurait vu.
 *
 * `SENDGRID_FROM_EMAIL` était déjà transmise par docker-compose.test.yml,
 * et lue nulle part.
 */
export function expediteurCourriel(): string {
  return (process.env.SENDGRID_FROM_EMAIL || '').trim();
}

/**
 * L'envoi est-il RÉELLEMENT possible ?
 *
 * Une clé sans adresse d'expéditeur vérifiée ne sert à rien : les deux sont
 * nécessaires, et une configuration à moitié faite est pire que pas de
 * configuration du tout — elle laisse croire que les courriels partent.
 */
export function envoiCourrielConfigure(): boolean {
  return SENDGRID_ENABLED && expediteurCourriel() !== '';
}

/**
 * La raison du refus, telle que SendGrid la donne.
 *
 * ⚠️ `console.error('…', error)` sur une erreur SendGrid n'affiche PAS
 * l'essentiel : le motif se trouve dans `error.response.body.errors`, que le
 * formatage par défaut laisse de côté. On lisait donc « Erreur envoi email »
 * suivi d'une pile d'appels, sans jamais savoir que SendGrid répondait
 * « from address does not match a verified Sender Identity » — la cause la
 * plus fréquente, et la seule sur laquelle l'exploitant peut agir.
 */
export function raisonErreurCourriel(erreur: unknown): string {
  const e = erreur as { code?: number; message?: string; response?: { body?: unknown } };
  const corps = e?.response?.body as { errors?: Array<{ message?: string; field?: string; help?: string }> } | undefined;
  const motifs = (corps?.errors ?? [])
    .map((m) => [m.message, m.field && `(champ « ${m.field} »)`, m.help].filter(Boolean).join(' '))
    .filter(Boolean);

  const entete = e?.code ? `SendGrid a répondu ${e.code}` : 'envoi refusé';
  if (motifs.length) return `${entete} — ${motifs.join(' | ')}`;

  // Pas de corps exploitable : on rend au moins le message brut, et la piste.
  const brut = e?.message || String(erreur);
  return e?.code === 403
    ? `${entete} — ${brut}. Vérifiez que « ${expediteurCourriel()} » est une identité d'expéditeur vérifiée sur SendGrid.`
    : `${entete} — ${brut}`;
}

let mailService: MailService | null = null;

if (SENDGRID_ENABLED) {
  mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY!);
  console.log('✅ SendGrid email service enabled');
} else {
  console.log('⚠️ SendGrid disabled (SENDGRID_API_KEY not set) - Email notifications will be skipped');
}

export interface TenantInvitationData {
  tenantName: string;
  tenantDomain: string;
  adminEmail: string;
  loginUrl: string;
  superAdminName?: string;
}

export async function sendTenantInvitation(data: TenantInvitationData): Promise<boolean> {
  if (!SENDGRID_ENABLED || !mailService) {
    console.log('⚠️ SendGrid not configured - Skipping tenant invitation email');
    return false;
  }
  
  try {
    const emailContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invitation Maintrix</title>
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
            <h1>🚀 Bienvenue sur Maintrix</h1>
            <p>Votre plateforme de maintenance intelligente est prête</p>
        </div>
        
        <div class="content">
            <h2>Bonjour,</h2>
            
            <p>Félicitations ! Votre tenant <strong>"${data.tenantName}"</strong> a été créé avec succès sur la plateforme Maintrix.</p>
            
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
                <a href="${data.loginUrl}" class="btn">🚀 Accéder à Maintrix</a>
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
            <p><strong>Maintrix</strong> - Plateforme de maintenance industrielle intelligente</p>
            <p>En cas de questions, contactez le support technique.</p>
            ${data.superAdminName ? `<p>Invité par : ${data.superAdminName}</p>` : ''}
        </div>
    </div>
</body>
</html>`;

    await mailService.send({
      to: data.adminEmail,
      from: expediteurCourriel(),
      subject: `🚀 Bienvenue sur Maintrix - Tenant "${data.tenantName}" créé`,
      html: emailContent,
      text: `
Bienvenue sur Maintrix !

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

Maintrix - Plateforme de maintenance industrielle intelligente
      `
    });

    return true;
  } catch (error) {
    console.error('Erreur envoi email invitation tenant :', raisonErreurCourriel(error));
    return false;
  }
}

export async function sendTenantStatusNotification(
  adminEmail: string, 
  tenantName: string, 
  newStatus: 'activated' | 'deactivated' | 'deleted',
  reason?: string
): Promise<boolean> {
  if (!SENDGRID_ENABLED || !mailService) {
    console.log('⚠️ SendGrid not configured - Skipping tenant status notification');
    return false;
  }
  
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
            <p><strong>Maintrix</strong> - Plateforme de maintenance industrielle intelligente</p>
        </div>
    </div>
</body>
</html>`;

    await mailService.send({
      to: adminEmail,
      from: expediteurCourriel(),
      subject: status.subject,
      html: emailContent
    });

    return true;
  } catch (error) {
    console.error('Erreur envoi notification statut tenant :', raisonErreurCourriel(error));
    return false;
  }
}

/**
 * 🔐 Envoyer les identifiants par défaut par email
 */
export async function sendTenantCredentials(notification: CredentialNotification): Promise<boolean> {
  if (!SENDGRID_ENABLED || !mailService) {
    console.log('⚠️ SendGrid not configured - Skipping credentials email');
    return false;
  }
  
  try {
    const emailContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>🔐 Vos identifiants Maintrix</title>
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e0e0e0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
        .credentials { background: #f0f4ff; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 6px; }
        .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .security-item { background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 4px; }
        .monospace { font-family: 'Courier New', monospace; font-size: 16px; font-weight: bold; color: #2563eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Identifiants de connexion</h1>
            <p>Votre accès à Maintrix - ${notification.tenantName}</p>
        </div>
        
        <div class="content">
            <h2>Bonjour ${notification.recipientName || ''},</h2>
            
            <p>Votre compte a été créé avec succès sur la plateforme <strong>Maintrix</strong> pour le tenant <strong>"${notification.tenantName}"</strong>.</p>
            
            <div class="credentials">
                <h3>🔑 Vos identifiants temporaires :</h3>
                <p><strong>Nom d'utilisateur :</strong> <span class="monospace">${notification.username}</span></p>
                <p><strong>Mot de passe temporaire :</strong> <span class="monospace">${notification.temporaryPassword}</span></p>
                <p><strong>URL de connexion :</strong> <a href="${notification.loginUrl}" class="monospace">${notification.loginUrl}</a></p>
                <p><strong>⏰ Expire le :</strong> ${notification.expiresAt.toLocaleDateString('fr-FR')} à ${notification.expiresAt.toLocaleTimeString('fr-FR')}</p>
            </div>
            
            <div class="warning">
                <h3>🚨 IMPORTANT - Sécurité obligatoire :</h3>
                <p><strong>Vous DEVEZ changer votre mot de passe lors de votre première connexion.</strong></p>
                <p>Ces identifiants sont temporaires et <strong>expireront automatiquement</strong> si vous ne vous connectez pas avant la date limite.</p>
            </div>
            
            <div style="text-align: center;">
                <a href="${notification.loginUrl}" class="btn">🚀 Se connecter maintenant</a>
            </div>
            
            <h3>🛡️ Instructions de sécurité :</h3>
            ${notification.securityInstructions.map(instruction => 
              `<div class="security-item">✅ ${instruction}</div>`
            ).join('')}
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p><strong>💡 Conseil :</strong> Une fois connecté, dirigez-vous vers les paramètres de votre profil pour :</p>
                <ul>
                    <li>Changer votre mot de passe</li>
                    <li>Configurer l'authentification à deux facteurs (recommandé)</li>
                    <li>Compléter vos informations de profil</li>
                </ul>
            </div>
            
            ${notification.isFirstLogin ? `
            <div style="background: #fff4e6; border: 1px solid #fed7aa; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h3>🎯 Première connexion :</h3>
                <p>En tant que ${notification.isFirstLogin ? 'administrateur' : 'utilisateur'} de ce tenant, vous pourrez :</p>
                <ul>
                    <li>📊 Configurer les équipements et zones</li>
                    <li>👥 Inviter et gérer les utilisateurs</li>
                    <li>🔧 Planifier la maintenance préventive</li>
                    <li>🤖 Utiliser le diagnostic IA avancé</li>
                </ul>
            </div>
            ` : ''}
        </div>
        
        <div class="footer">
            <p><strong>Maintrix</strong> - Plateforme de maintenance industrielle intelligente</p>
            <p style="font-size: 12px; color: #6b7280;">
                Cet email contient des informations confidentielles. Si vous l'avez reçu par erreur, veuillez le supprimer immédiatement.
            </p>
        </div>
    </div>
</body>
</html>`;

    await mailService.send({
      to: notification.recipientEmail,
      from: expediteurCourriel(),
      subject: `🔐 Vos identifiants Maintrix - ${notification.tenantName}`,
      html: emailContent
    });

    console.log(`✅ Identifiants envoyés par email à ${notification.recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Erreur envoi identifiants :', raisonErreurCourriel(error));
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// DIAGNOSTIC DE L'ENVOI — « pourquoi les courriels ne partent-ils pas ? »
// ═══════════════════════════════════════════════════════════════════
// La page /email-diagnostic appelait deux routes qui N'EXISTAIENT PAS : elles
// étaient commentées dans super-admin-routes.ts, avec la mention « déplacées
// vers email-service.ts » — où elles n'ont jamais été écrites. Les boutons
// renvoyaient donc « 404 Route API inconnue », ce qui ressemble à un problème
// SendGrid alors que la requête n'a jamais quitté Maintrix.
// Constaté le 2026-10-08.
//
// Une adresse « vérifiée » dans l'interface SendGrid ne garantit rien : encore
// faut-il que LA CLÉ du serveur ait le droit d'envoyer, et que ce soit bien
// cette adresse-là qui soit configurée ici. Ces fonctions séparent les causes.

/** Une clé SendGrid : « SG. » puis deux segments. On ne lit jamais sa valeur. */
const FORME_CLE_SENDGRID = /^SG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}$/;

export interface DiagnosticCourriel {
  /** Rien ne s'oppose à l'envoi, côté configuration. */
  success: boolean;
  /** Conservé sous ce nom : la page de diagnostic s'appuie dessus. */
  apiKeyValid: boolean;
  clePresente: boolean;
  formeCleValide: boolean;
  peutEnvoyer: boolean;
  expediteur: string;
  /** `null` quand la clé n'a pas le droit de consulter la liste. */
  expediteurVerifie: boolean | null;
  domaineAuthentifie: boolean | null;
  identitesVerifiees: string[];
  error?: string;
}

async function appelerSendGrid(chemin: string, options: RequestInit = {}) {
  const reponse = await fetch(`https://api.sendgrid.com/v3${chemin}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const texte = await reponse.text();
  let corps: any = null;
  try { corps = texte ? JSON.parse(texte) : null; } catch { corps = texte; }
  return { statut: reponse.status, corps };
}

export async function diagnostiquerEnvoiCourriel(): Promise<DiagnosticCourriel> {
  const cle = (process.env.SENDGRID_API_KEY || '').trim();
  const expediteur = expediteurCourriel();

  const base: DiagnosticCourriel = {
    success: false,
    apiKeyValid: false,
    clePresente: !!cle,
    formeCleValide: FORME_CLE_SENDGRID.test(cle),
    peutEnvoyer: false,
    expediteur,
    expediteurVerifie: null,
    domaineAuthentifie: null,
    identitesVerifiees: [],
  };

  if (!cle) {
    return {
      ...base,
      error: "SENDGRID_API_KEY est absente du conteneur. Si elle figure dans le fichier "
        + "d'environnement, c'est que le conteneur n'a pas été recréé depuis : Docker fige "
        + "les variables à la création, un simple redémarrage ne relit rien.",
    };
  }
  if (!expediteur) {
    return {
      ...base,
      error: "SENDGRID_FROM_EMAIL est absente : l'application n'a aucune adresse d'expédition.",
    };
  }

  try {
    const scopes = await appelerSendGrid('/scopes');

    if (scopes.statut === 401) {
      return {
        ...base,
        error: "SendGrid refuse la clé (401) : elle est invalide, révoquée, ou tronquée.",
      };
    }
    if (scopes.statut !== 200) {
      return {
        ...base,
        error: `SendGrid a répondu ${scopes.statut} à une simple lecture des permissions.`,
      };
    }

    const permissions: string[] = scopes.corps?.scopes ?? [];
    if (!permissions.includes('mail.send')) {
      return {
        ...base,
        apiKeyValid: true,
        error: "Cette clé est valide mais n'a pas la permission « Mail Send » : elle ne peut "
          + "envoyer aucun courriel. Sur SendGrid : Settings → API Keys → cette clé → Mail Send.",
      };
    }

    // L'expéditeur est-il reconnu ? Cause la plus fréquente, et invisible côté
    // application : SendGrid accepte la clé, puis refuse le message.
    let expediteurVerifie: boolean | null = null;
    let identites: string[] = [];
    const senders = await appelerSendGrid('/verified_senders');
    if (senders.statut === 200) {
      identites = (senders.corps?.results ?? [])
        .filter((s: any) => s.verified)
        .map((s: any) => String(s.from_email || '').toLowerCase());
      expediteurVerifie = identites.includes(expediteur.toLowerCase());
    }

    // Un domaine authentifié dispense de vérifier chaque adresse une par une.
    let domaineAuthentifie: boolean | null = null;
    const domaines = await appelerSendGrid('/whitelabel/domains');
    if (domaines.statut === 200 && Array.isArray(domaines.corps)) {
      const domaineExpediteur = expediteur.split('@')[1]?.toLowerCase() ?? '';
      domaineAuthentifie = domaines.corps
        .filter((d: any) => d.valid)
        .some((d: any) => String(d.domain || '').toLowerCase() === domaineExpediteur);
    }

    const reconnu = expediteurVerifie === true || domaineAuthentifie === true;
    // Si la clé ne peut consulter NI les expéditeurs NI les domaines, on ne
    // peut pas conclure : seul un envoi réel tranchera. On ne crie pas au loup.
    const indecidable = expediteurVerifie === null && domaineAuthentifie === null;

    return {
      ...base,
      apiKeyValid: true,
      peutEnvoyer: true,
      expediteurVerifie,
      domaineAuthentifie,
      identitesVerifiees: identites,
      success: reconnu || indecidable,
      error: reconnu || indecidable ? undefined
        : `« ${expediteur} » n'apparaît ni comme identité d'expéditeur vérifiée, ni sous un `
          + "domaine authentifié sur ce compte SendGrid. Chaque message sera refusé par un 403."
          + (identites.length ? ` Identités vérifiées : ${identites.join(', ')}.` : ''),
    };
  } catch (erreur) {
    return {
      ...base,
      error: `SendGrid est injoignable depuis le serveur : ${raisonErreurCourriel(erreur)}`,
    };
  }
}

export interface ResultatCourrielTest {
  success: boolean;
  statut?: number;
  expediteur: string;
  error?: string;
  details?: unknown;
}

/**
 * Envoyer un vrai message de test.
 *
 * ⚠️ L'expéditeur n'est JAMAIS celui que propose l'appelant : il vient de la
 * configuration. La page de diagnostic laissait saisir une adresse quelconque
 * — « votre-email@gmail.com » par défaut — ce qui garantissait un refus 403 et
 * laissait croire que SendGrid était en cause, alors que le test lui-même
 * était mal posé.
 */
export async function envoyerCourrielDeTest(destinataire: string): Promise<ResultatCourrielTest> {
  const expediteur = expediteurCourriel();

  if (!envoiCourrielConfigure()) {
    return {
      success: false,
      expediteur,
      error: "L'envoi n'est pas configuré : clé API ou adresse d'expédition manquante.",
    };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destinataire || '')) {
    return { success: false, expediteur, error: 'Adresse de destination invalide.' };
  }

  try {
    const envoi = await appelerSendGrid('/mail/send', {
      method: 'POST',
      body: JSON.stringify({
        personalizations: [{ to: [{ email: destinataire }] }],
        from: { email: expediteur, name: 'Maintrix' },
        subject: 'Maintrix — test de configuration des courriels',
        content: [{
          type: 'text/plain',
          value: "Ce message confirme que l'environnement Maintrix peut émettre des courriels.\n"
            + `Expéditeur configuré : ${expediteur}\n`
            + `Envoyé le ${new Date().toLocaleString('fr-FR')}.`,
        }],
      }),
    });

    if (envoi.statut === 202) {
      console.log(`✅ Courriel de test accepté par SendGrid pour ${destinataire}`);
      return { success: true, statut: 202, expediteur };
    }

    const motifs: string[] = (envoi.corps?.errors ?? [])
      .map((e: any) => [e.message, e.field && `(champ « ${e.field} »)`].filter(Boolean).join(' '));
    const error = `SendGrid a refusé le message (${envoi.statut})`
      + (motifs.length ? ` — ${motifs.join(' | ')}` : '');
    console.error(`❌ ${error}`);
    return { success: false, statut: envoi.statut, expediteur, error, details: envoi.corps };
  } catch (erreur) {
    const error = `SendGrid est injoignable depuis le serveur : ${raisonErreurCourriel(erreur)}`;
    console.error(`❌ ${error}`);
    return { success: false, expediteur, error };
  }
}
