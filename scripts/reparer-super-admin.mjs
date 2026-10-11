#!/usr/bin/env node
/**
 * Diagnostiquer, puis réparer l'accès à la console super-admin.
 *
 *   sudo node scripts/reparer-super-admin.mjs                      (diagnostic seul)
 *   sudo node scripts/reparer-super-admin.mjs --afficher-mot-de-passe
 *   sudo node scripts/reparer-super-admin.mjs --verifier-saisie
 *   sudo node scripts/reparer-super-admin.mjs --reparer
 *   sudo node scripts/reparer-super-admin.mjs --reparer --mot-de-passe "celui que je choisis"
 *   sudo node scripts/reparer-super-admin.mjs --reparer --sans-compte-utilisateur
 *   sudo node scripts/reparer-super-admin.mjs --reparer --courriel contact@exemple.fr
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CET OUTIL EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Le super-administrateur n'a pas de compte en base : son identité vient de
 * trois variables d'environnement. Trois façons de rester dehors, que le
 * serveur renvoyait avec le MÊME message « identifiants incorrects » :
 *
 *   1. l'adresse saisie n'est pas `SUPER_ADMIN_EMAIL` — le provisionnement
 *      écrit `superadmin@maintrix.test`, que personne ne devine ;
 *   2. le mot de passe ne correspond pas au hash ;
 *   3. le hash est ARRIVÉ CASSÉ dans le conteneur. Docker Compose interprète
 *      « $ » comme une référence de variable, et un hash bcrypt commence par
 *      `$2b$10$`. Sans doublement des « $ », le hash est tronqué en silence.
 *
 * Le cas 3 est le plus traître : le mot de passe est bon, et on cherche des
 * heures du mauvais côté. Cet outil lit ce que le CONTENEUR voit réellement —
 * pas ce que le fichier prétend — et nomme la panne.
 *
 * Le cas 2 se dédouble, et c'est la question qu'on se pose en dernier : le
 * provisionnement conserve une copie EN CLAIR du mot de passe dans le fichier
 * d'environnement. Elle devient périmée dès que le hash est régénéré ailleurs.
 * L'outil la confronte au hash avant d'en proposer un nouveau : inutile de
 * recréer le conteneur si le mot de passe en cours dort déjà sur le serveur.
 *
 * Aucun secret n'est affiché, sauf sur demande explicite : le mot de passe
 * nouvellement généré (`--reparer`), ou celui qui est conservé et vérifié
 * (`--afficher-mot-de-passe`).
 *
 * `--reparer` pose le MÊME mot de passe sur le compte de l'espace utilisateur
 * portant la même adresse, afin qu'une seule chose soit à retenir. Les deux
 * mécanismes restent séparés — le super-administrateur ne dépend toujours pas
 * de la base, c'est ce qui en fait une porte de secours. Seule l'empreinte est
 * commune. `--sans-compte-utilisateur` s'en abstient.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const ENV_FILE = process.env.MAINTRIX_TEST_ENV_FILE || '.env.test-cloud';
const APP = process.env.MAINTRIX_CONTENEUR_APP || 'maintrix-test-app';
/** Le même nom de projet que `deploy-ovh.sh` — voir la note en fin de script. */
const PROJET = process.env.MAINTRIX_PROJET_COMPOSE || 'maintrix-test';
const BASE = process.env.MAINTRIX_CONTENEUR_BASE || 'maintrix-test-db';

const rouge = (m) => console.error(`\x1b[31m${m}\x1b[0m`);
const jaune = (m) => console.log(`\x1b[33m${m}\x1b[0m`);
const vert = (m) => console.log(`\x1b[32m${m}\x1b[0m`);
const gris = (m) => console.log(`\x1b[90m${m}\x1b[0m`);
const mourir = (m, detail) => { rouge(`\n⛔ ${m}`); if (detail) console.error(String(detail).trim()); process.exit(1); };

const args = process.argv.slice(2);
const reparer = args.includes('--reparer');
const courrielVoulu = (() => {
  const i = args.indexOf('--courriel');
  return i >= 0 ? args[i + 1] : null;
})();

if (courrielVoulu && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(courrielVoulu)) {
  mourir(`« ${courrielVoulu} » n'est pas une adresse de courriel.`);
}

/** Un hash bcrypt : `$2a$`, `$2b$` ou `$2y$`, un coût, puis 53 caractères. */
const HASH_BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

// ── 1. Ce que le conteneur voit vraiment ────────────────────────────
// On interroge le processus en cours d'exécution, et non le fichier : Docker
// fige les variables à la CRÉATION du conteneur. Un fichier corrigé mais un
// conteneur non recréé donnent deux vérités différentes, et c'est celle du
// conteneur qui décide.
console.log('\n═══ Ce que voit le conteneur ═══════════════════════════════\n');

const lire = (variable) => {
  const r = spawnSync('docker', ['exec', APP, 'sh', '-c', `printf %s "$${variable}"`], { encoding: 'utf8' });
  if (r.status !== 0) {
    mourir(`impossible d'interroger le conteneur « ${APP} ».`,
      (r.stderr || '') + "\nLancez la commande avec sudo, et vérifiez que le conteneur tourne.");
  }
  return r.stdout;
};

const courrielConteneur = lire('SUPER_ADMIN_EMAIL');
const hashConteneur = lire('SUPER_ADMIN_PASSWORD_HASH');
const secretConteneur = lire('SUPER_ADMIN_SECRET');

const etat = (ok, texte) => `${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${texte}`;

console.log(etat(!!courrielConteneur, `adresse attendue : ${courrielConteneur ? `\x1b[1m${courrielConteneur}\x1b[0m` : 'ABSENTE'}`));
if (courrielConteneur !== courrielConteneur.trim()) {
  jaune('  ⚠ cette valeur contient des espaces en début ou en fin.');
}

const hashValide = HASH_BCRYPT.test(hashConteneur);
console.log(etat(hashValide,
  `hash du mot de passe : ${hashConteneur.length} caractères, commence par « ${hashConteneur.slice(0, 4) || '∅'} »`));
if (!hashValide) {
  rouge('  ⚠ CE N\'EST PAS UN HASH BCRYPT VALIDE (attendu : 60 caractères, préfixe $2b$).');
  if (hashConteneur && !hashConteneur.startsWith('$')) {
    rouge('    Les « $ » ont disparu : c\'est l\'interpolation de Docker Compose.');
    rouge('    Dans le fichier d\'environnement, chaque $ du hash doit être doublé.');
  }
  rouge('    → Tant que ceci n\'est pas corrigé, AUCUN mot de passe ne peut fonctionner.');
}

console.log(etat(secretConteneur.length >= 32, `clé secrète plateforme : ${secretConteneur.length} caractères`));

// ── 2. La copie en clair conservée sur le serveur est-elle la bonne ?
// Le provisionnement écrit `SUPER_ADMIN_PASSWORD=` en clair dans le fichier,
// à l'usage de l'exploitant. Cette copie devient PÉRIMÉE dès que le hash est
// régénéré ailleurs — et l'on croit alors avoir oublié un mot de passe qui n'a
// simplement plus cours. On la confronte au hash, sans jamais l'afficher ici.
const bcrypt = createRequire(import.meta.url)('bcrypt');

let copieEnClair = null;
let copieValide = false;
if (existsSync(ENV_FILE)) {
  const ligne = readFileSync(ENV_FILE, 'utf8').match(/^SUPER_ADMIN_PASSWORD=(.*)$/m);
  if (ligne) {
    copieEnClair = ligne[1].trim().replace(/^["']|["']$/g, '');
    copieValide = hashValide && copieEnClair.length > 0
      && bcrypt.compareSync(copieEnClair, hashConteneur);
  }
}

/**
 * Poser le MÊME mot de passe sur le compte de l'espace utilisateur.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CECI EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Le super-administrateur n'a pas de compte en base : son identité vient des
 * variables d'environnement. C'est délibéré — c'est ce qui en fait une porte
 * de secours quand la base est cassée, et on ne va pas supprimer ce filet.
 *
 * Mais l'exploitant est la même personne des deux côtés, et retenir deux mots
 * de passe de 24 caractères aléatoires ne tient pas. On garde donc les deux
 * mécanismes séparés, et on synchronise la seule chose qui gêne : l'empreinte.
 *
 * ⚠️ Le fichier d'environnement reçoit le hash ÉCHAPPÉ (chaque $ doublé, pour
 * Docker Compose) ; la base reçoit le hash BRUT. Confondre les deux rend le
 * compte inaccessible sans que rien ne le signale.
 */
function synchroniserCompteUtilisateur(courriel, hashBrut) {
  const lireBase = (variable) => {
    const r = spawnSync('docker', ['exec', BASE, 'printenv', variable], { encoding: 'utf8' });
    return (r.stdout || '').trim();
  };

  const utilisateur = lireBase('POSTGRES_USER');
  const base = lireBase('POSTGRES_DB');
  if (!utilisateur || !base) {
    jaune(`  ⚠ conteneur « ${BASE} » injoignable : compte utilisateur NON synchronisé.`);
    return false;
  }

  // ⚠️ Les « -v » sont des variables de psql, pas de docker : après la commande.
  const r = spawnSync('docker', ['exec', '-i', BASE,
    'psql', '-v', 'ON_ERROR_STOP=1',
    '-v', `empreinte=${hashBrut}`, '-v', `courriel=${courriel}`,
    '-U', utilisateur, '-d', base, '-tA'], {
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
       updated_at = NOW()
 WHERE lower(email) = lower(:'courriel')
 RETURNING id || '|' || COALESCE(role, '');

-- Le limiteur compte par adresse IP : un compte réparé resterait sinon
-- injoignable une heure de plus.
DELETE FROM rate_limits WHERE is_blocked = true;
`,
  });

  if ((r.status ?? 1) !== 0) {
    jaune('  ⚠ la base a refusé la mise à jour : compte utilisateur NON synchronisé.');
    console.error((r.stdout || '') + (r.stderr || ''));
    return false;
  }

  const resultats = (r.stdout || '').split('\n').map((l) => l.trim()).filter((l) => /^\d+\|/.test(l));
  if (!resultats.length) {
    jaune(`  ⚠ aucun compte utilisateur avec l'adresse ${courriel} : rien à synchroniser.`);
    gris('    Créez-le depuis la console, puis relancez cette commande.');
    return false;
  }

  const [id, role] = resultats[0].split('|');
  vert(`  ✓ compte utilisateur id=${id} aligné sur le même mot de passe`);

  // ⚠️ Un rôle hors référentiel ne lève AUCUNE erreur : il donne zéro
  // permission. On se connecte, et l'interface est vide. Vu le 2026-09-27 avec
  // un rôle « Directrice » saisi en texte libre, avant que la création ne soit
  // contrainte. On affiche donc le rôle, plutôt que de laisser la découverte
  // se faire après la connexion.
  gris(`    rôle du compte : ${role || '(vide)'}`);
  gris("    S'il ne figure pas dans shared/roles.ts, ce compte n'aura AUCUN droit :");
  gris(`      sudo node scripts/reinitialiser-mot-de-passe.mjs ${courriel} --role admin`);
  return true;
}
// ── 3. Diagnostic ───────────────────────────────────────────────────
console.log('\n═══ Diagnostic ═════════════════════════════════════════════\n');

if (!hashValide) {
  rouge('Le mot de passe ne PEUT PAS être vérifié : le hash est cassé.');
  gris("Votre mot de passe n'est probablement pas en cause.");
} else if (courrielVoulu && courrielVoulu.trim().toLowerCase() !== courrielConteneur.trim().toLowerCase()) {
  jaune(`Le hash est valide, mais l'adresse attendue est « ${courrielConteneur} »,`);
  jaune(`pas « ${courrielVoulu} ». Saisissez la première, ou relancez avec`);
  jaune('--reparer --courriel pour adopter la seconde.');
} else if (copieValide) {
  vert('La configuration est bien formée, ET le mot de passe conservé dans');
  vert(`${ENV_FILE} correspond au hash : il ouvre la console.`);
  gris('Vous ne l\'avez donc pas perdu — il est sur ce serveur.');
  console.log('\n  Pour l\'afficher (une fois, dans ce terminal) :');
  console.log('    sudo node scripts/reparer-super-admin.mjs --afficher-mot-de-passe\n');
  gris('Aucune recréation de conteneur n\'est nécessaire dans ce cas.');
} else if (copieEnClair !== null) {
  jaune('La configuration est bien formée, mais la copie en clair conservée');
  jaune(`dans ${ENV_FILE} NE correspond PLUS au hash : elle est périmée.`);
  gris('Le hash a été régénéré sans que cette ligne soit mise à jour.');
  gris('Le mot de passe en cours n\'est donc écrit nulle part → --reparer.');
} else {
  vert('La configuration est bien formée.');
  gris('Aucune copie du mot de passe n\'est conservée sur ce serveur.');
  gris('Si la connexion échoue, c\'est le mot de passe lui-même : --reparer.');
}

// ── 4. Rendre le mot de passe conservé, s'il est encore valable ──────
// ── Ce que vous tapez est-il ce que le serveur attend ? ─────────────
// ⚠️ Le refus de connexion est revenu deux fois, avec un mot de passe que
// bcrypt validait pourtant contre le hash du conteneur. Les deux faits ne
// tiennent ensemble que si la chaîne qui PART DU NAVIGATEUR n'est pas celle
// qu'on croit taper : un gestionnaire de mots de passe qui recouvre le champ,
// un espace capturé par un copier-coller, un caractère perdu.
//
// Cette option compare la chaîne EXACTE que vous collez au hash que voit le
// serveur. Elle sépare « je me trompe de mot de passe » de « le serveur est
// cassé », et ces deux pannes ne se soignent pas du tout pareil.
//
// La saisie passe par l'entrée standard, jamais par la ligne de commande :
// elle n'apparaît donc pas dans l'historique du shell. Elle reste visible à
// l'écran — regardez derrière vous, c'est le seul risque.
if (args.includes('--verifier-saisie')) {
  if (!hashValide) {
    mourir("le hash du conteneur est lui-même invalide : rien à comparer.",
      'Relancez avec --reparer.');
  }

  process.stdout.write('\nCollez le mot de passe à vérifier, puis Entrée :\n> ');
  const saisie = await new Promise((resoudre) => {
    let tampon = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (morceau) => {
      tampon += morceau;
      const coupure = tampon.indexOf('\n');
      if (coupure >= 0) { process.stdin.pause(); resoudre(tampon.slice(0, coupure)); }
    });
    process.stdin.on('end', () => resoudre(tampon));
  });

  // On ne « nettoie » PAS la saisie : un espace de trop est précisément le
  // genre de défaut qu'on cherche. On le signale au lieu de le masquer.
  const brut = saisie.replace(/\r$/, "");
  const propre = brut.trim();

  console.log("");
  console.log(`  longueur       : ${brut.length} caractère(s)`);
  if (brut !== propre) {
    jaune(`  ⚠ espaces en début ou en fin : ${brut.length - propre.length} caractère(s) parasite(s).`);
    jaune('    Un copier-coller depuis un terminal en capture souvent un.');
  }

  const correspond = bcrypt.compareSync(brut, hashConteneur);
  const correspondPropre = !correspond && brut !== propre && bcrypt.compareSync(propre, hashConteneur);

  console.log("");
  if (correspond) {
    vert('  ✓ CETTE CHAÎNE OUVRE LA CONSOLE.');
    gris('    Si la connexion échoue malgré tout, ce n\'est pas le mot de passe :');
    gris('    le navigateur n\'envoie pas ce que vous avez collé. Essayez en');
    gris('    navigation privée, sans autocomplétion.');
    process.exit(0);
  }
  if (correspondPropre) {
    jaune('  ~ La chaîne est bonne, MAIS elle est entourée d\'espaces.');
    gris('    Recollez-la sans les espaces et la connexion passera.');
    process.exit(1);
  }
  rouge('  ✗ cette chaîne ne correspond pas au hash du serveur.');
  if (copieValide) {
    gris('    Un mot de passe valable est pourtant conservé sur ce serveur :');
    gris('      sudo node scripts/reparer-super-admin.mjs --afficher-mot-de-passe');
  } else {
    gris('    Aucun mot de passe valable n\'est conservé ici : --reparer.');
  }
  process.exit(1);
}

if (args.includes('--afficher-mot-de-passe')) {
  if (!copieValide) {
    mourir("aucun mot de passe valable n'est conservé sur ce serveur.",
      'Relancez avec --reparer pour en générer un nouveau.');
  }
  console.log('\n───────────────────────────────────────────────────────────');
  console.log(`  Adresse       : ${courrielConteneur}`);
  console.log(`  Mot de passe  : \x1b[1m${copieEnClair}\x1b[0m`);
  console.log('───────────────────────────────────────────────────────────');
  gris('Vérifié contre le hash du conteneur : ce couple ouvre la console.\n');
  process.exit(0);
}

if (!reparer) {
  console.log('\nAucune modification faite. Ajoutez --reparer pour corriger.\n');
  process.exit(hashValide ? 0 : 1);
}

// ── 3. Réparation ───────────────────────────────────────────────────
console.log('\n═══ Réparation ═════════════════════════════════════════════\n');

if (!existsSync(ENV_FILE)) {
  mourir(`fichier d'environnement « ${ENV_FILE} » introuvable depuis ${ROOT}.`,
    'Précisez-le avec MAINTRIX_TEST_ENV_FILE=/chemin/vers/.env.test-cloud');
}

// Un mot de passe choisi est accepté, mais jamais faible : le serveur
// refuserait moins de 6 caractères, et un mot de passe d'administrateur de
// plateforme qui tiendrait en dessous de 12 ne vaut pas la peine d'exister.
const indexMdp = args.indexOf('--mot-de-passe');
const motDePasseChoisi = indexMdp >= 0 ? args[indexMdp + 1] : null;
if (indexMdp >= 0 && !motDePasseChoisi) {
  mourir('--mot-de-passe attend une valeur.');
}
// ⚠️ Un texte d'exemple finit par être collé tel quel. C'est arrivé deux
// fois sur ce projet : une adresse fictive passée en argument, puis la phrase
// « celui que vous choisissez » devenue, littéralement, le mot de passe du
// super-administrateur. La faute en revient à qui écrit des exemples qui
// ressemblent à des valeurs. À défaut de cesser d'en écrire, on les refuse.
const VALEURS_DEXEMPLE = [
  'celui que vous choisissez', 'celui-que-vous-choisissez',
  'celui que je choisis', 'le vôtre', 'votre mot de passe',
  'mot de passe', 'motdepasse', 'password', 'changeme', 'secret',
  'exemple', 'example', 'xxxxxxxxxxxx', 'azertyuiop', 'qwertyuiop',
];

if (motDePasseChoisi) {
  const normalise = motDePasseChoisi.trim().toLowerCase();
  if (VALEURS_DEXEMPLE.some((v) => normalise === v || normalise.includes(v))) {
    mourir(`« ${motDePasseChoisi} » est un texte d'exemple, pas un mot de passe.`,
      'Omettez --mot-de-passe : le script en tire un solide au hasard et vous l\'affiche.');
  }
}

if (motDePasseChoisi && motDePasseChoisi.length < 12) {
  mourir(`mot de passe trop court (${motDePasseChoisi.length} caractères, minimum 12).`,
    'Omettez --mot-de-passe pour en obtenir un solide, tiré au hasard.');
}
const motDePasse = motDePasseChoisi || crypto.randomBytes(18).toString('base64url');
const hash = bcrypt.hashSync(motDePasse, 10);

// Garde-fou : on ne réécrit rien tant que le hash qu'on vient de produire
// n'est pas vérifiable. Un fichier corrompu vaut mieux que jamais.
if (!HASH_BCRYPT.test(hash) || !bcrypt.compareSync(motDePasse, hash)) {
  mourir('le hash produit ne se vérifie pas lui-même — bcrypt est en cause, rien n\'a été modifié.');
}

// ⚠️ Chaque « $ » est doublé POUR DOCKER COMPOSE, qui le ramènera à un seul.
const echappe = hash.replace(/\$/g, '$$$$');
const courriel = (courrielVoulu || courrielConteneur || 'superadmin@maintrix.test').trim();

const sauvegarde = `${ENV_FILE}.avant-reparation-${new Date().toISOString().replace(/[:.]/g, '-')}`;
copyFileSync(ENV_FILE, sauvegarde);
gris(`copie de sécurité : ${sauvegarde}`);

let contenu = readFileSync(ENV_FILE, 'utf8');
// ⚠️ La fonction de remplacement n'est PAS une élégance : passée en chaîne,
// `String.replace` interprète « $$ » comme un « $ » littéral et DÉFAIT
// l'échappement qu'on vient tout juste de poser. Le hash part alors nu dans le
// fichier, Compose en mange un morceau, et le super-admin se retrouve dehors —
// c'est exactement ce qui est arrivé le 2026-09-24.
const poser = (cle, valeur) => {
  const motif = new RegExp(`^${cle}=.*$`, 'm');
  contenu = motif.test(contenu)
    ? contenu.replace(motif, () => `${cle}=${valeur}`)
    : `${contenu.replace(/\n?$/, '\n')}${cle}=${valeur}\n`;
};

poser('SUPER_ADMIN_EMAIL', courriel);
poser('SUPER_ADMIN_PASSWORD_HASH', echappe);
poser('SUPER_ADMIN_PASSWORD', motDePasse);

// ── Relire, et simuler ce que Compose fera de cette ligne ───────────
// Écrire ne prouve rien : c'est la valeur APRÈS interpolation qui parviendra
// au conteneur. On la reconstitue ici, et on refuse de livrer un fichier qui
// ne redonnera pas un hash vérifiable. Sans ce contrôle, l'erreur ne se voit
// qu'après la recréation du conteneur — c'est-à-dire une fois dehors.
{
  const ligne = contenu.match(/^SUPER_ADMIN_PASSWORD_HASH=(.*)$/m);
  if (!ligne) mourir("la ligne du hash n'a pas été écrite — rien n'a été appliqué.");

  // Compose ramène chaque « $$ » à un « $ ».
  const vuParCompose = ligne[1].split('$$').join('$');

  if (!HASH_BCRYPT.test(vuParCompose) || !bcrypt.compareSync(motDePasse, vuParCompose)) {
    mourir(
      'le hash écrit ne survivrait pas à Docker Compose — fichier NON modifié.',
      `Écrit   : ${ligne[1].length} caractères\n` +
      `Compose : ${vuParCompose.length} caractères, commence par « ${vuParCompose.slice(0, 4)} »\n` +
      `Attendu : 60 caractères, préfixe $2b$.\n` +
      `Le fichier d'origine est intact : ${sauvegarde}`);
  }
}

writeFileSync(ENV_FILE, contenu, { mode: 0o600 });

vert(`${ENV_FILE} mis à jour (permissions 600).`);
gris('Hash vérifié après simulation de l\'interpolation Docker Compose.');

// Le même mot de passe ouvre aussi l'espace utilisateur, sauf refus explicite.
if (!args.includes('--sans-compte-utilisateur')) {
  console.log('');
  synchroniserCompteUtilisateur(courriel, hash);
}

console.log('\n───────────────────────────────────────────────────────────');
console.log(`  Adresse       : ${courriel}`);
console.log(`  Mot de passe  : \x1b[1m${motDePasse}\x1b[0m`);
console.log('───────────────────────────────────────────────────────────');
jaune('Ce mot de passe ne sera plus affiché. Notez-le maintenant.');
gris('La clé secrète plateforme est inchangée — continuez à utiliser la vôtre.');

console.log('\n⚠️  Docker fige les variables à la création du conteneur.');
console.log('   Un « restart » ne relit RIEN. Recréez le conteneur :\n');
// ⚠️ `-p maintrix-test` n'est pas décoratif : sans lui, Compose déduit le nom
// du projet du dossier courant et monte un SECOND jeu de conteneurs à côté des
// vôtres, au lieu de les remplacer. C'est le nom qu'emploie deploy-ovh.sh.
console.log(`     sudo docker compose --env-file ${ENV_FILE} -f docker-compose.test.yml -p ${PROJET} up -d --force-recreate app\n`);
console.log('   Puis relancez ce script sans --reparer pour confirmer que le');
console.log('   conteneur voit bien un hash valide.\n');
