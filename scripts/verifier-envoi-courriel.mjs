#!/usr/bin/env node
/**
 * Pourquoi les courriels ne partent-ils pas ?
 *
 *   sudo node scripts/verifier-envoi-courriel.mjs
 *   sudo node scripts/verifier-envoi-courriel.mjs --envoyer vous@exemple.fr
 *   sudo node scripts/verifier-envoi-courriel.mjs --suivre destinataire@exemple.fr
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CET OUTIL EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * « Le lien de réinitialisation ne m'arrive pas » a au moins cinq causes, et
 * l'application ne peut en distinguer aucune : elle reçoit un refus de SendGrid
 * et journalise « Erreur envoi email », sans la raison.
 *
 *   1. la clé API est absente du CONTENEUR (elle est dans le fichier, mais le
 *      conteneur n'a pas été recréé — Docker fige les variables à la création) ;
 *   2. la clé est invalide ou révoquée → 401 ;
 *   3. la clé n'a pas la permission « Mail Send » → 403 ;
 *   4. l'adresse d'expéditeur n'est pas une identité VÉRIFIÉE chez SendGrid →
 *      403 « from address does not match a verified Sender Identity ». C'est la
 *      cause la plus fréquente, et elle ne se voit nulle part côté application ;
 *   5. l'adresse du destinataire est sur une LISTE DE SUPPRESSION de SendGrid :
 *      il répond 202 « accepté », puis jette le message sans rien dire. Un
 *      rebond ou un signalement passé suffit à l'y inscrire, et elle y reste
 *      même quand la cause a disparu (--suivre) ;
 *   6. tout fonctionne, et le message est classé en indésirable.
 *
 * Par défaut, cet outil N'ENVOIE RIEN : il interroge l'API de SendGrid en
 * lecture seule et confronte l'expéditeur configuré à la liste des identités
 * vérifiées. L'envoi d'un message de test est possible, mais seulement sur une
 * adresse que vous indiquez explicitement.
 */
import { spawnSync } from 'node:child_process';

const APP = process.env.MAINTRIX_CONTENEUR_APP || 'maintrix-test-app';

const rouge = (m) => console.error(`\x1b[31m${m}\x1b[0m`);
const jaune = (m) => console.log(`\x1b[33m${m}\x1b[0m`);
const vert = (m) => console.log(`\x1b[32m${m}\x1b[0m`);
const gris = (m) => console.log(`\x1b[90m${m}\x1b[0m`);
const mourir = (m, detail) => { rouge(`\n⛔ ${m}`); if (detail) console.error(String(detail).trim()); process.exit(1); };

const args = process.argv.slice(2);
const destinataire = (() => {
  const i = args.indexOf('--envoyer');
  return i >= 0 ? args[i + 1] : null;
})();

if (args.includes('--envoyer') && !destinataire) {
  mourir('--envoyer attend une adresse de destination.');
}

// ── 1. Ce que le conteneur voit ─────────────────────────────────────
const lire = (variable) => {
  const r = spawnSync('docker', ['exec', APP, 'sh', '-c', `printf %s "$${variable}"`], { encoding: 'utf8' });
  if (r.status !== 0) {
    mourir(`impossible d'interroger le conteneur « ${APP} ».`,
      (r.stderr || '') + '\nLancez la commande avec sudo, et vérifiez que le conteneur tourne.');
  }
  return r.stdout.trim();
};

console.log('\n═══ Ce que voit le conteneur ═══════════════════════════════\n');

const cle = lire('SENDGRID_API_KEY');
const expediteur = lire('SENDGRID_FROM_EMAIL');

const etat = (ok, texte) => `${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${texte}`;

// Une clé SendGrid commence par « SG. » et compte une soixantaine de caractères.
// On n'affiche jamais sa valeur : sa forme suffit à écarter la cause n°1.
const formeCle = /^SG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}$/.test(cle);
console.log(etat(!!cle, `clé API : ${cle ? `${cle.length} caractères, commence par « ${cle.slice(0, 3)} »` : 'ABSENTE DU CONTENEUR'}`));
if (cle && !formeCle) {
  jaune('  ⚠ cette valeur n\'a pas la forme d\'une clé SendGrid (SG.xxx.yyy).');
}
console.log(etat(!!expediteur, `expéditeur : ${expediteur || 'ABSENT'}`));

if (!cle) {
  mourir('la clé n\'est pas dans le conteneur : aucun courriel ne peut partir.',
    'Si elle figure bien dans .env.test-cloud, le conteneur n\'a pas été recréé depuis.\n' +
    'Docker fige les variables à la CRÉATION : « restart » ne relit rien.');
}
if (!expediteur) {
  mourir('SENDGRID_FROM_EMAIL est absent : l\'application n\'a pas d\'adresse d\'expédition.');
}

// ── 2. La clé est-elle valide, et que peut-elle faire ? ─────────────
console.log('\n═══ Ce qu\'en dit SendGrid ══════════════════════════════════\n');

const appeler = async (chemin, options = {}) => {
  const reponse = await fetch(`https://api.sendgrid.com/v3${chemin}`, {
    ...options,
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const texte = await reponse.text();
  let corps = null;
  try { corps = texte ? JSON.parse(texte) : null; } catch { corps = texte; }
  return { statut: reponse.status, corps };
};

const scopes = await appeler('/scopes');

if (scopes.statut === 401) {
  mourir('SendGrid refuse la clé (401) : elle est invalide, révoquée, ou tronquée.',
    'Régénérez-en une sur SendGrid, puis réécrivez-la dans .env.test-cloud\n' +
    'et RECRÉEZ le conteneur (up -d --force-recreate app).');
}
if (scopes.statut !== 200) {
  mourir(`SendGrid a répondu ${scopes.statut} à une simple lecture des permissions.`,
    JSON.stringify(scopes.corps, null, 2));
}

const permissions = scopes.corps?.scopes ?? [];
const peutEnvoyer = permissions.includes('mail.send');
console.log(etat(true, 'clé acceptée par SendGrid (401 écarté)'));
console.log(etat(peutEnvoyer, `permission « mail.send » : ${peutEnvoyer ? 'accordée' : 'ABSENTE'}`));
if (!peutEnvoyer) {
  rouge('  ⚠ Cette clé ne peut pas envoyer de courriel, quelle que soit la configuration.');
  rouge('    Sur SendGrid : Settings → API Keys → cette clé → activer « Mail Send ».');
}

// ── 3. L'expéditeur est-il une identité vérifiée ? ──────────────────
// C'est la cause n°4, invisible côté application : SendGrid accepte la clé,
// puis refuse le message parce que l'adresse « from » n'est pas à lui.
const senders = await appeler('/verified_senders');
let verifie = null;

if (senders.statut === 200) {
  const liste = (senders.corps?.results ?? [])
    .filter((s) => s.verified)
    .map((s) => String(s.from_email || '').toLowerCase());
  verifie = liste.includes(expediteur.toLowerCase());
  console.log(etat(verifie, `« ${expediteur} » ${verifie ? 'est' : "N'EST PAS"} une identité d'expéditeur vérifiée`));
  if (!verifie) {
    if (liste.length) {
      gris(`  Identités vérifiées sur ce compte : ${liste.join(', ')}`);
    } else {
      gris('  Aucune identité d\'expéditeur vérifiée sur ce compte.');
    }
    gris('  Une authentification de DOMAINE (Sender Authentication) suffit aussi :');
    gris('  dans ce cas cette liste peut être vide alors que l\'envoi fonctionne.');
  }
} else {
  jaune(`la liste des expéditeurs vérifiés n'est pas lisible (${senders.statut}) —`);
  jaune('la clé n\'a probablement pas la permission de la consulter. Ce n\'est pas');
  jaune('bloquant pour l\'envoi ; seul le test réel tranchera.');
}

// ── 4. Domaine authentifié ? ────────────────────────────────────────
const domaines = await appeler('/whitelabel/domains');
if (domaines.statut === 200 && Array.isArray(domaines.corps)) {
  const domaineExpediteur = expediteur.split('@')[1]?.toLowerCase() ?? '';
  const valides = domaines.corps.filter((d) => d.valid);
  const couvert = valides.some((d) => String(d.domain || '').toLowerCase() === domaineExpediteur);
  console.log(etat(couvert || verifie === true,
    `domaine « ${domaineExpediteur} » ${couvert ? 'authentifié' : 'non authentifié'} chez SendGrid`));
  if (!couvert && valides.length) {
    gris(`  Domaines authentifiés : ${valides.map((d) => d.domain).join(', ')}`);
  }
}

// ── 5. Conclusion ───────────────────────────────────────────────────
console.log('\n═══ Conclusion ═════════════════════════════════════════════\n');

if (!peutEnvoyer) {
  rouge('La clé n\'a pas le droit d\'envoyer. C\'est la cause, et elle est unique.');
  process.exit(1);
} else if (verifie === false) {
  jaune('La clé est bonne, mais l\'adresse d\'expédition n\'apparaît pas comme');
  jaune('identité vérifiée. Si le domaine n\'est pas authentifié non plus,');
  jaune('SendGrid refusera chaque message avec un 403.');
  gris('Le test réel ci-dessous le confirmera en une seconde.');
} else {
  vert('Rien ne s\'oppose à l\'envoi du côté de la configuration.');
  gris('Si les messages n\'arrivent toujours pas : regardez les indésirables,');
  gris('puis l\'activité sur SendGrid (Activity Feed), qui dit si le message est');
  gris('parti, a été rejeté par le destinataire, ou mis en liste de suppression.');
}

// ═══════════════════════════════════════════════════════════════════
// LE DESTINATAIRE EST-IL SUR UNE LISTE DE SUPPRESSION ?
// ═══════════════════════════════════════════════════════════════════
// ⚠️ SendGrid répond 202 — « accepté » — PUIS jette le message, sans rien dire,
// si l'adresse figure sur l'une de ses listes de suppression. L'application
// voit un succès et annonce « identifiants envoyés par email ». Le destinataire
// n'a rien, et personne ne peut le savoir depuis Maintrix.
//
// Une adresse y arrive toute seule : un rebond (boîte pleine, serveur
// momentanément indisponible), un signalement en indésirable, ou un blocage
// temporaire suffisent. Une fois inscrite, elle le reste — y compris quand la
// cause a disparu. C'est l'explication la plus courante d'un « envoyé mais
// jamais reçu ». Ajouté le 2026-10-08.
const LISTES = [
  ['rebonds', '/suppression/bounces', 'le serveur du destinataire a refusé un message précédent'],
  ['blocages', '/suppression/blocks', 'refus temporaire : boîte pleine, serveur injoignable'],
  ['indésirables', '/suppression/spam_reports', 'le destinataire a signalé un message comme indésirable'],
  ['adresses invalides', '/suppression/invalid_emails', 'adresse rejetée comme inexistante'],
  ['désabonnements', '/asm/suppressions/global', 'désabonnement global demandé'],
];

const suivi = (() => {
  const i = args.indexOf('--suivre');
  return i >= 0 ? args[i + 1] : null;
})();

if (args.includes('--suivre') && !suivi) {
  mourir('--suivre attend l\'adresse du destinataire à examiner.');
}

if (suivi) {
  console.log(`\n═══ ${suivi} est-il bloqué chez SendGrid ? ════════\n`);

  const trouvailles = [];
  for (const [nom, chemin, explication] of LISTES) {
    const r = await appeler(`${chemin}/${encodeURIComponent(suivi)}`);

    // 404 = absent de la liste, c'est la bonne nouvelle.
    if (r.statut === 404) { console.log(etat(true, `${nom} : absent`)); continue; }
    if (r.statut === 401 || r.statut === 403) {
      jaune(`${nom} : non consultable (${r.statut}) — la clé n'a pas cette permission.`);
      continue;
    }
    if (r.statut !== 200) { jaune(`${nom} : réponse inattendue (${r.statut})`); continue; }

    const entrees = Array.isArray(r.corps) ? r.corps : (r.corps ? [r.corps] : []);
    if (!entrees.length) { console.log(etat(true, `${nom} : absent`)); continue; }

    console.log(etat(false, `${nom} : PRÉSENT`));
    trouvailles.push([nom, chemin]);
    gris(`  ${explication}`);
    for (const e of entrees.slice(0, 3)) {
      if (e.created) gris(`  depuis le ${new Date(e.created * 1000).toLocaleString('fr-FR')}`);
      if (e.reason) gris(`  motif : ${String(e.reason).slice(0, 160)}`);
      if (e.status) gris(`  code : ${e.status}`);
    }
  }

  console.log('');
  if (!trouvailles.length) {
    vert('Cette adresse n\'est bloquée nulle part chez SendGrid.');
    gris('Si le message n\'arrive toujours pas : regardez les indésirables du');
    gris('destinataire, puis l\'Activity Feed de SendGrid, qui dit si le message');
    gris('a été remis, rejeté par le serveur distant, ou différé.');
  } else {
    rouge(`Cette adresse est sur ${trouvailles.length} liste(s) de suppression.`);
    rouge('SendGrid accepte les messages (202) et les jette ensuite, en silence.');
    console.log('\nPour l\'en retirer — c\'est une modification de VOTRE compte SendGrid,');
    console.log('elle n\'est pas faite automatiquement :');
    console.log(`  sudo node scripts/verifier-envoi-courriel.mjs --suivre ${suivi} --liberer\n`);

    if (args.includes('--liberer')) {
      console.log('Retrait demandé explicitement :\n');
      for (const [nom, chemin] of trouvailles) {
        const r = await appeler(`${chemin}/${encodeURIComponent(suivi)}`, { method: 'DELETE' });
        if (r.statut === 204 || r.statut === 200) vert(`  ✓ retiré de « ${nom} »`);
        else rouge(`  ✗ « ${nom} » : SendGrid a répondu ${r.statut}`);
      }
      console.log('');
      gris('Refaites un envoi de test pour confirmer la remise.');
    }
  }
}

if (!destinataire) {
  console.log('\nAucun message envoyé.');
  console.log('  Test réel      : --envoyer vous@exemple.fr');
  console.log('  Adresse muette : --suivre destinataire@exemple.fr\n');
  process.exit(0);
}

// ── 6. Test réel, sur demande explicite ─────────────────────────────
console.log(`\n═══ Envoi d'un message de test à ${destinataire} ═══\n`);

const envoi = await appeler('/mail/send', {
  method: 'POST',
  body: JSON.stringify({
    personalizations: [{ to: [{ email: destinataire }] }],
    from: { email: expediteur, name: 'Maintrix' },
    subject: 'Maintrix — test de configuration des courriels',
    content: [{
      type: 'text/plain',
      value: 'Ce message confirme que l\'environnement Maintrix peut émettre des courriels.\n'
        + `Expéditeur configuré : ${expediteur}\n`
        + `Envoyé le ${new Date().toLocaleString('fr-FR')}.`,
    }],
  }),
});

if (envoi.statut === 202) {
  vert('SendGrid a accepté le message (202).');
  gris('Il est remis à sa file d\'envoi. S\'il n\'arrive pas, la cause est en aval :');
  gris('indésirables, liste de suppression, ou refus du serveur destinataire.');
  gris('L\'Activity Feed de SendGrid le dira.');
} else {
  rouge(`SendGrid a REFUSÉ le message (${envoi.statut}).`);
  const erreurs = envoi.corps?.errors ?? [];
  for (const e of erreurs) {
    rouge(`  • ${e.message}`);
    if (e.field) gris(`    champ : ${e.field}`);
    if (e.help) gris(`    ${e.help}`);
  }
  if (!erreurs.length) console.error(JSON.stringify(envoi.corps, null, 2));
  process.exit(1);
}
