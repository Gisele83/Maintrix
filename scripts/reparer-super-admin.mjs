#!/usr/bin/env node
/**
 * Diagnostiquer, puis réparer l'accès à la console super-admin.
 *
 *   sudo node scripts/reparer-super-admin.mjs                      (diagnostic seul)
 *   sudo node scripts/reparer-super-admin.mjs --afficher-mot-de-passe
 *   sudo node scripts/reparer-super-admin.mjs --reparer
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

const motDePasse = crypto.randomBytes(18).toString('base64url');
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
const poser = (cle, valeur) => {
  const motif = new RegExp(`^${cle}=.*$`, 'm');
  contenu = motif.test(contenu)
    ? contenu.replace(motif, `${cle}=${valeur}`)
    : `${contenu.replace(/\n?$/, '\n')}${cle}=${valeur}\n`;
};

poser('SUPER_ADMIN_EMAIL', courriel);
poser('SUPER_ADMIN_PASSWORD_HASH', echappe);
poser('SUPER_ADMIN_PASSWORD', motDePasse);
writeFileSync(ENV_FILE, contenu, { mode: 0o600 });

vert(`${ENV_FILE} mis à jour (permissions 600).`);

console.log('\n───────────────────────────────────────────────────────────');
console.log(`  Adresse       : ${courriel}`);
console.log(`  Mot de passe  : \x1b[1m${motDePasse}\x1b[0m`);
console.log('───────────────────────────────────────────────────────────');
jaune('Ce mot de passe ne sera plus affiché. Notez-le maintenant.');
gris('La clé secrète plateforme est inchangée — continuez à utiliser la vôtre.');

console.log('\n⚠️  Docker fige les variables à la création du conteneur.');
console.log('   Un « restart » ne relit RIEN. Recréez le conteneur :\n');
console.log(`     sudo docker compose -f docker-compose.test.yml --env-file ${ENV_FILE} up -d --force-recreate app\n`);
console.log('   Puis relancez ce script sans --reparer pour confirmer que le');
console.log('   conteneur voit bien un hash valide.\n');
