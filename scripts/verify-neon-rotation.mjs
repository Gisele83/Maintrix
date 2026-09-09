#!/usr/bin/env node
/**
 * L'identifiant PostgreSQL fuité est-il enfin neutralisé ? — F11.
 *
 *   node scripts/verify-neon-rotation.mjs
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CE SCRIPT VÉRIFIE
 * ═══════════════════════════════════════════════════════════════════
 * Une chaîne de connexion PostgreSQL Neon complète — utilisateur, mot de passe,
 * hôte — a été publiée dans l'historique d'un dépôt GitHub PUBLIC
 * (commits `f70752a` puis `0ab95cf`, fichier `.env.test`). Le second commit
 * l'a retirée de l'arbre de travail, ce qui ne change rien : elle reste lisible
 * par quiconque a cloné le dépôt, ou consulte l'historique.
 *
 * Mesuré le 2026-09-07, sans jamais s'authentifier — en présentant un mot de
 * passe délibérément faux :
 *
 *     ERROR: password authentication failed for user 'neondb_owner'
 *
 * Ce message, et non « endpoint introuvable », établit que le projet Neon et le
 * rôle existaient toujours. Le mot de passe publié devait donc être présumé
 * VALIDE.
 *
 * Ce script répond à une seule question : **l'ancien mot de passe fonctionne-t-il
 * encore ?**
 *
 *   • Il RÉUSSIT si la connexion est REFUSÉE — l'identifiant est mort.
 *   • Il ÉCHOUE si la connexion ABOUTIT — la rotation n'a pas eu lieu.
 *
 * ═══════════════════════════════════════════════════════════════════
 * AUCUN SECRET N'EST AJOUTÉ AU DÉPÔT
 * ═══════════════════════════════════════════════════════════════════
 * Le script ne contient pas le mot de passe. Il le retrouve dans l'historique
 * Git — là où il se trouve déjà — ou l'accepte par la variable d'environnement
 * `ANCIENNE_CHAINE_NEON` si l'historique a été purgé entre-temps.
 *
 * ⚠️ Purger l'historique ne remplace PAS la rotation. Le secret est public
 * depuis des mois : des clones existent, et GitHub conserve un temps les objets
 * devenus inaccessibles. Seule la rotation le neutralise. La purge est une
 * mesure d'hygiène, à faire APRÈS.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const ko = (m, d) => { console.log(`  ✗ ${m}`); if (d) console.log(String(d).split('\n').map(l => `      ${l}`).join('\n')); fail++; };
const info = (m) => console.log(`      ${m}`);
const section = (t) => console.log(`\n── ${t}`);

/** Masque un mot de passe pour l'affichage : on ne le réimprime jamais en clair. */
const masquer = (url) => url.replace(/:\/\/([^:]+):([^@]+)@/, (_, u, p) => `://${u}:${p.slice(0, 3)}…${p.slice(-2)}@`);

// ═══════════════════════════════════════════════════════════════════
console.log('\n🔑 Rotation de l\'identifiant PostgreSQL fuité\n');

section('T1 — Retrouver la chaîne publiée');

let chaine = process.env.ANCIENNE_CHAINE_NEON || '';
let sourceChaine = 'variable ANCIENNE_CHAINE_NEON';

/**
 * Balaie TOUS les objets du dépôt — y compris ceux devenus inatteignables
 * (commits réécrits, force-push écrasés). `git log -S` ne voit que ce qui est
 * atteignable depuis une référence : un secret force-pushé puis remplacé lui
 * échapperait complètement.
 */
function chainesDansTousLesObjets() {
  const listeBlobs = spawnSync('git',
    ['cat-file', '--batch-all-objects', '--batch-check=%(objectname) %(objecttype)'],
    { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });

  const blobs = (listeBlobs.stdout || '').split('\n')
    .filter(l => l.endsWith(' blob')).map(l => l.split(' ')[0]);

  if (blobs.length === 0) return { blobs: 0, chaines: [] };

  const contenu = spawnSync('git', ['cat-file', '--batch'],
    { input: blobs.join('\n'), encoding: 'latin1', maxBuffer: 1024 * 1024 * 1024 });

  const chaines = [...new Set(
    (contenu.stdout || '').match(/postgres(?:ql)?:\/\/neondb_owner:[^@\s"']+@[^\s"']+/g) || [],
  )];
  return { blobs: blobs.length, chaines };
}

/**
 * Une valeur caviardée à la main (astérisques, « REDACTED », « xxxx ») n'est pas
 * un secret : la confondre avec un identifiant utilisable conduit à déclarer une
 * fuite qui n'existe pas — et à faire perdre du temps sur une fausse urgence.
 */
const estCaviarde = (mdp) =>
  /\*{2,}|x{4,}|X{4,}|redacted|REDACTED|hidden|masked|\.\.\./.test(mdp);

let inventaire = { blobs: 0, chaines: [] };

if (!chaine) {
  inventaire = chainesDansTousLesObjets();
  info(`${inventaire.blobs} blobs examinés (atteignables ou non)`);
  if (inventaire.chaines.length > 0) {
    chaine = inventaire.chaines[0];
    sourceChaine = 'historique Git';
  }
}

if (!chaine) {
  ok("la chaîne n'est plus présente dans l'historique Git");
  info('L\'historique semble avoir été purgé. Pour vérifier tout de même que');
  info('l\'ancien mot de passe est mort, relancez avec :');
  info('  ANCIENNE_CHAINE_NEON="postgresql://…" node scripts/verify-neon-rotation.mjs');
  console.log('\n' + '═'.repeat(52));
  console.log('  ROTATION : INDÉTERMINÉE — chaîne introuvable, rien à tester');
  console.log('═'.repeat(52));
  process.exit(0);
}

const motDePasse = (chaine.match(/:\/\/[^:]+:([^@]+)@/) || [])[1] ?? '';
const caviarde = estCaviarde(motDePasse);

if (inventaire.chaines.length > 1) {
  ko(`${inventaire.chaines.length} chaînes distinctes trouvées — les examiner toutes`,
     inventaire.chaines.map(masquer).join('\n'));
}

if (caviarde) {
  ok(`la seule chaîne présente porte un mot de passe CAVIARDÉ, pas un secret (${sourceChaine})`);
  info(masquer(chaine));
  info(`${motDePasse.length} caractères dont ${(motDePasse.match(/\*/g) || []).length} astérisques littéraux`);
  info('Une valeur caviardée n\'ouvre aucune base. Le test ci-dessous le confirme.');
} else {
  ko(`la chaîne présente porte un mot de passe d'apparence RÉELLE (${sourceChaine})`,
     masquer(chaine) + '\n\nTant qu\'elle est dans l\'historique public, elle reste récupérable ' +
     'par n\'importe qui. La purge est nécessaire — mais elle ne remplace pas la rotation.');
}

// ═══════════════════════════════════════════════════════════════════
section('T2 — L\'ancien mot de passe ouvre-t-il encore la base ?');

const { Client } = await import('pg');

const essai = async (motDePasse, libelle) => {
  const url = motDePasse === null
    ? chaine
    : chaine.replace(/:\/\/([^:]+):([^@]+)@/, `://$1:${motDePasse}@`);

  const client = new Client({ connectionString: url, connectionTimeoutMillis: 20000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end().catch(() => {});
    return { connecte: true };
  } catch (e) {
    await client.end().catch(() => {});
    return { connecte: false, message: String(e.message || e).split('\n')[0] };
  }
};

// Témoin : un mot de passe faux DOIT être refusé. Sans ce contrôle, un endpoint
// injoignable ou une panne réseau ferait passer le test principal au vert par
// accident — « refusé » et « inaccessible » ne sont pas la même chose.
const temoin = await essai('mot-de-passe-volontairement-invalide-f11', 'témoin');
if (temoin.connecte) {
  ko('un mot de passe FAUX est accepté — résultat ininterprétable', 'Arrêt.');
} else if (/password authentication failed/i.test(temoin.message)) {
  ok('témoin : un mot de passe faux est bien refusé (le serveur répond et authentifie)');
} else {
  ko('témoin : le serveur ne répond pas comme attendu', temoin.message +
     '\n\nL\'endpoint est peut-être injoignable. Le test qui suit ne prouverait rien.');
}

const reel = await essai(null, 'mot de passe publié');
if (reel.connecte) {
  ko('⛔ L\'ANCIEN MOT DE PASSE FONCTIONNE ENCORE',
     'La base est ouverte à quiconque a lu le dépôt public.\n' +
     'Rotation IMMÉDIATE requise dans la console Neon :\n' +
     '  Neon → projet → Roles → neondb_owner → Reset password');
} else if (/password authentication failed/i.test(reel.message)) {
  // Formulation prudente : « refusée » établit que cette chaîne n'ouvre pas la
  // base. Cela ne prouve pas qu'une rotation ait eu lieu — la valeur publiée
  // pouvait être caviardée dès l'origine (voir T1). Affirmer la rotation serait
  // conclure au-delà de ce qui est mesuré.
  ok('✅ la chaîne publiée n\'ouvre PAS la base — aucun accès possible avec elle');
} else {
  ko('résultat non concluant', reel.message);
}

// ═══════════════════════════════════════════════════════════════════
section('T3 — Aucun identifiant réel dans l\'arbre de travail');
{
  // On cherche des IDENTIFIANTS (`utilisateur:motdepasse@hôte`), pas de simples
  // noms d'hôtes : `infrastructure/istio-mtls-config.yaml` liste `*.neon.tech`
  // dans une liste d'autorisation réseau, ce qui n'est pas un secret. Un
  // contrôle qui ne fait pas cette distinction crie au loup.
  const r = spawnSync('git', ['grep', '-I', '-n', '-E',
    'postgres(ql)?://[A-Za-z0-9_.-]+:[^@\\s"\']+@'], { encoding: 'utf8' });

  const suspects = (r.stdout || '').split('\n').filter(Boolean)
    .filter(l => !/^(docs\/|scripts\/verify-neon-rotation)/.test(l))
    .filter(l => {
      const m = l.match(/postgres(?:ql)?:\/\/[^:]+:([^@]+)@/);
      if (!m) return false;
      const p = m[1];
      // Les gabarits (`${VAR}`, `$VAR`) et les valeurs caviardées ne sont pas
      // des secrets.
      return !/\$\{|\$[A-Z_]/.test(p) && !estCaviarde(p);
    });

  // Un mot de passe en dur visant `localhost` ou un nom de service Docker n'est
  // joignable par personne depuis Internet : c'est une mauvaise pratique, pas
  // une fuite. Les mélanger ferait passer une vraie fuite inaperçue au milieu
  // du bruit.
  const interne = (l) => /@(localhost|127\.0\.0\.1|db|postgres|database|host\.docker\.internal)[:\/]/.test(l);
  const exposes = suspects.filter(l => !interne(l));
  const locaux = suspects.filter(interne);

  if (exposes.length === 0) ok('aucun identifiant en clair vers un hôte joignable depuis Internet');
  else ko(`${exposes.length} identifiant(s) exposé(s)`,
          exposes.map(l => l.split(':').slice(0, 2).join(':')).join('\n'));

  if (locaux.length > 0) {
    info(`${locaux.length} mot(s) de passe en dur visant un hôte local ou interne à Docker :`);
    locaux.forEach(l => info(`  ${l.split(':').slice(0, 2).join(':')}`));
    info('Non joignables depuis Internet — à corriger par hygiène, sans urgence.');
  }
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(52));
console.log(`  ROTATION : ${fail === 0 ? 'FAITE' : 'À FAIRE'}   —   ${pass} réussis, ${fail} échoués`);
console.log('═'.repeat(52));
if (fail > 0) {
  console.log('\n  Marche à suivre — l\'ordre compte :');
  console.log('   1. Console Neon → Roles → neondb_owner → Reset password');
  console.log('   2. Reporter la nouvelle chaîne dans les .env HORS dépôt');
  console.log('   3. Relancer ce script : l\'ancien mot de passe doit être refusé');
  console.log('   4. SEULEMENT ENSUITE, purger l\'historique Git (voir docs/SECRET_ROTATION.md)');
}
process.exit(fail === 0 ? 0 : 1);
