#!/usr/bin/env node
/**
 * Redonner l'accès à un compte, depuis le serveur.
 *
 *   sudo node scripts/reinitialiser-mot-de-passe.mjs contact@exemple.fr
 *   sudo node scripts/reinitialiser-mot-de-passe.mjs contact@exemple.fr --mot-de-passe "celui-que-je-choisis"
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CET OUTIL EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Sur cet environnement, `SENDGRID_API_KEY` n'est pas configuré : aucun
 * courriel ne part. La page « mot de passe oublié » crée pourtant un jeton
 * valide et répond « un lien a été envoyé » — le destinataire ne reçoit rien,
 * et personne ne peut plus entrer. Constaté le 2026-09-22 sur le compte
 * d'exploitation.
 *
 * Cet outil est la porte de secours : il tourne SUR LE SERVEUR, parle
 * directement à la base, et remet un compte en état d'ouvrir une session.
 *
 * Il traite aussi les trois autres causes de refus, souvent confondues avec un
 * mauvais mot de passe :
 *   • compte verrouillé après des tentatives infructueuses ;
 *   • mot de passe temporaire expiré ;
 *   • obligation de changer le mot de passe à la connexion.
 *
 * Le mot de passe s'affiche UNE FOIS, dans ce terminal. Il n'est pas journalisé.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const ENV_FILE = process.env.MAINTRIX_TEST_ENV_FILE || '.env.test-cloud';
const DB = process.env.MAINTRIX_CONTENEUR_BASE || 'maintrix-test-db';

const rouge = (m) => console.error(`\x1b[31m${m}\x1b[0m`);
const vert = (m) => console.log(`\x1b[32m${m}\x1b[0m`);
const mourir = (m, detail) => { rouge(`\n⛔ ${m}`); if (detail) console.error(String(detail).trim()); process.exit(1); };

const args = process.argv.slice(2);
const courriel = args.find((a) => !a.startsWith('--'));
const indexMdp = args.indexOf('--mot-de-passe');
const motDePasseChoisi = indexMdp >= 0 ? args[indexMdp + 1] : null;
const indexRole = args.indexOf('--role');
const roleChoisi = indexRole >= 0 ? args[indexRole + 1] : null;

if (!courriel) {
  console.log(`
Redonner l'accès à un compte Maintrix.

  sudo node scripts/reinitialiser-mot-de-passe.mjs <courriel>
  sudo node scripts/reinitialiser-mot-de-passe.mjs <courriel> --mot-de-passe "<le vôtre>"
  sudo node scripts/reinitialiser-mot-de-passe.mjs <courriel> --role admin

Sans --mot-de-passe, un mot de passe solide est tiré au hasard et affiché une fois.
--role corrige au passage un rôle que le système ne reconnaît pas.
`);
  process.exit(2);
}

if (!existsSync(ENV_FILE)) mourir(`${ENV_FILE} introuvable — lancez cet outil depuis le dossier du dépôt sur le serveur.`);

const etat = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', DB], { encoding: 'utf8' });
if ((etat.stdout || '').trim() !== 'true') {
  mourir(`Le conteneur de base ${DB} ne tourne pas.`, etat.stderr);
}

// Identifiants lus dans le conteneur : le rôle PostgreSQL n'est pas toujours
// celui qu'on croit, et le fichier de secrets peut différer d'un serveur à l'autre.
const lireEnvConteneur = (cle) => {
  const r = spawnSync('docker', ['exec', DB, 'printenv', cle], { encoding: 'utf8' });
  return (r.stdout || '').trim();
};
const PGU = lireEnvConteneur('POSTGRES_USER') || 'maintrix_test';
const PGD = lireEnvConteneur('POSTGRES_DB') || 'maintrix_test';

// ⚠️ Les « -v » sont des variables de psql, pas de docker : elles doivent venir
// APRÈS le nom du conteneur et la commande. Placées avant, docker les lit
// comme ses propres options et refuse (« unknown shorthand flag: 'v' »).
const psql = (sql, variables = []) => {
  const r = spawnSync('docker', ['exec', '-i', DB,
    'psql', '-v', 'ON_ERROR_STOP=1', ...variables.flatMap((v) => ['-v', v]),
    '-U', PGU, '-d', PGD, '-tAc', sql], { encoding: 'utf8' });
  if ((r.status ?? 1) !== 0) mourir('Requête refusée par la base', `${r.stdout}${r.stderr}`);
  return (r.stdout || '').trim();
};

// ── Le compte existe-t-il ? ────────────────────────────────────────
const profil = psql(
  `SELECT id || '|' || COALESCE(username,'') || '|' || COALESCE(role,'') || '|' || is_active || '|' ||
          COALESCE(account_locked_until::text,'') || '|' || COALESCE(tenant_id,'')
     FROM user_profiles WHERE lower(email) = lower('${courriel.replace(/'/g, "''")}')`);

if (!profil) {
  mourir(`Aucun compte avec l'adresse ${courriel}.`,
    'Comptes existants :\n' + psql("SELECT '  - ' || email || '  (' || COALESCE(role,'?') || ')' FROM user_profiles ORDER BY id"));
}

const [id, identifiant, role, actif, verrouilleJusqu, locataire] = profil.split('|');
console.log(`\n  Compte trouvé  id=${id}  identifiant=${identifiant}  rôle=${role}  locataire=${locataire}`);
if (actif !== 't') console.log('  ⚠ ce compte était DÉSACTIVÉ — il va être réactivé');
if (verrouilleJusqu) console.log(`  ⚠ verrouillé jusqu'au ${verrouilleJusqu} — le verrou va être levé`);

// ── Le rôle est-il seulement reconnu ? ─────────────────────────────
// ⚠️ Un rôle hors référentiel ne provoque AUCUNE erreur : la matrice de
// permissions ne le connaît pas, donc tout est refusé. L'interface affiche
// pourtant le libellé saisi — « Directrice » — et rien ne signale que le compte
// est sans aucun droit. Rendre le mot de passe à quelqu'un qui ne verra rien
// n'est pas lui rendre son accès. Constaté le 2026-09-27.
// Node n'importe pas un fichier TypeScript : on relit le référentiel depuis sa
// source, seule et même vérité que le serveur. Si sa forme change, le script
// n'invente rien — il s'arrête.
const { normaliserRole, IDENTIFIANTS_ROLES } = (() => {
  const source = readFileSync(join(ROOT, 'shared', 'roles.ts'), 'utf8');
  const ids = [...source.matchAll(/^\s*id: '([a-z_]+)',$/gm)].map((m) => m[1]);
  if (ids.length < 5) mourir('Référentiel des rôles illisible dans shared/roles.ts.');

  const blocAlias = source.match(/const ALIAS[^{]*\{([\s\S]*?)\n\};/);
  const alias = Object.fromEntries(
    [...(blocAlias?.[1] ?? '').matchAll(/^\s*([a-z_]+):\s*'([a-z_]+)',/gm)].map((m) => [m[1], m[2]]));

  // Même simplification que `shared/roles.ts` : accents retirés, apostrophes
  // supprimées, espaces et tirets ramenés à « _ ».
  const simplifier = (v) => String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase().replace(/['’]/g, '')
    .replace(/[\s-]+/g, '_').replace(/_+/g, '_');

  return {
    IDENTIFIANTS_ROLES: ids,
    normaliserRole: (v) => {
      if (typeof v !== 'string' || v.trim() === '') return null;
      const cle = simplifier(v);
      return ids.includes(cle) ? cle : (alias[cle] ?? null);
    },
  };
})();

const roleActuel = normaliserRole(role);
let roleACorriger = null;

if (roleChoisi) {
  const normalise = normaliserRole(roleChoisi);
  if (!normalise) {
    mourir(`« ${roleChoisi} » n'est pas un rôle connu.`,
      `Rôles acceptés : ${IDENTIFIANTS_ROLES.join(', ')}`);
  }
  roleACorriger = normalise;
  console.log(`  → rôle demandé : ${normalise}`);
} else if (!roleActuel) {
  rouge(`\n  ⚠ LE RÔLE « ${role} » N'EST PAS RECONNU PAR LE SYSTÈME.`);
  console.error('    Ce compte n\'a AUCUNE permission : il pourra se connecter,');
  console.error('    et ne verra rien. L\'interface affiche pourtant ce libellé');
  console.error('    comme s\'il était valide.');
  console.error(`\n    Rôles acceptés : ${IDENTIFIANTS_ROLES.join(', ')}`);
  console.error(`\n    Relancez en ajoutant le rôle voulu, par exemple :`);
  console.error(`      sudo node scripts/reinitialiser-mot-de-passe.mjs ${courriel} --role admin\n`);
  console.error('    Le mot de passe va tout de même être réinitialisé.');
}

// ── Nouveau mot de passe ───────────────────────────────────────────
const motDePasse = motDePasseChoisi || crypto.randomBytes(15).toString('base64url');
if (motDePasse.length < 8) mourir('Un mot de passe de moins de 8 caractères sera refusé à la connexion.');

const bcrypt = createRequire(import.meta.url)('bcrypt');
const empreinte = bcrypt.hashSync(motDePasse, 10);

// ── Remise en état ─────────────────────────────────────────────────
// Tout ce qui peut faire refuser une connexion est levé d'un coup : c'est le
// but de cet outil, ne pas revenir trois fois pour trois causes différentes.
const r = spawnSync('docker', ['exec', '-i', DB,
  'psql', '-v', 'ON_ERROR_STOP=1',
  '-v', `empreinte=${empreinte}`, '-v', `courriel=${courriel}`,
  ...(roleACorriger ? ['-v', `role=${roleACorriger}`] : []),
  '-U', PGU, '-d', PGD], {
  encoding: 'utf8',
  input: `
UPDATE user_profiles
   SET password = :'empreinte',
       is_active = true,
       must_change_password = false,
       is_default_credentials = false,
       password_expires_at = NULL,
       failed_login_attempts = 0,
       account_locked_until = NULL,
       password_reset_token = NULL,
       password_reset_token_expires_at = NULL,
       last_password_change = NOW(),
       ${roleACorriger ? "role = :'role'," : ""}
       updated_at = NOW()
 WHERE lower(email) = lower(:'courriel');

-- Le limiteur anti-force-brute compte par adresse IP : sans cette purge, un
-- compte réparé peut rester injoignable une demi-heure de plus.
DELETE FROM rate_limits;`,
});
if ((r.status ?? 1) !== 0) mourir('Mise à jour refusée', `${r.stdout}${r.stderr}`);

const publique = (readFileSync(ENV_FILE, 'utf8').match(/^FRONTEND_URL=(.*)$/m) || [])[1] || '';

vert(`
╔════════════════════════════════════════════════════════════════╗
║  ACCÈS RÉTABLI                                                 ║
╚════════════════════════════════════════════════════════════════╝

  Adresse         ${courriel}
  Mot de passe    ${motDePasse}

  Connexion       ${publique ? publique + '/login' : '/login'}
`);
console.log(`  Ce mot de passe n'est affiché qu'ici, et n'est écrit dans aucun journal.
  Changez-le après connexion si vous le souhaitez : rien ne vous y oblige,
  le compte n'est plus marqué « identifiants par défaut ».
`);
