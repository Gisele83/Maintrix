/**
 * Canal de transmission des secrets de démonstration.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI LA SORTIE STANDARD N'EST PAS UN CANAL
 * ═══════════════════════════════════════════════════════════════════
 * Le chargement du jeu de démonstration tire quatre secrets aléatoires, un
 * par compte. C'était déjà mieux qu'un mot de passe partagé lu dans
 * l'environnement. Mais ils étaient ensuite ÉCRITS SUR LA SORTIE STANDARD,
 * et une sortie standard ne disparaît pas :
 *
 *   • elle reste dans l'historique de défilement du terminal, souvent des
 *     jours, parfois jusqu'au prochain redémarrage ;
 *   • elle est capturée intégralement par tout orchestrateur qui lance la
 *     commande — CI, systemd, Docker, un agent de déploiement — et ces
 *     journaux-là sont persistants, centralisés, et consultables par des
 *     gens qui n'avaient pas besoin des secrets ;
 *   • elle apparaît sur toute capture d'écran de la fenêtre, ce qui est
 *     précisément ce que fait quelqu'un qui prépare une démonstration.
 *
 * Tirer un secret au hasard ne sert à rien si on le publie ensuite. La
 * qualité du tirage et la qualité du canal sont deux problèmes distincts ;
 * ce fichier traite le second.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE FAIT CE CANAL
 * ═══════════════════════════════════════════════════════════════════
 * Les secrets sont déposés dans UN FICHIER lisible par le seul compte qui a
 * lancé la commande, hors du dépôt, dans un répertoire propre à
 * l'utilisateur. La sortie standard n'en reçoit que le CHEMIN.
 *
 *   • Sur un système POSIX : mode 0600, vérifié après écriture — pas
 *     seulement demandé.
 *   • Sur Windows, `chmod` ne fait rien d'utile : prétendre « 0600 » y serait
 *     une protection de façade. On y coupe donc l'héritage et on reconstruit
 *     une ACL ne contenant qu'une seule entrée, celle de l'utilisateur
 *     courant, désigné par son SID ; puis on relit l'ACL pour vérifier qu'il
 *     n'en reste bien qu'une.
 *
 * La protection est établie AVANT que le fichier contienne quoi que ce soit :
 * il est créé vide, protégé, vérifié, et seulement ensuite rempli. Un fichier
 * qu'on remplit d'abord et qu'on protège ensuite est lisible pendant
 * l'intervalle.
 *
 * Et l'établissement du canal précède le chargement lui-même. Si la
 * protection ne peut pas être garantie sur ce poste, le script s'arrête avant
 * d'avoir écrit une seule ligne en base — plutôt que de laisser derrière lui
 * quatre comptes dont personne ne connaît les secrets.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CE CANAL NE PRÉTEND PAS FAIRE
 * ═══════════════════════════════════════════════════════════════════
 * Il n'est pas un gestionnaire de secrets. Il convient à un poste de
 * développement, où le modèle de menace est « mes collègues lisent mes
 * journaux de CI » et non « un attaquant est root sur ma machine » : contre
 * root, aucun fichier local ne protège rien.
 *
 * Qui dispose d'un gestionnaire de secrets peut l'utiliser à la place, en
 * pointant `MAINTRIX_DEMO_SECRETS_FICHIER` vers un chemin que son outillage
 * consomme. La protection du fichier reste appliquée et vérifiée.
 *
 * Enfin, l'effacement est un effacement de FICHIER, pas de SUPPORT. On
 * réécrit le contenu avant de supprimer, ce qui retire le texte en clair de
 * l'endroit évident ; sur un système de fichiers journalisé ou à copie sur
 * écriture, et sur un SSD à nivellement d'usure, cela ne garantit pas que les
 * octets d'origine aient disparu du support. La vraie protection ici, c'est
 * la brièveté de la vie du fichier et la restriction de ses droits.
 */
import {
  chmodSync, closeSync, existsSync, lstatSync, mkdirSync, openSync,
  readFileSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export interface SecretDeCompte {
  email: string;
  secret: string;
  libelle: string;
}

export interface Canal {
  chemin: string;
  /** Comment la protection a été obtenue, en clair, pour l'affichage. */
  protection: string;
  /** Message à afficher si un dépôt non récupéré a été écarté. */
  avertissement?: string;
}

/** Marque les lignes d'explication, que la récupération n'affiche pas. */
const COMMENTAIRE = '#';

/**
 * Répertoire propre à l'utilisateur.
 *
 * Pas `/tmp` sur POSIX : il est partagé et accessible en écriture par tous,
 * ce qui expose aux pièges classiques du nom prévisible. On préfère
 * `XDG_RUNTIME_DIR` quand il existe — le système le crée en 0700 — et sinon
 * un répertoire du domicile, créé en 0700.
 *
 * Sur Windows, `tmpdir()` est déjà propre à l'utilisateur
 * (`…\Users\<moi>\AppData\Local\Temp`), et l'ACL y est de toute façon
 * reconstruite sur le fichier.
 */
function dossierParUtilisateur(): string {
  if (process.platform === 'win32') return tmpdir();
  if (process.env.XDG_RUNTIME_DIR) return process.env.XDG_RUNTIME_DIR;
  return join(homedir(), '.maintrix');
}

export function cheminDuCanal(): string {
  return process.env.MAINTRIX_DEMO_SECRETS_FICHIER
    || join(dossierParUtilisateur(), 'maintrix-secrets-demonstration.txt');
}

// ─── Protection, par plate-forme ─────────────────────────────────────────────

function protegerPosix(chemin: string): string {
  // `chmod` demande ; `stat` constate. Les deux, parce qu'un `umask`
  // inattendu ou un système de fichiers monté sans droits POSIX (une part
  // réseau, un volume monté dans un conteneur) peut ignorer la demande en
  // silence.
  chmodSync(chemin, 0o600);
  const mode = statSync(chemin).mode & 0o777;
  if (mode !== 0o600) {
    throw new Error(
      `REFUS : impossible de protéger le dépôt des secrets.\n`
      + `   ${chemin}\n`
      + `   Mode obtenu : 0${mode.toString(8)} — attendu 0600.\n\n`
      + `   Ce chemin est probablement sur un système de fichiers qui ignore\n`
      + `   les droits POSIX (part réseau, volume monté sans droits). Pointez\n`
      + `   MAINTRIX_DEMO_SECRETS_FICHIER vers un chemin local.`,
    );
  }
  return 'mode 0600 — lisible par votre compte seul';
}

/**
 * Chemin absolu d'un outil Windows, SANS passer par le PATH.
 *
 * Deux raisons, découvertes dans cet ordre :
 *
 *   1. Le PATH mène ailleurs. Sur un poste où Git pour Windows est installé,
 *      `whoami` résout vers le `whoami` des coreutils GNU, qui ne connaît
 *      pas `/user` et répond « extra operand ». La protection échouait pour
 *      cette seule raison, c'est-à-dire pour rien.
 *   2. Et surtout : ces deux outils SONT le contrôle de sécurité. Les
 *      chercher dans le PATH, c'est accepter que n'importe quel répertoire
 *      placé devant System32 décide de ce que « protégé » veut dire. Un
 *      `icacls.exe` planté là pourrait ne rien restreindre et rendre une
 *      sortie conforme.
 */
function outilSysteme(nom: string): string {
  const racine = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  const absolu = join(racine, 'System32', `${nom}.exe`);
  // Si System32 n'est pas là où Windows le dit, on ne devine pas : on laisse
  // le PATH faire, et la vérification d'ACL reste le juge en dernier ressort.
  return existsSync(absolu) ? absolu : nom;
}

/** SID de l'utilisateur courant, pour accorder les droits sans dépendre d'un nom. */
function sidCourant(): string {
  const brut = execFileSync(outilSysteme('whoami'), ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8' });
  const champs = brut.trim().split(',').map((c) => c.replace(/^"|"$/g, '').trim());
  const sid = champs[champs.length - 1];
  if (!/^S-1-/.test(sid)) throw new Error(`SID illisible : « ${brut.trim()} »`);
  return sid;
}

/**
 * Ayants droit listés par `icacls`, c'est-à-dire ce que le système applique
 * réellement — et non ce qu'on lui a demandé.
 *
 * Sortie typique :
 *   C:\…\fichier.txt POSTE\moi:(R,W)
 *                    NT AUTHORITY\SYSTEM:(F)
 *   <ligne vide>
 *   <bilan localisé>
 */
function ayantsDroit(sortie: string, chemin: string): string[] {
  const noms: string[] = [];
  for (const ligne of sortie.split(/\r?\n/)) {
    const nette = (ligne.startsWith(chemin) ? ligne.slice(chemin.length) : ligne).trim();
    if (!nette) break; // la ligne vide clôt la liste ; après vient le bilan
    const m = /^(.*?):\(/.exec(nette);
    if (m) noms.push(m[1]);
  }
  return noms;
}

function protegerWindows(chemin: string): string {
  const sid = sidCourant();
  // `/inheritance:r` détache le fichier de l'ACL du répertoire ; `/grant:r`
  // remplace les entrées au lieu de s'y ajouter. L'étoile devant le SID dit à
  // icacls de le lire comme un SID et non comme un nom de compte — un nom se
  // résout contre un domaine, un SID ne se résout contre rien.
  const icacls = outilSysteme('icacls');
  execFileSync(icacls, [chemin, '/inheritance:r', '/grant:r', `*${sid}:(R,W)`], { stdio: 'pipe' });

  const noms = ayantsDroit(execFileSync(icacls, [chemin], { encoding: 'utf8' }), chemin);
  if (noms.length !== 1) {
    throw new Error(
      `REFUS : impossible de restreindre le dépôt des secrets à votre seul compte.\n`
      + `   ${chemin}\n`
      + `   Ayants droit après restriction : ${noms.length ? noms.join(', ') : '(aucun lisible)'}\n\n`
      + `   Attendu : un seul. Tant que ce n'est pas le cas, les secrets ne\n`
      + `   seront pas déposés — mieux vaut pas de démonstration qu'une\n`
      + `   protection de façade.`,
    );
  }
  return `ACL réduite à ${noms[0]} — héritage coupé`;
}

function proteger(chemin: string): string {
  return process.platform === 'win32' ? protegerWindows(chemin) : protegerPosix(chemin);
}

// ─── Établissement du canal ──────────────────────────────────────────────────

/**
 * Crée le dépôt, vide, protégé et vérifié. À appeler AVANT toute écriture en
 * base : si ceci lève, rien n'a encore été chargé.
 */
export function preparerCanal(): Canal {
  const chemin = cheminDuCanal();
  mkdirSync(dirname(chemin), { recursive: true, mode: 0o700 });

  let avertissement: string | undefined;

  // Un dépôt déjà présent, c'est un chargement précédent dont personne n'a
  // récupéré les secrets. Ils sont de toute façon périmés — ce chargement en
  // tire de nouveaux — donc on l'écarte. Mais on regarde d'abord à QUOI on a
  // affaire : `lstat`, pas `stat`, pour ne pas suivre un lien, et le
  // propriétaire, pour ne pas supprimer le fichier de quelqu'un d'autre.
  let ancien: ReturnType<typeof lstatSync> | null = null;
  try { ancien = lstatSync(chemin); } catch { ancien = null; }

  if (ancien) {
    if (!ancien.isFile()) {
      throw new Error(
        `REFUS : ${chemin} existe et n'est pas un fichier ordinaire.\n`
        + `   C'est peut-être un lien symbolique, un tube, un répertoire. Le\n`
        + `   canal des secrets ne suit pas un lien : écrire à travers lui\n`
        + `   déposerait les secrets ailleurs, éventuellement dans un endroit\n`
        + `   lisible par tous.\n\n`
        + `   Écartez ce chemin, ou pointez MAINTRIX_DEMO_SECRETS_FICHIER\n`
        + `   vers un autre.`,
      );
    }
    if (process.platform !== 'win32' && typeof process.getuid === 'function'
        && ancien.uid !== process.getuid()) {
      throw new Error(
        `REFUS : ${chemin} appartient à l'utilisateur ${ancien.uid}, pas à vous.\n`
        + `   Ce n'est pas un dépôt que ce script a posé. Il ne sera ni lu, ni\n`
        + `   supprimé, ni écrasé.`,
      );
    }
    unlinkSync(chemin);
    avertissement = `   ⚠ Un dépôt de secrets non récupéré a été écarté : ${chemin}\n`
      + `     Ses secrets étaient périmés : ce chargement en tire de nouveaux.`;
  }

  // `wx` = création exclusive : si le fichier apparaît entre le `unlink`
  // ci-dessus et maintenant, on échoue plutôt que d'écrire dans ce que
  // quelqu'un vient de poser là.
  closeSync(openSync(chemin, 'wx', 0o600));

  return { chemin, protection: proteger(chemin), avertissement };
}

/** Dépose les secrets dans le canal déjà protégé. */
export function deposerLesSecrets(canal: Canal, identifiantOrganisation: string, comptes: SecretDeCompte[]): void {
  const lignes = [
    `${COMMENTAIRE} Secrets du jeu de démonstration Maintrix`,
    `${COMMENTAIRE} Déposés le ${new Date().toISOString()}`,
    `${COMMENTAIRE} Organisation : ${identifiantOrganisation}`,
    `${COMMENTAIRE}`,
    `${COMMENTAIRE} Ils ne sont PAS affichés sur la sortie standard : celle-ci finit dans`,
    `${COMMENTAIRE} l'historique du terminal et dans les journaux d'un orchestrateur.`,
    `${COMMENTAIRE}`,
    `${COMMENTAIRE} Récupérez-les, ce qui efface ce fichier :`,
    `${COMMENTAIRE}     npm run demo:secrets`,
    `${COMMENTAIRE}`,
    `${COMMENTAIRE} La base n'en garde qu'une empreinte bcrypt : ce fichier est le seul`,
    `${COMMENTAIRE} endroit où ils existent en clair. Perdus, ils ne se retrouvent pas —`,
    `${COMMENTAIRE} il faut recharger le jeu, qui en tire de nouveaux.`,
    '',
    ...comptes.flatMap((c) => [`    ${c.email}`, `      ${c.secret}   (${c.libelle})`]),
    '',
  ];

  // `writeFileSync` tronque un fichier existant sans le recréer : le mode
  // POSIX comme l'ACL Windows sont conservés. On réapplique quand même la
  // protection ensuite — c'est idempotent, et c'est l'instant où le fichier
  // contient enfin quelque chose qui mérite d'être protégé.
  writeFileSync(canal.chemin, lignes.join('\n'), { encoding: 'utf8' });
  canal.protection = proteger(canal.chemin);
}

// ─── Récupération et effacement ──────────────────────────────────────────────

export interface Recuperation {
  chemin: string;
  /** Les lignes utiles, sans les explications. */
  comptes: string;
  efface: boolean;
}

export function recupererLesSecrets(options: { conserver?: boolean } = {}): Recuperation {
  const chemin = cheminDuCanal();

  let etat: ReturnType<typeof lstatSync>;
  try {
    etat = lstatSync(chemin);
  } catch {
    throw new Error(
      `Aucun dépôt de secrets à ${chemin}.\n\n`
      + `   Deux explications possibles :\n`
      + `     • ils ont déjà été récupérés — ce fichier est effacé à la lecture ;\n`
      + `     • le jeu n'a pas été chargé sur ce poste.\n\n`
      + `   Dans les deux cas, les secrets ne se retrouvent pas : la base n'en\n`
      + `   garde qu'une empreinte. Rechargez le jeu pour en obtenir de\n`
      + `   nouveaux :\n`
      + `       npm run demo:charger`,
    );
  }
  if (!etat.isFile()) {
    throw new Error(`REFUS : ${chemin} n'est pas un fichier ordinaire. Rien n'a été lu.`);
  }

  const contenu = readFileSync(chemin, 'utf8');
  const comptes = contenu
    .split(/\r?\n/)
    .filter((l) => !l.startsWith(COMMENTAIRE))
    .join('\n')
    .trim();

  if (options.conserver) return { chemin, comptes, efface: false };

  effacerLeDepot(chemin);
  return { chemin, comptes, efface: !existsSync(chemin) };
}

/**
 * Efface le dépôt. Silencieux s'il n'existe pas : appelé aussi par `--retirer`
 * et `--desactiver`, où les secrets deviennent morts de toute façon et où un
 * dépôt resté sur le disque ne protégerait plus rien, il traînerait seulement.
 */
export function effacerLeDepot(chemin = cheminDuCanal()): void {
  try {
    const etat = lstatSync(chemin);
    if (!etat.isFile()) return;
    // Réécriture avant suppression : voir l'avertissement en tête de fichier,
    // ce n'est pas un effacement de support.
    writeFileSync(chemin, '\0'.repeat(etat.size));
    unlinkSync(chemin);
  } catch {
    /* Absent, ou déjà retiré : il n'y a rien à faire. */
  }
}
