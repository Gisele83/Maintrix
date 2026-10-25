/**
 * Jeu de démonstration — une usine crédible, pour montrer Maintrix.
 *
 *   npm run demo:charger      charge le jeu
 *   npm run demo:secrets      récupère les secrets, puis efface leur dépôt
 *   npm run demo:desactiver   coupe les accès, garde les données
 *   npm run demo:retirer      efface tout
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE, ET CE QU'IL N'EST PAS
 * ═══════════════════════════════════════════════════════════════════
 * Une longue campagne a retiré de Maintrix tout chiffre inventé : plus de MTBF
 * par défaut, plus d'OEE à 100 % sans production, plus de prédiction sur un
 * équipement sain. L'interface dit désormais « — » quand elle ne sait pas.
 *
 * Conséquence directe, et voulue : une organisation vide affiche des écrans
 * vides. C'est honnête, et c'est inutilisable pour une capture publicitaire.
 *
 * Ce jeu de données comble ce manque SANS rouvrir la porte qu'on vient de
 * fermer, et la frontière tient en une phrase :
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ Montrer ce que le produit fait, sur une usine fictive et      │
 *   │ nommée comme telle, est légitime.                             │
 *   │ Affirmer à un client que ce sont SES chiffres ne l'est pas.   │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * D'où trois règles, appliquées par le code et non seulement promises :
 *
 *   1. UNE ORGANISATION DÉDIÉE, à l'identifiant figé, nommée « Démonstration »
 *      et portant un domaine en `.demo.invalid` — un TLD réservé par la
 *      RFC 2606, donc impossible à confondre avec un vrai client.
 *   2. REFUS D'ÉCRIRE AILLEURS. Le script ne touche qu'à cet identifiant, et
 *      s'arrête s'il trouve dans cette organisation des données qu'il n'a pas
 *      lui-même créées.
 *   3. RÉVERSIBLE. `--retirer` efface exactement ce qui a été posé.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI EST GÉNÉRÉ, ET POURQUOI C'EST DE CETTE FORME
 * ═══════════════════════════════════════════════════════════════════
 * Les indicateurs de Maintrix ne s'affichent plus que s'ils sont calculables.
 * Un jeu de démonstration doit donc fournir la MATIÈRE du calcul, et non les
 * résultats : des interventions datées, pas un MTBF ; des relevés de capteurs,
 * pas un indice de santé. C'est ce qui fait la différence entre une vitrine et
 * un décor en carton — ici, les chiffres affichés sont réellement calculés à
 * partir des données ci-dessous.
 *
 *   • 14 équipements industriels, criticités et états variés ;
 *   • 14 mois d'ordres de travail — préventifs, correctifs, urgences — avec
 *     dates de début ET de fin réelles, pour que MTBF, MTTR, taux de
 *     résolution et courbes mensuelles aient de quoi se calculer ;
 *   • des relevés de capteurs sur 90 jours, dont une dérive lente sur un
 *     équipement, pour que l'IMCA et le RUL stochastique produisent autre
 *     chose qu'une absence ;
 *   • un magasin avec consommations enregistrées, pour que le point de
 *     commande suggéré repose sur une vraie variabilité ;
 *   • des plans de maintenance aux échéances échelonnées ;
 *   • des alertes, dont certaines résolues.
 *
 * Le tirage est DÉTERMINISTE : deux exécutions donnent la même usine, donc
 * deux captures d'écran comparables.
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { preparerCanal, deposerLesSecrets, effacerLeDepot } from './canal-secrets';

// ─── Identité du jeu de démonstration ────────────────────────────────────────

/** Identifiant figé : le script ne touche QUE cette organisation. */
export const TENANT_DEMO = '00000000-0000-4000-8000-0000000de401';

/** Domaine en TLD réservé (RFC 2606) : impossible à confondre avec un client. */
const DOMAINE_DEMO = 'usine.demo.invalid';

/** Marqueur apposé sur chaque ligne créée, pour pouvoir tout retirer. */
const MARQUEUR = '[démo]';

/**
 * Préfixe de site appliqué aux repères d'équipement, aux numéros d'OT et aux
 * références magasin.
 *
 * ⚠️ Ce n'est pas de la cosmétique. Dans `shared/schema.ts`, trois colonnes
 * sont `.unique()` SANS être combinées au locataire :
 *
 *     equipmentRegistry.equipmentId   workOrders.orderNumber   spareParts.partNumber
 *
 * Un repère « CMP-001 » posé ici entrerait donc en collision avec celui qu'un
 * testeur aurait créé dans SON organisation, et le chargement échouerait — ou,
 * pire, échouerait à moitié. Le préfixe de site écarte la collision tout en
 * restant plausible à l'écran : préfixer les repères par un code site est
 * l'usage courant en GMAO.
 */
const SITE = 'VER';

// ─── Dimensions du jeu ───────────────────────────────────────────────────────
// Au niveau du module, et non dans la fonction de chargement : le contrôle
// préalable en a besoin avant que la moindre ligne ne soit écrite.

/** Profondeur de l'historique d'interventions, en jours (un peu plus de 14 mois). */
const JOURS_HISTORIQUE = 430;

/** Profondeur de l'historique de capteurs, en jours. */
const JOURS_CAPTEURS = 90;

/** Relevés par capteur et par jour. */
const RELEVES_PAR_JOUR = 4;

/** Équipement porteur de la dégradation lente qui alimente l'IMCA et le RUL. */
const CODE_DERIVE = 'MOT-203';

/**
 * Valeurs refusées comme mot de passe.
 *
 * Un exemple de documentation finit par être saisi tel quel — c'est déjà
 * arrivé sur `reparer-super-admin.mjs`, où un libellé d'exemple est devenu le
 * mot de passe effectif d'un compte. On refuse donc explicitement.
 */
const VALEURS_DEXEMPLE = [
  'demonstration2026!', 'motdepasse', 'password', 'changeme', 'demo',
  'celui que vous choisissez', 'votre mot de passe',
];

/**
 * Un secret FORT et DISTINCT par compte de démonstration.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI A CHANGÉ, ET POURQUOI
 * ═══════════════════════════════════════════════════════════════════
 * Les quatre comptes partageaient un seul mot de passe, et `MAINTRIX_DEMO_
 * PASSWORD` permettait de le choisir. Deux conséquences :
 *
 *   • le compte le plus étendu — `owner` — était accessible avec le même
 *     secret que le compte technicien. Qui obtenait l'un obtenait l'autre ;
 *   • un mot de passe fourni par variable d'environnement finit dans
 *     l'historique du terminal, dans les journaux d'un orchestrateur, et
 *     parfois dans un fichier de configuration versionné.
 *
 * Désormais : un secret tiré au hasard par compte, à chaque chargement,
 * jamais lu depuis l'environnement.
 *
 * Et ils ne sont PAS affichés. Un tirage aléatoire ne protège rien si le
 * résultat part sur la sortie standard, laquelle survit dans l'historique du
 * terminal et dans les journaux de tout orchestrateur qui a lancé la
 * commande. Ils sont déposés dans un fichier que seul le compte courant peut
 * lire, et récupérés par une commande distincte qui l'efface ensuite —
 * `npm run demo:secrets`. Voir `scripts/canal-secrets.ts` pour le détail et
 * pour ce que cette protection ne prétend pas être.
 *
 * MAINTRIX_DEMO_PASSWORD N'EST PLUS LU. Le signaler explicitement vaut mieux
 * que l'ignorer en silence : qui l'utilisait doit savoir que son mot de passe
 * n'est plus posé, au lieu de découvrir des comptes inaccessibles.
 */
function secretAleatoire(): string {
  // Tirage cryptographique — pas le générateur déterministe de ce fichier,
  // qui est reproductible par construction et donc inapte à un secret.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const octets = randomBytes(24);
  return `Demo-${Array.from(octets, (o) => alphabet[o % alphabet.length]).join('')}`;
}

function refuserMotDePasseImpose(): void {
  if (process.env.MAINTRIX_DEMO_PASSWORD) {
    throw new Error(
      'MAINTRIX_DEMO_PASSWORD n\'est plus pris en compte.\n'
      + '  Chaque compte de démonstration reçoit désormais un secret ALÉATOIRE\n'
      + '  et DISTINCT. Un secret partagé entre un compte owner et un compte\n'
      + '  technicien donnait le premier à qui obtenait le second.\n\n'
      + '  Retirez cette variable et relancez. Les quatre secrets ne seront pas\n'
      + '  affichés : ils seront déposés dans un fichier lisible par vous seul,\n'
      + '  que « npm run demo:secrets » vous montrera puis effacera.',
    );
  }
}

// ─── Générateur déterministe ─────────────────────────────────────────────────

/**
 * Suite pseudo-aléatoire reproductible (xorshift32).
 *
 * `Math.random()` donnerait une usine différente à chaque exécution, donc des
 * captures incomparables d'une session à l'autre.
 */
function tirage(graine: number) {
  let s = graine >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const alea = tirage(20261019);
const entre = (min: number, max: number) => min + alea() * (max - min);
const entier = (min: number, max: number) => Math.floor(entre(min, max + 1));
const parmi = <T>(liste: readonly T[]): T => liste[entier(0, liste.length - 1)];

/** Repère complet d'un équipement, tel qu'il s'affiche à l'écran. */
const repere = (code: string) => `${SITE}-${code}`;

const JOUR = 86_400_000;
const maintenant = new Date('2026-10-19T08:00:00Z').getTime();
const ilYA = (jours: number) => new Date(maintenant - jours * JOUR);

// ─── Le parc ─────────────────────────────────────────────────────────────────

interface DefinitionEquipement {
  code: string;
  nom: string;
  type: string;
  fabricant: string;
  modele: string;
  zone: string;
  criticite: 'critical' | 'high' | 'medium' | 'low';
  etat: 'operational' | 'maintenance' | 'offline';
  /** Pannes par an — gouverne la densité d'ordres correctifs générés. */
  tauxPanne: number;
  /** Capteurs rattachés, pour les relevés. */
  capteurs: Array<{ type: string; unite: string; nominal: number; dispersion: number }>;
}

const PARC: DefinitionEquipement[] = [
  {
    code: 'CMP-001', nom: 'Compresseur d\'air principal', type: 'compresseur',
    fabricant: 'Atlas Copco', modele: 'GA 75 VSD+', zone: 'Utilités',
    criticite: 'critical', etat: 'operational', tauxPanne: 3.2,
    capteurs: [
      { type: 'temperature', unite: '°C', nominal: 68, dispersion: 3 },
      { type: 'vibration', unite: 'mm/s', nominal: 2.1, dispersion: 0.4 },
      { type: 'pressure', unite: 'bar', nominal: 7.5, dispersion: 0.3 },
    ],
  },
  {
    code: 'PMP-014', nom: 'Pompe alimentaire chaudière', type: 'pompe',
    fabricant: 'Grundfos', modele: 'CR 64-3', zone: 'Chaufferie',
    criticite: 'critical', etat: 'operational', tauxPanne: 2.4,
    capteurs: [
      { type: 'temperature', unite: '°C', nominal: 54, dispersion: 2.5 },
      { type: 'vibration', unite: 'mm/s', nominal: 1.8, dispersion: 0.3 },
      { type: 'flow', unite: 'm³/h', nominal: 42, dispersion: 2 },
    ],
  },
  {
    code: 'MOT-203', nom: 'Moteur convoyeur ligne 2', type: 'moteur',
    fabricant: 'Siemens', modele: '1LE1001-1DB2', zone: 'Production',
    criticite: 'high', etat: 'operational', tauxPanne: 4.1,
    // Dérive lente : c'est cet équipement qui alimente l'IMCA et le RUL.
    capteurs: [
      { type: 'temperature', unite: '°C', nominal: 62, dispersion: 2 },
      { type: 'vibration', unite: 'mm/s', nominal: 2.4, dispersion: 0.35 },
      { type: 'current', unite: 'A', nominal: 38, dispersion: 1.5 },
    ],
  },
  {
    code: 'VNT-007', nom: 'Ventilateur extraction atelier', type: 'ventilateur',
    fabricant: 'Systemair', modele: 'AXC 800', zone: 'Atelier',
    criticite: 'medium', etat: 'operational', tauxPanne: 1.8,
    capteurs: [
      { type: 'vibration', unite: 'mm/s', nominal: 3.1, dispersion: 0.5 },
      { type: 'current', unite: 'A', nominal: 12, dispersion: 0.8 },
    ],
  },
  {
    code: 'CVY-101', nom: 'Convoyeur à bande ligne 1', type: 'convoyeur',
    fabricant: 'Interroll', modele: 'Portec 1200', zone: 'Production',
    criticite: 'high', etat: 'operational', tauxPanne: 5.3,
    capteurs: [{ type: 'speed', unite: 'm/s', nominal: 1.2, dispersion: 0.05 }],
  },
  {
    code: 'PRS-002', nom: 'Presse hydraulique 200 t', type: 'presse',
    fabricant: 'Schuler', modele: 'MSD 200', zone: 'Production',
    criticite: 'critical', etat: 'maintenance', tauxPanne: 2.9,
    capteurs: [
      { type: 'pressure', unite: 'bar', nominal: 185, dispersion: 6 },
      { type: 'temperature', unite: '°C', nominal: 48, dispersion: 3 },
    ],
  },
  {
    code: 'CHD-001', nom: 'Chaudière vapeur 4 t/h', type: 'chaudiere',
    fabricant: 'Bosch', modele: 'UL-S 4000', zone: 'Chaufferie',
    criticite: 'critical', etat: 'operational', tauxPanne: 1.6,
    capteurs: [
      { type: 'temperature', unite: '°C', nominal: 178, dispersion: 5 },
      { type: 'pressure', unite: 'bar', nominal: 9.2, dispersion: 0.4 },
    ],
  },
  {
    code: 'GRP-001', nom: 'Groupe froid process', type: 'groupe_froid',
    fabricant: 'Carrier', modele: '30XA-452', zone: 'Utilités',
    criticite: 'high', etat: 'operational', tauxPanne: 2.2,
    capteurs: [
      { type: 'temperature', unite: '°C', nominal: 6.5, dispersion: 1.2 },
      { type: 'pressure', unite: 'bar', nominal: 14, dispersion: 0.8 },
    ],
  },
  {
    code: 'ROB-011', nom: 'Robot de palettisation', type: 'robot',
    fabricant: 'KUKA', modele: 'KR 180 R2900', zone: 'Expédition',
    criticite: 'high', etat: 'operational', tauxPanne: 3.0,
    capteurs: [
      { type: 'vibration', unite: 'mm/s', nominal: 1.4, dispersion: 0.25 },
      { type: 'current', unite: 'A', nominal: 22, dispersion: 1.1 },
    ],
  },
  {
    code: 'TRF-001', nom: 'Transformateur 630 kVA', type: 'transformateur',
    fabricant: 'Schneider', modele: 'Trihal 630', zone: 'Poste HT',
    criticite: 'critical', etat: 'operational', tauxPanne: 0.6,
    capteurs: [{ type: 'temperature', unite: '°C', nominal: 72, dispersion: 4 }],
  },
  {
    code: 'SCH-003', nom: 'Sécheur d\'air frigorifique', type: 'secheur',
    fabricant: 'Atlas Copco', modele: 'FD 260', zone: 'Utilités',
    criticite: 'medium', etat: 'operational', tauxPanne: 2.0,
    capteurs: [{ type: 'temperature', unite: '°C', nominal: 3.2, dispersion: 0.9 }],
  },
  {
    code: 'PMP-022', nom: 'Pompe doseuse traitement eau', type: 'pompe',
    fabricant: 'ProMinent', modele: 'Sigma/2', zone: 'Traitement eau',
    criticite: 'medium', etat: 'operational', tauxPanne: 3.6,
    capteurs: [{ type: 'flow', unite: 'L/h', nominal: 85, dispersion: 6 }],
  },
  {
    code: 'CVY-102', nom: 'Convoyeur à rouleaux expédition', type: 'convoyeur',
    fabricant: 'Interroll', modele: 'RollerDrive EC5000', zone: 'Expédition',
    criticite: 'low', etat: 'operational', tauxPanne: 2.5,
    capteurs: [{ type: 'speed', unite: 'm/s', nominal: 0.6, dispersion: 0.04 }],
  },
  {
    code: 'GEN-001', nom: 'Groupe électrogène de secours', type: 'groupe_electrogene',
    fabricant: 'Caterpillar', modele: 'C18 550 kVA', zone: 'Poste HT',
    criticite: 'high', etat: 'offline', tauxPanne: 0.9,
    capteurs: [{ type: 'temperature', unite: '°C', nominal: 24, dispersion: 2 }],
  },
];

// ─── Catalogue des interventions ─────────────────────────────────────────────

const PREVENTIFS: Record<string, Array<{ titre: string; duree: number }>> = {
  compresseur: [
    { titre: 'Remplacement filtre à air et séparateur', duree: 120 },
    { titre: 'Vidange huile compresseur', duree: 180 },
    { titre: 'Contrôle des courroies et tension', duree: 60 },
  ],
  pompe: [
    { titre: 'Contrôle garniture mécanique', duree: 90 },
    { titre: 'Graissage roulements', duree: 45 },
    { titre: 'Relevé vibratoire et alignement', duree: 120 },
  ],
  moteur: [
    { titre: 'Mesure isolement bobinages', duree: 90 },
    { titre: 'Relubrification roulements', duree: 60 },
    { titre: 'Contrôle thermographique', duree: 45 },
  ],
  ventilateur: [{ titre: 'Équilibrage et nettoyage turbine', duree: 150 }],
  convoyeur: [
    { titre: 'Contrôle alignement et tension bande', duree: 90 },
    { titre: 'Graissage galets et rouleaux', duree: 60 },
  ],
  presse: [
    { titre: 'Contrôle circuit hydraulique et flexibles', duree: 240 },
    { titre: 'Vérification sécurités et barrières immatérielles', duree: 120 },
  ],
  chaudiere: [
    { titre: 'Ramonage et contrôle combustion', duree: 300 },
    { titre: 'Épreuve soupapes de sécurité', duree: 120 },
  ],
  groupe_froid: [{ titre: 'Contrôle étanchéité circuit frigorifique', duree: 180 }],
  robot: [{ titre: 'Calibration axes et contrôle réducteurs', duree: 240 }],
  transformateur: [{ titre: 'Analyse diélectrique et contrôle thermique', duree: 180 }],
  secheur: [{ titre: 'Nettoyage condenseur et purgeur', duree: 90 }],
  groupe_electrogene: [{ titre: 'Essai en charge mensuel', duree: 120 }],
};

const CORRECTIFS: Record<string, Array<{ titre: string; duree: number; cout: number }>> = {
  compresseur: [
    { titre: 'Fuite d\'air sur raccord de refoulement', duree: 90, cout: 180 },
    { titre: 'Déclenchement thermique — surchauffe', duree: 240, cout: 650 },
  ],
  pompe: [
    { titre: 'Fuite garniture mécanique', duree: 180, cout: 420 },
    { titre: 'Roulement bruyant côté accouplement', duree: 300, cout: 780 },
  ],
  moteur: [
    { titre: 'Échauffement anormal palier avant', duree: 270, cout: 890 },
    { titre: 'Vibrations excessives — désalignement', duree: 210, cout: 540 },
  ],
  ventilateur: [{ titre: 'Balourd turbine après encrassement', duree: 180, cout: 360 }],
  convoyeur: [
    { titre: 'Déchirure de bande — arrêt ligne', duree: 420, cout: 2400 },
    { titre: 'Blocage galet porteur', duree: 120, cout: 190 },
  ],
  presse: [{ titre: 'Chute de pression circuit principal', duree: 360, cout: 1850 }],
  chaudiere: [{ titre: 'Défaut allumage brûleur', duree: 240, cout: 920 }],
  groupe_froid: [{ titre: 'Manque de charge frigorigène', duree: 300, cout: 1100 }],
  robot: [{ titre: 'Dérive position axe 4', duree: 330, cout: 1600 }],
  transformateur: [{ titre: 'Échauffement enroulement phase 2', duree: 480, cout: 3200 }],
  secheur: [{ titre: 'Purgeur bloqué — point de rosée dégradé', duree: 120, cout: 240 }],
  pompe_doseuse: [{ titre: 'Clapet encrassé', duree: 90, cout: 130 }],
  groupe_electrogene: [{ titre: 'Batterie de démarrage HS', duree: 90, cout: 320 }],
};

// ─── Magasin ─────────────────────────────────────────────────────────────────

const PIECES = [
  { ref: 'FLT-AIR-075', nom: 'Filtre à air GA 75', cat: 'Filtration', prix: 86, stock: 7, mini: 3, delai: 10, conso: 'reguliere' },
  { ref: 'HUI-SYN-20L', nom: 'Huile synthèse compresseur 20 L', cat: 'Lubrifiants', prix: 142, stock: 4, mini: 2, delai: 7, conso: 'reguliere' },
  { ref: 'GRN-MEC-64', nom: 'Garniture mécanique CR 64', cat: 'Étanchéité', prix: 310, stock: 1, mini: 2, delai: 21, conso: 'rare' },
  { ref: 'ROU-6308-2RS', nom: 'Roulement 6308-2RS', cat: 'Roulements', prix: 48, stock: 12, mini: 6, delai: 5, conso: 'reguliere' },
  { ref: 'COU-XPA-1400', nom: 'Courroie XPA 1400', cat: 'Transmission', prix: 34, stock: 0, mini: 4, delai: 6, conso: 'reguliere' },
  { ref: 'BND-CVY-1200', nom: 'Bande convoyeur 1200 mm (m)', cat: 'Convoyage', prix: 95, stock: 18, mini: 10, delai: 28, conso: 'rare' },
  { ref: 'JNT-HYD-200', nom: 'Kit joints vérin 200 t', cat: 'Hydraulique', prix: 480, stock: 2, mini: 1, delai: 35, conso: 'rare' },
  { ref: 'SND-TEMP-PT100', nom: 'Sonde PT100 process', cat: 'Instrumentation', prix: 76, stock: 9, mini: 4, delai: 12, conso: 'reguliere' },
  { ref: 'FLT-HUI-FD260', nom: 'Filtre huile sécheur FD 260', cat: 'Filtration', prix: 54, stock: 6, mini: 3, delai: 9, conso: 'reguliere' },
  { ref: 'BAT-12V-110', nom: 'Batterie 12 V 110 Ah', cat: 'Électrique', prix: 165, stock: 3, mini: 2, delai: 4, conso: 'rare' },
];

// ═════════════════════════════════════════════════════════════════════════════

/**
 * Contrôle préalable : le jeu généré franchit-il les seuils que les
 * indicateurs exigent pour être calculables ?
 *
 * Maintrix n'invente plus rien. Chaque indicateur a un seuil en dessous
 * duquel il renvoie `undefined`, et l'écran affiche « — ». Un jeu de
 * démonstration qui passerait sous l'un de ces seuils produirait donc des
 * écrans vides — exactement ce qu'il est censé éviter, et on ne s'en
 * apercevrait qu'après le chargement, devant la capture ratée.
 *
 * D'où cette vérification AVANT la première écriture : les seuils sont
 * importés des modules qui les appliquent, jamais recopiés, sans quoi ils
 * divergeraient au premier ajustement.
 */
function verifierSeuils(sortiesMinimales: number): void {
  const manques: string[] = [];

  // ── MTBF et MTTR : moyenne des intervalles entre pannes ──
  // `gmao-storage.ts` les calcule par période mensuelle sur les ordres
  // `corrective` et `emergency`. Il en faut donc au moins deux par mois,
  // sinon il n'existe aucun intervalle à moyenner.
  const correctifsParEquipement = PARC.map(
    (e) => Math.max(1, Math.round((e.tauxPanne * JOURS_HISTORIQUE) / 365)),
  );
  const totalCorrectifs = correctifsParEquipement.reduce((s, n) => s + n, 0);
  const mois = JOURS_HISTORIQUE / 30.44;
  if (totalCorrectifs / mois < 2) {
    manques.push(
      `MTBF : ${totalCorrectifs} correctifs sur ${mois.toFixed(1)} mois, `
      + `soit ${(totalCorrectifs / mois).toFixed(1)}/mois — il en faut 2 pour former un intervalle.`,
    );
  }

  // ── Point de commande : écart-type des sorties ──
  const planchers = PIECES.map((p) => (p.conso === 'reguliere' ? 12 : 6));
  const pire = Math.min(...planchers);
  if (pire < sortiesMinimales) {
    manques.push(
      `Point de commande : au pire ${pire} sorties générées, `
      + `or shared/stock.ts en exige ${sortiesMinimales}.`,
    );
  }

  // ── Dérive : le RUL stochastique a besoin d'une série assez longue ──
  const pointsParCapteur = (JOURS_CAPTEURS + 1) * RELEVES_PAR_JOUR;
  if (pointsParCapteur < 30) {
    manques.push(`RUL : ${pointsParCapteur} relevés par capteur, série trop courte.`);
  }
  if (!PARC.some((e) => e.code === CODE_DERIVE)) {
    manques.push(`RUL : aucun équipement ne porte le code ${CODE_DERIVE}, donc aucune dérive.`);
  }

  if (manques.length) {
    throw new Error(
      `Le jeu généré ne permettrait pas de calculer tous les indicateurs.\n`
      + `Rien n'a été écrit. Points à corriger :\n`
      + manques.map((m) => `  • ${m}`).join('\n'),
    );
  }
}

/**
 * L'environnement est-il autorisé à recevoir — ou à perdre — ce jeu ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CETTE FONCTION A ÉTÉ RÉÉCRITE
 * ═══════════════════════════════════════════════════════════════════
 * La version précédente tenait en une ligne utile : refuser si le NOM de la
 * base contient « prod ». Trois faiblesses, et la dernière est la pire.
 *
 *   • UN SEUL SIGNAL. Une base de production nommée `maintrix`, `app` ou
 *     `postgres` — le cas le plus courant — passait sans un mot.
 *   • AUTORISATION PAR DÉFAUT. Tout ce qui n'était pas reconnu comme
 *     production était accepté. L'inconnu valait permission.
 *   • LA SUPPRESSION PASSAIT PAR LÀ AUSSI. `--retirer` franchissait la même
 *     garde : une base de production nommée sobrement pouvait donc être
 *     amputée de ses locataires, pas seulement enrichie.
 *
 * Le principe est inversé : REFUS PAR DÉFAUT. Il faut une preuve positive et
 * CONVERGENTE d'être ailleurs qu'en production. Trois signaux indépendants
 * sont relevés, et l'exécution n'est autorisée que si les trois concordent.
 *
 *   1. IDENTITÉ de la base — son nom porte-t-il un marqueur de test ?
 *   2. DESTINATION — l'hôte est-il local ou sur un réseau privé ?
 *   3. CONTENU — la base porte-t-elle déjà des organisations qui ressemblent
 *      à de vrais clients ? C'est le signal le plus difficile à tromper :
 *      il ne dépend ni du nom qu'on a donné à la base, ni de l'adresse par
 *      laquelle on y accède, mais de ce qu'elle contient réellement.
 *
 * `NODE_ENV` N'EST PAS UN SIGNAL. Il est relevé et affiché pour information,
 * jamais compté : c'est une variable d'environnement que n'importe quel
 * script peut poser, y compris par erreur, et la production tourne souvent
 * avec un `NODE_ENV` hérité d'un outillage.
 */
type Verdict = 'autorise' | 'interdit' | 'ambigu';

/**
 * Le forçage est-il RECEVABLE sur cette base ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI UNE CHAÎNE NE SUFFIT PAS
 * ═══════════════════════════════════════════════════════════════════
 * La version précédente acceptait le forçage sur simple présence de
 * `MAINTRIX_DEMO_FORCER=oui-je-sais-ce-que-je-fais`. Cette chaîne est écrite
 * dans ce fichier, donc publique ; elle traîne dans les historiques de
 * terminal et dans les scripts d'outillage. Un secret partagé qui ne sort
 * jamais du dépôt n'est pas un secret : c'est un mot de passe par défaut.
 *
 * Or ce que le forçage autorise n'est pas anodin — `--retirer` supprime des
 * organisations entières. Une opération destructive ne doit pas dépendre
 * d'une chaîne que n'importe qui peut lire ici.
 *
 * Le forçage exige donc DEUX choses, et la seconde ne vit pas dans le dépôt :
 *
 *   1. l'intention, toujours — la variable d'environnement ;
 *   2. une HABILITATION DE LA BASE ELLE-MÊME, par l'un de deux moyens :
 *
 *      a) un MARQUEUR POSÉ SUR LA BASE, vérifiable et durable :
 *           COMMENT ON DATABASE ma_base IS 'maintrix:environnement=test';
 *         Il exige les droits de propriétaire de la base, il voyage avec
 *         elle, il survit aux redémarrages, et il ne peut pas être posé par
 *         inadvertance. Une base de production ne le porte pas.
 *
 *      b) une LISTE EXPLICITE de bases autorisées :
 *           MAINTRIX_DEMO_BASES_AUTORISEES=maintrix_dev,bac_a_sable
 *         Pour les postes où l'on n'a pas la main sur le commentaire de la
 *         base. La liste nomme les bases une par une — pas de joker.
 *
 * Dans les deux cas, l'habilitation désigne UNE BASE PRÉCISE. Connaître la
 * chaîne de forçage ne donne plus rien par soi-même : il faut en plus avoir
 * désigné cette base-là, délibérément, avec des droits qu'on n'a pas par
 * hasard.
 *
 * Et cela ne change rien au reste : le forçage ne lève toujours QUE
 * l'ambiguïté, jamais un signal de production.
 */
const MARQUEUR_BASE = 'maintrix:environnement=test';

interface Habilitation {
  recevable: boolean;
  moyen: 'marqueur' | 'liste' | 'aucun';
  detail: string;
}

async function habilitationDeLaBase(db: any, nomBase: string): Promise<Habilitation> {
  // a) Marqueur posé sur la base.
  try {
    const r = await db.execute(sql`
      SELECT shobj_description(oid, 'pg_database') AS commentaire
      FROM pg_database WHERE datname = current_database()
    `);
    const rangs = ((r as { rows?: unknown[] }).rows ?? r) as Array<{ commentaire: string | null }>;
    const commentaire = rangs[0]?.commentaire ?? '';
    if (commentaire.includes(MARQUEUR_BASE)) {
      return { recevable: true, moyen: 'marqueur', detail: `commentaire de la base : « ${commentaire.slice(0, 60)} »` };
    }
  } catch {
    /* Pas de droit de lecture sur le catalogue : on retombe sur la liste. */
  }

  // b) Liste explicite.
  const liste = (process.env.MAINTRIX_DEMO_BASES_AUTORISEES ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (liste.includes(nomBase)) {
    return { recevable: true, moyen: 'liste', detail: `« ${nomBase} » figure dans MAINTRIX_DEMO_BASES_AUTORISEES` };
  }

  return {
    recevable: false,
    moyen: 'aucun',
    detail: liste.length
      ? `« ${nomBase} » ne figure pas dans la liste autorisée (${liste.join(', ')}), et la base ne porte pas le marqueur`
      : 'la base ne porte pas le marqueur, et aucune liste autorisée n\'est déclarée',
  };
}

interface Environnement {
  verdict: Verdict;
  nomBase: string;
  hote: string;
  signaux: Array<{ nom: string; valeur: string; conclusion: 'test' | 'production' | 'inconnu' }>;
  motif: string;
  /**
   * L'habilitation n'est PAS un signal : elle ne pèse pas sur le verdict.
   * Elle conditionne le droit de le FORCER. On la calcule dans tous les cas,
   * pour que le refus puisse nommer laquelle des deux moitiés manque au lieu
   * de renvoyer un « non » sans prise.
   */
  habilitation: Habilitation;
}

/** Noms qui désignent sans ambiguïté un environnement jetable. */
const MARQUEURS_TEST = /(^|[_-])(test|tests|dev|devel|demo|local|sandbox|bac[_-]?a[_-]?sable|ci)([_-]|$)/i;
/** Noms qui désignent sans ambiguïté la production. */
const MARQUEURS_PRODUCTION = /(^|[_-])(prod|production|live|prd)([_-]|$)/i;

/** Hôtes acceptés : la machine elle-même, ou une adresse de réseau privé. */
function hoteEstPrive(hote: string): boolean {
  if (!hote) return false;
  if (hote === 'localhost' || hote === '127.0.0.1' || hote === '::1' || hote === '[::1]') return true;
  if (/\.(local|localhost|test|internal)$/i.test(hote)) return true;
  // RFC 1918 et lien-local.
  if (/^10\./.test(hote)) return true;
  if (/^192\.168\./.test(hote)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hote)) return true;
  if (/^169\.254\./.test(hote)) return true;
  return false;
}

/**
 * Troisième signal : la base contient-elle de vrais clients ?
 *
 * Une organisation est tenue pour RÉELLE si elle porte des équipements et
 * que ni son nom ni son domaine ne la désignent comme un jeu d'essai. C'est
 * volontairement strict : mieux vaut refuser sur une base de test mal nommée
 * — l'exploitant lèvera l'ambiguïté en renommant ou en forçant — que de
 * charger, ou pire de supprimer, chez un client.
 */
async function contenuRessembleAProduction(db: any, tenants: any, equipmentRegistry: any): Promise<{ reel: number; exemples: string[] }> {
  let lignes: { rows?: unknown[] } | unknown[];
  try {
    lignes = await db.execute(sql`
      SELECT t.id, t.name, t.domain, COUNT(e.id)::int AS equipements
      FROM tenants t
      LEFT JOIN equipment_registry e ON e.tenant_id = t.id
      WHERE t.id <> ${TENANT_DEMO}
      GROUP BY t.id, t.name, t.domain
    `);
  } catch {
    // Pas de table `tenants` : ce n'est pas une base Maintrix installée, donc
    // sûrement pas une base de production. On rend « aucune organisation
    // réelle » plutôt que de laisser remonter une erreur SQL, qui ferait
    // passer un refus net pour une panne. Les deux autres signaux — nom et
    // hôte — restent seuls juges, et l'ambiguïté continue de valoir refus.
    return { reel: 0, exemples: [] };
  }
  const rangs: Array<{ name: string; domain: string | null; equipements: number }> = ((lignes as { rows?: unknown[] }).rows ?? lignes) as never;

  const suspects = rangs.filter((r) => {
    if (!r.equipements) return false;
    const texte = `${r.name ?? ''} ${r.domain ?? ''}`;
    const estEssai = MARQUEURS_TEST.test(texte)
      || /\.(test|local|invalid|example)(\b|$)/i.test(r.domain ?? '')
      || /\[démo\]|\[demo\]|témoin|temoin/i.test(texte);
    return !estEssai;
  });

  return { reel: suspects.length, exemples: suspects.slice(0, 3).map((r) => `${r.name} (${r.domain ?? 'sans domaine'}, ${r.equipements} équipements)`) };
}

async function examinerEnvironnement(url: string, db: any, tenants: any, equipmentRegistry: any): Promise<Environnement> {
  let nomBase = '';
  let hote = '';
  try {
    const u = new URL(url);
    nomBase = u.pathname.replace(/^\//, '');
    hote = u.hostname;
  } catch {
    /* URL illisible : les signaux resteront inconnus, donc refus. */
  }

  const signaux: Environnement['signaux'] = [];

  // 1. Identité de la base.
  if (MARQUEURS_PRODUCTION.test(nomBase)) {
    signaux.push({ nom: 'nom de la base', valeur: nomBase || '(illisible)', conclusion: 'production' });
  } else if (MARQUEURS_TEST.test(nomBase)) {
    signaux.push({ nom: 'nom de la base', valeur: nomBase, conclusion: 'test' });
  } else {
    signaux.push({ nom: 'nom de la base', valeur: nomBase || '(illisible)', conclusion: 'inconnu' });
  }

  // 2. Destination.
  signaux.push({
    nom: 'hôte', valeur: hote || '(illisible)',
    conclusion: hoteEstPrive(hote) ? 'test' : 'inconnu',
  });

  // 3. Contenu réel.
  const contenu = await contenuRessembleAProduction(db, tenants, equipmentRegistry);
  signaux.push({
    nom: 'organisations en base',
    valeur: contenu.reel === 0 ? 'aucune organisation réelle' : contenu.exemples.join(' ; '),
    conclusion: contenu.reel === 0 ? 'test' : 'production',
  });

  // Calculée ici parce que c'est la seule fonction qui tient la base ouverte :
  // `appliquerVerdict` est synchrone et n'a rien pour interroger le catalogue.
  const habilitation = await habilitationDeLaBase(db, nomBase);

  const production = signaux.filter((s) => s.conclusion === 'production');
  const inconnus = signaux.filter((s) => s.conclusion === 'inconnu');

  if (production.length) {
    return { verdict: 'interdit', nomBase, hote, signaux, habilitation, motif: production.map((s) => `${s.nom} : ${s.valeur}`).join(' — ') };
  }
  if (inconnus.length) {
    return { verdict: 'ambigu', nomBase, hote, signaux, habilitation, motif: inconnus.map((s) => s.nom).join(', ') };
  }
  return { verdict: 'autorise', nomBase, hote, signaux, habilitation, motif: 'les trois signaux concordent' };
}

/**
 * Applique le verdict. N'écrit rien, ne supprime rien : elle lève, et c'est
 * l'appelant qui n'ira pas plus loin.
 *
 * Le forçage `MAINTRIX_DEMO_FORCER` ne lève QUE l'ambiguïté. Il ne peut pas
 * passer outre un signal de production : si la base contient de vrais
 * clients, aucune variable d'environnement ne doit suffire à y charger un
 * jeu de démonstration — ni, surtout, à en supprimer des organisations.
 */
function appliquerVerdict(env: Environnement, operation: 'charger' | 'retirer'): void {
  const tableau = env.signaux
    .map((s) => `     ${s.nom.padEnd(24)} ${String(s.valeur).slice(0, 52).padEnd(54)} ${s.conclusion}`)
    .join('\n');
  const entete = `\n   Environnement examiné (NODE_ENV=${process.env.NODE_ENV ?? 'non défini'}, non pris en compte) :\n${tableau}\n`;

  if (env.verdict === 'interdit') {
    throw new Error(
      `REFUS : cette base porte des marques de PRODUCTION.\n${entete}\n`
      + `   Motif : ${env.motif}\n\n`
      + `   L'opération « ${operation} » est interdite ici, et aucune variable\n`
      + `   d'environnement ne peut l'autoriser. Si ce refus est une erreur,\n`
      + `   c'est le contenu de la base qu'il faut examiner, pas la garde.`,
    );
  }

  if (env.verdict === 'ambigu') {
    // DEUX moitiés, et il faut les deux. L'intention dit « je sais ce que je
    // fais » ; l'habilitation dit « sur cette base-là ». La première est une
    // chaîne écrite dans ce fichier, donc connue de quiconque lit le dépôt :
    // elle n'autorise rien seule. La seconde désigne une base précise et
    // demande soit les droits de propriétaire, soit une déclaration nominative
    // hors du dépôt.
    const intention = process.env.MAINTRIX_DEMO_FORCER === 'oui-je-sais-ce-que-je-fais';

    if (!intention || !env.habilitation.recevable) {
      const manques = [
        intention ? null : "l'intention : MAINTRIX_DEMO_FORCER n'est pas posé",
        env.habilitation.recevable ? null : `l'habilitation de la base : ${env.habilitation.detail}`,
      ].filter(Boolean) as string[];
      const base = env.nomBase || 'ma_base';

      throw new Error(
        `REFUS : environnement indéterminé — l'inconnu ne vaut pas permission.\n${entete}\n`
        + `   Signaux non concluants : ${env.motif}\n\n`
        + `   Procédure autorisée en développement et en test :\n`
        + `     • nommez la base avec un marqueur explicite — maintrix_test,\n`
        + `       maintrix_dev, maintrix_local — et servez-la depuis localhost\n`
        + `       ou une adresse de réseau privé ;\n`
        + `     • ou, si votre poste impose une configuration atypique, forcez.\n\n`
        + `   Le forçage demande DEUX choses. Il en manque ${manques.length} :\n`
        + manques.map((m) => `     ✗ ${m}\n`).join('')
        + `\n   1. L'INTENTION, dans l'environnement du processus :\n`
        + `        MAINTRIX_DEMO_FORCER=oui-je-sais-ce-que-je-fais\n\n`
        + `   2. L'HABILITATION DE CETTE BASE, par l'un de ces deux moyens :\n`
        + `        COMMENT ON DATABASE ${base} IS '${MARQUEUR_BASE}';\n`
        + `      ou, si vous n'êtes pas propriétaire de la base :\n`
        + `        MAINTRIX_DEMO_BASES_AUTORISEES=${base}\n\n`
        + `   Pourquoi les deux : la chaîne de forçage est écrite dans ce\n`
        + `   fichier, donc publique. Une opération qui supprime des\n`
        + `   organisations entières ne peut pas reposer sur un secret que\n`
        + `   tout le dépôt connaît. L'habilitation, elle, désigne UNE base\n`
        + `   précise et ne s'obtient pas par hasard.\n\n`
        + `   Ce forçage ne lève que l'ambiguïté. Il reste SANS EFFET sur une\n`
        + `   base contenant de vraies organisations.`,
      );
    }

    // Accepté : on écrit POURQUOI dans la trace. Un journal qui ne garde que
    // le résultat ne permet pas de savoir, trois mois plus tard, sur quelle
    // habilitation l'opération est passée.
    const parQuoi = env.habilitation.moyen === 'marqueur'
      ? 'marqueur posé sur la base'
      : 'liste MAINTRIX_DEMO_BASES_AUTORISEES';
    console.log(
      `\n   ⚠ Forçage accepté — l'ambiguïté est levée, pas un signal de production.\n`
      + `     Intention    : MAINTRIX_DEMO_FORCER\n`
      + `     Habilitation : ${parQuoi} — ${env.habilitation.detail}\n`,
    );
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL absent.');

  const retirer = process.argv.includes('--retirer');
  const desactiver = process.argv.includes('--desactiver');

  // Avant toute connexion et toute écriture. Un script qui écrit d'abord et
  // découvre ensuite que son jeu est inexploitable laisse derrière lui une
  // organisation à moitié remplie, qu'il faut retirer à la main.
  if (!retirer) refuserMotDePasseImpose();

  if (!retirer) {
    const { SORTIES_MINIMALES } = await import('@shared/stock');
    verifierSeuils(SORTIES_MINIMALES);
  }

  // Import tardif : db.ts lit DATABASE_URL au chargement du module.
  const { db, pool } = await import('../server/db');
  const {
    tenants, userProfiles, equipmentRegistry, workOrders, spareParts,
    stockMovements, preventiveMaintenancePlans, iotSensorData, alertsNotifications,
    // Utilisées uniquement par `--retirer` : elles référencent les équipements
    // sans porter de `tenant_id`, donc la cascade ne les atteint pas.
    iotDevices, maintenanceReports, smartNotifications, automatedSymptomDetection,
    // ── Lot 2 : les onze domaines que le jeu initial laissait vides ──
    fmeaAnalyses, rcaAnalyses, budgetPlans, oeeRecords, calibrationRecords,
    permitToWork, suppliers, assetLifecycle, smmDocuments,
    knowledgeHubDocuments, kpiMetrics,
  } = await import('@shared/schema');

  try {
    // ═══════════════════════════════════════════════════════════════
    // GARDE D'ENVIRONNEMENT — avant toute écriture ET toute suppression
    // ═══════════════════════════════════════════════════════════════
    // Elle interroge la base, donc elle ne peut pas précéder la connexion :
    // elle précède en revanche TOUT le reste, y compris `--retirer`. C'est
    // l'ordre qui compte — une garde placée après la suppression ne garde
    // rien. Si elle lève, `finally` ferme le pool et rien n'a été touché.
    appliquerVerdict(
      await examinerEnvironnement(url, db, tenants, equipmentRegistry),
      retirer ? 'retirer' : 'charger',
    );

    // ── Désactivation : couper l'accès sans rien détruire ───────────
    //
    // Entre « le jeu est chargé et quiconque connaît un secret peut entrer »
    // et « tout est effacé », il manquait un cran. Une démonstration terminée
    // n'appelle pas forcément la destruction des données — on peut vouloir
    // les reprendre demain — mais elle appelle la fermeture des accès.
    //
    // On ne touche qu'aux comptes de l'organisation marquée, et on ne
    // supprime rien : les mots de passe sont remplacés par une empreinte
    // inutilisable, et les comptes désactivés. Recharger les rouvrira avec de
    // nouveaux secrets.
    if (desactiver) {
      const [locataireADesactiver] = await db.select().from(tenants)
        .where(eq(tenants.id, TENANT_DEMO)).limit(1);
      if (!locataireADesactiver) {
        console.log('   Aucune organisation de démonstration : rien à désactiver.');
        return;
      }
      if (!locataireADesactiver.name?.includes(MARQUEUR)) {
        throw new Error(
          `L'organisation ${TENANT_DEMO} ne porte pas le marqueur ${MARQUEUR} — `
          + `refus de toucher à des comptes dont ce script n'est pas l'auteur.`,
        );
      }
      // Empreinte d'un secret aléatoire jamais révélé : aucun mot de passe ne
      // peut y correspondre, et la colonne reste conforme à son format.
      const inutilisable = await bcrypt.hash(secretAleatoire(), 10);
      const r = await db.execute(sql`
        UPDATE user_profiles
        SET is_active = false, password = ${inutilisable}
        WHERE tenant_id = ${TENANT_DEMO}
      `);
      await db.execute(sql`UPDATE tenants SET is_active = false WHERE id = ${TENANT_DEMO}`);
      // Les secrets viennent d'être rendus inutilisables : un dépôt encore sur
      // le disque ne donnerait plus accès à rien, il traînerait seulement en
      // clair. On l'écarte avec les accès qu'il ouvrait.
      effacerLeDepot();
      console.log(
        `   Comptes de démonstration désactivés (${(r as { rowCount?: number }).rowCount ?? '?'} compte(s)).\n`
        + `   Dépôt des secrets effacé : ils n'ouvraient plus rien.\n`
        + `   Les données sont intactes. « npm run demo:charger » rouvrira l'accès\n`
        + `   avec de nouveaux secrets ; « npm run demo:retirer » effacera tout.`,
      );
      return;
    }

    if (retirer) {
      await effacer(db, {
        tenants, userProfiles, equipmentRegistry, workOrders, spareParts,
        stockMovements, preventiveMaintenancePlans, iotSensorData, alertsNotifications,
        iotDevices, maintenanceReports, smartNotifications, automatedSymptomDetection,
        fmeaAnalyses, rcaAnalyses, budgetPlans, oeeRecords, calibrationRecords,
        permitToWork, suppliers, assetLifecycle, smmDocuments,
        knowledgeHubDocuments, kpiMetrics,
      });
      // Les comptes n'existent plus : leurs secrets n'ouvrent rien.
      effacerLeDepot();
      return;
    }

    // ── Garde-fou : ne pas écraser des données qu'on n'a pas posées ──
    const [locataire] = await db.select().from(tenants).where(eq(tenants.id, TENANT_DEMO)).limit(1);
    if (locataire && !locataire.name?.includes(MARQUEUR)) {
      throw new Error(
        `L'organisation ${TENANT_DEMO} existe déjà et ne porte pas le marqueur ${MARQUEUR}.\n`
        + `Elle n'a pas été créée par ce script : il s'arrête plutôt que d'écrire dedans.`,
      );
    }

    // ── Canal des secrets : établi AVANT la première écriture ───────
    //
    // Ici, et pas plus tard : établir le canal après le chargement
    // laisserait, en cas d'échec de la protection, quatre comptes ouverts
    // dont personne ne connaîtrait les secrets. Ici, et pas plus tôt non
    // plus : la garde d'environnement et le garde-fou du marqueur sont
    // passés, donc ce chargement va bien avoir lieu et le fichier ne restera
    // pas vide sur le disque pour rien.
    //
    // Si `preparerCanal` lève, rien n'a encore été écrit ni effacé — le
    // retrait de rechargement ci-dessous n'a pas eu lieu.
    const canal = preparerCanal();
    if (canal.avertissement) console.log(canal.avertissement);

    // ── Rechargement : retirer d'abord notre propre jeu ─────────────
    //
    // Sans cela, un second `demo:charger` mourait sur
    // « duplicate key value violates unique constraint
    //   equipment_registry_equipment_id_unique » — les repères d'équipement
    // sont figés, donc le même jeu ne peut pas être posé deux fois. Le script
    // se présentait pourtant comme rejouable, et il laissait derrière lui une
    // organisation à moitié remplie : les comptes créés, le parc non.
    //
    // Recharger revient donc à retirer puis reposer. C'est sans danger pour
    // qui que ce soit d'autre : `effacer()` ne touche QUE l'organisation
    // portant le marqueur, et le garde-fou ci-dessus vient de vérifier que
    // c'est bien la nôtre.
    if (locataire) {
      console.log('── Jeu déjà présent : retrait avant rechargement ──');
      await effacer(db, {
        tenants, userProfiles, equipmentRegistry, workOrders, spareParts,
        stockMovements, preventiveMaintenancePlans, iotSensorData, alertsNotifications,
        iotDevices, maintenanceReports, smartNotifications, automatedSymptomDetection,
        fmeaAnalyses, rcaAnalyses, budgetPlans, oeeRecords, calibrationRecords,
        permitToWork, suppliers, assetLifecycle, smmDocuments,
        knowledgeHubDocuments, kpiMetrics,
      });
    }

    console.log('── Organisation de démonstration ──');
    await db.insert(tenants).values({
      id: TENANT_DEMO,
      name: `Usine Verrières ${MARQUEUR}`,
      domain: DOMAINE_DEMO,
      plan: 'enterprise',
      isActive: true,
      maxUsers: 999999,
      contactEmail: `contact@${DOMAINE_DEMO}`,
      licenseType: 'enterprise_l',
      licensedUsers: 50,
      licenseStatus: 'active',
      platformEdition: 'complete',
    }).onConflictDoNothing();

    // Un locataire créé sans dates d'essai est « expired » au sens de
    // getLicenseStatus() — le piège déjà rencontré en F08. Inoffensif tant que
    // le contrôle de licence reste inerte, fatal le jour où il sera rétabli,
    // et ce jour-là une démonstration qui refuse la connexion serait le pire
    // moment pour s'en apercevoir. Mise à jour séparée de l'insertion, parce
    // que `onConflictDoNothing` ne corrigerait pas un locataire déjà présent.
    await db.execute(sql`
      UPDATE tenants
      SET trial_start_date = NOW(),
          trial_end_date   = NOW() + INTERVAL '365 days',
          license_status   = 'active',
          is_active        = true
      WHERE id = ${TENANT_DEMO}
    `);

    // Un secret TIRÉ POUR CHAQUE COMPTE, et jamais le même : obtenir celui du
    // technicien ne doit pas donner celui de la direction.
    const COMPTES = [
      { email: `direction@${DOMAINE_DEMO}`, username: 'demo_direction', role: 'owner', prenom: 'Hélène', nom: 'Daumier', libelle: 'direction (accès le plus large)' },
      { email: `responsable@${DOMAINE_DEMO}`, username: 'demo_responsable', role: 'maintenance_manager', prenom: 'Claire', nom: 'Vasseur', libelle: 'responsable maintenance' },
      { email: `technicien@${DOMAINE_DEMO}`, username: 'demo_technicien', role: 'technician', prenom: 'Samir', nom: 'Benali', libelle: 'technicien' },
      { email: `planificateur@${DOMAINE_DEMO}`, username: 'demo_planificateur', role: 'planner', prenom: 'Léa', nom: 'Moreau', libelle: 'planificateur' },
    ].map((c) => ({ ...c, secret: secretAleatoire() }));

    for (const c of COMPTES) {
      const empreinte = await bcrypt.hash(c.secret, 10);
      await db.insert(userProfiles).values({
        tenantId: TENANT_DEMO, username: c.username, email: c.email, password: empreinte,
        firstName: c.prenom, lastName: c.nom, role: c.role, isActive: true,
        mustChangePassword: false, isDefaultCredentials: false,
      }).onConflictDoNothing();

      // Même raison que pour le locataire : sur une base déjà chargée,
      // l'insertion ne fait rien, et un compte resté marqué
      // `mustChangePassword` renvoie l'écran de changement de mot de passe au
      // lieu du tableau de bord. Une capture d'écran ne pardonne pas cela.
      await db.execute(sql`
        UPDATE user_profiles
        SET password               = ${empreinte},
            is_active              = true,
            must_change_password   = false,
            is_default_credentials = false,
            mfa_enabled            = false,
            failed_login_attempts  = 0,
            account_locked_until   = NULL,
            tenant_id              = ${TENANT_DEMO},
            role                   = ${c.role}
        WHERE email = ${c.email}
      `);
    }
    // Les secrets quittent le processus par le canal protégé, et par lui
    // seul. Rien de ce qui suit ne les écrit sur la sortie standard.
    deposerLesSecrets(canal, TENANT_DEMO, COMPTES);
    console.log(`   ${COMPTES.length} comptes — secrets déposés hors de cette sortie`);

    // ── Équipements ───────────────────────────────────────────────
    const idsParCode = new Map<string, number>();
    for (const e of PARC) {
      const [ligne] = await db.insert(equipmentRegistry).values({
        tenantId: TENANT_DEMO,
        equipmentId: repere(e.code),
        equipmentName: e.nom,
        equipmentType: e.type,
        manufacturer: e.fabricant,
        model: e.modele,
        serialNumber: `SN-${repere(e.code)}-${entier(10000, 99999)}`,
        location: e.zone,
        zone: e.zone,
        sector: 'Site Verrières',
        installationDate: ilYA(entier(400, 2600)),
        criticalityLevel: e.criticite,
        operationalState: e.etat,
      }).returning({ id: equipmentRegistry.id });
      if (ligne) idsParCode.set(e.code, ligne.id);
    }
    console.log(`── Parc ──\n   ${idsParCode.size} équipements`);

    // ── Ordres de travail sur 14 mois ─────────────────────────────
    //
    // Les dates de début ET de fin sont renseignées : sans elles, MTBF, MTTR
    // et durée moyenne restent « non calculables », et les écrans affichent
    // « — ». C'est précisément ce qu'on veut éviter pour une capture.
    let numero = 1;
    let totalOT = 0;

    for (const e of PARC) {
      const idEq = idsParCode.get(e.code);
      if (!idEq) continue;

      const nbCorrectifs = Math.max(1, Math.round((e.tauxPanne * JOURS_HISTORIQUE) / 365));
      const correctifs = CORRECTIFS[e.type] ?? CORRECTIFS.pompe;
      const preventifs = PREVENTIFS[e.type] ?? PREVENTIFS.pompe;

      // Correctifs, répartis sur la période avec un peu d'irrégularité.
      for (let i = 0; i < nbCorrectifs; i += 1) {
        const modele = parmi(correctifs);
        const jours = JOURS_HISTORIQUE - (i + alea() * 0.7) * (JOURS_HISTORIQUE / nbCorrectifs);
        const debut = ilYA(jours);
        const duree = Math.round(modele.duree * entre(0.75, 1.4));
        const fin = new Date(debut.getTime() + duree * 60_000);
        const urgence = e.criticite === 'critical' && alea() < 0.3;

        await db.insert(workOrders).values({
          tenantId: TENANT_DEMO,
          orderNumber: `OT-${SITE}-2026-${String(numero++).padStart(4, '0')}`,
          equipmentId: idEq,
          orderType: urgence ? 'emergency' : 'corrective',
          title: modele.titre,
          description: `${modele.titre} sur ${e.nom} (${repere(e.code)}).`,
          priority: urgence ? 'urgent' : (e.criticite === 'critical' ? 'high' : 'medium'),
          status: 'completed',
          actualStart: debut,
          actualEnd: fin,
          scheduledStart: debut,
          scheduledEnd: fin,
          actualDuration: duree,
          laborCost: String(Math.round(duree * 0.85)),
          materialCost: String(modele.cout),
          cost: String(Math.round(duree * 0.85 + modele.cout)),
          completionNotes: 'Intervention réalisée, équipement remis en service.',
        });
        totalOT += 1;
      }

      // Préventifs : réguliers, majoritaires — c'est le signe d'un service
      // de maintenance qui fonctionne, et la part préventive est un
      // indicateur affiché.
      const periode = 60;
      for (let j = JOURS_HISTORIQUE; j > 0; j -= periode) {
        const modele = parmi(preventifs);
        const debut = ilYA(j + entre(-4, 4));
        const duree = Math.round(modele.duree * entre(0.85, 1.2));
        const fin = new Date(debut.getTime() + duree * 60_000);
        // Un seul tirage, réutilisé : deux appels donneraient deux valeurs
        // différentes et `cost` cesserait de valoir main-d'œuvre + matière.
        const matiere = entier(20, 180);
        const mainDoeuvre = Math.round(duree * 0.85);

        await db.insert(workOrders).values({
          tenantId: TENANT_DEMO,
          orderNumber: `OT-${SITE}-2026-${String(numero++).padStart(4, '0')}`,
          equipmentId: idEq,
          orderType: 'preventive',
          title: modele.titre,
          description: `Maintenance préventive planifiée — ${e.nom} (${repere(e.code)}).`,
          priority: 'medium',
          status: 'completed',
          actualStart: debut,
          actualEnd: fin,
          scheduledStart: debut,
          scheduledEnd: fin,
          actualDuration: duree,
          laborCost: String(mainDoeuvre),
          materialCost: String(matiere),
          cost: String(mainDoeuvre + matiere),
          completionNotes: 'Gamme exécutée, aucun écart relevé.',
        });
        totalOT += 1;
      }
    }

    // Quelques interventions en cours et en attente : un tableau de bord
    // entièrement « terminé » ne ressemble à aucun service réel.
    const enCours = [
      { code: 'PRS-002', titre: 'Remplacement kit joints vérin principal', type: 'corrective', statut: 'in_progress', priorite: 'high' },
      { code: 'MOT-203', titre: 'Analyse vibratoire approfondie palier avant', type: 'predictive', statut: 'in_progress', priorite: 'high' },
      { code: 'CVY-101', titre: 'Contrôle alignement et tension bande', type: 'preventive', statut: 'pending', priorite: 'medium' },
      { code: 'GRP-001', titre: 'Recherche de fuite circuit frigorifique', type: 'corrective', statut: 'pending', priorite: 'high' },
      { code: 'GEN-001', titre: 'Remise en service après révision', type: 'corrective', statut: 'pending', priorite: 'urgent' },
    ];
    for (const o of enCours) {
      const idEq = idsParCode.get(o.code);
      if (!idEq) continue;
      const debut = ilYA(entre(1, 9));
      await db.insert(workOrders).values({
        tenantId: TENANT_DEMO,
        orderNumber: `OT-${SITE}-2026-${String(numero++).padStart(4, '0')}`,
        equipmentId: idEq,
        orderType: o.type,
        title: o.titre,
        description: `${o.titre}.`,
        priority: o.priorite,
        status: o.statut,
        scheduledStart: debut,
        scheduledEnd: new Date(debut.getTime() + 4 * 3600_000),
        actualStart: o.statut === 'in_progress' ? debut : null,
        estimatedDuration: 240,
      });
      totalOT += 1;
    }
    console.log(`── Interventions ──\n   ${totalOT} ordres de travail sur ${JOURS_HISTORIQUE} jours`);

    // ── Relevés de capteurs ───────────────────────────────────────
    //
    // 90 jours à 4 relevés par jour. `MOT-203` porte une dérive lente et
    // continue : c'est elle qui donne à l'IMCA et au RUL stochastique de quoi
    // produire autre chose qu'une absence.
    let releves = 0;
    const lot: any[] = [];

    for (const e of PARC) {
      const idEq = idsParCode.get(e.code);
      if (!idEq) continue;
      const derive = e.code === CODE_DERIVE;

      for (const capteur of e.capteurs) {
        for (let j = JOURS_CAPTEURS; j >= 0; j -= 1) {
          for (let k = 0; k < RELEVES_PAR_JOUR; k += 1) {
            const avancement = 1 - j / JOURS_CAPTEURS;
            // La dérive ne touche que vibration et température — les deux
            // grandeurs qui signent une dégradation de roulement.
            const facteurDerive = derive && (capteur.type === 'vibration' || capteur.type === 'temperature')
              ? 1 + 0.45 * avancement ** 1.6
              : 1;
            const valeur = capteur.nominal * facteurDerive + (alea() - 0.5) * capteur.dispersion * 2;

            lot.push({
              // `iot_sensor_data` a reçu une colonne `tenant_id` NOT NULL
              // (migration 0021) après l'écriture de ce script : sans elle,
              // l'insertion échoue. Le locataire est celui de l'organisation de
              // démonstration, le seul que ce script ait le droit de toucher.
              tenantId: TENANT_DEMO,
              equipmentId: idEq,
              sensorType: capteur.type,
              sensorId: `${repere(e.code)}-${capteur.type.toUpperCase()}`,
              value: String(Math.round(valeur * 100) / 100),
              unit: capteur.unite,
              timestamp: new Date(maintenant - j * JOUR - k * 6 * 3600_000),
              quality: 'good',
              alarmState: 'normal',
            });
            releves += 1;
          }
        }
      }
    }
    for (let i = 0; i < lot.length; i += 500) {
      await db.insert(iotSensorData).values(lot.slice(i, i + 500));
    }
    console.log(`── Capteurs ──\n   ${releves} relevés sur ${JOURS_CAPTEURS} jours`);

    // ── Magasin et consommations ──────────────────────────────────
    let mouvements = 0;
    for (const p of PIECES) {
      const [piece] = await db.insert(spareParts).values({
        tenantId: TENANT_DEMO,
        partNumber: `${SITE}-${p.ref}`,
        partName: p.nom,
        description: `${p.nom} — référence magasin ${SITE}-${p.ref}.`,
        category: p.cat,
        manufacturer: parmi(['Atlas Copco', 'SKF', 'Grundfos', 'Schneider', 'Parker']),
        supplier: parmi(['Rexel', 'Legallais', 'RS Components', 'Brammer']),
        unitPrice: String(p.prix),
        currency: 'EUR',
        currentStock: p.stock,
        minStock: p.mini,
        maxStock: p.mini * 6,
        reorderPoint: p.mini * 2,
        leadTime: p.delai,
        location: `Magasin ${parmi(['A', 'B', 'C'])}-${entier(1, 24)}`,
        isActive: true,
      }).returning({ id: spareParts.id });
      if (!piece) continue;

      // Les sorties alimentent le calcul du point de commande suggéré, qui
      // exige au moins six mouvements et une variabilité réelle.
      const nb = p.conso === 'reguliere' ? entier(12, 20) : entier(6, 9);
      let stock = p.stock + nb * 2;
      for (let i = 0; i < nb; i += 1) {
        const quantite = p.conso === 'reguliere' ? entier(1, 3) : entier(1, 2);
        const avant = stock;
        stock -= quantite;
        await db.insert(stockMovements).values({
          tenantId: TENANT_DEMO,
          sparePartId: piece.id,
          movementType: 'OUT',
          quantity: quantite,
          previousStock: avant,
          newStock: stock,
          reason: 'Consommation sur intervention',
          unitCost: String(p.prix),
          totalCost: String(p.prix * quantite),
          createdAt: ilYA(entre(5, 180)),
        });
        mouvements += 1;
      }
    }
    console.log(`── Magasin ──\n   ${PIECES.length} références, ${mouvements} mouvements`);

    // ── Plans de maintenance ──────────────────────────────────────
    const FREQUENCES = [
      { f: 'monthly', v: 1 }, { f: 'quarterly', v: 1 },
      { f: 'weekly', v: 2 }, { f: 'annually', v: 1 },
    ];
    let plans = 0;
    for (const e of PARC) {
      const idEq = idsParCode.get(e.code);
      if (!idEq) continue;
      const gammes = PREVENTIFS[e.type] ?? PREVENTIFS.pompe;
      const freq = parmi(FREQUENCES);

      await db.insert(preventiveMaintenancePlans).values({
        tenantId: TENANT_DEMO,
        planName: `Plan ${e.type} — ${e.code}`,
        equipmentType: e.type,
        equipmentIds: [idEq],
        frequency: freq.f,
        frequencyValue: freq.v,
        tasks: gammes.map(g => ({ libelle: g.titre, duree: g.duree })),
        estimatedDuration: gammes.reduce((s, g) => s + g.duree, 0),
        requiredSkills: ['mécanique', 'électrotechnique'],
        isActive: true,
        lastExecuted: ilYA(entre(5, 70)),
        // Échéances échelonnées : certaines dépassées, d'autres à venir.
        nextDue: new Date(maintenant + entre(-20, 45) * JOUR),
      });
      plans += 1;
    }
    console.log(`── Préventif ──\n   ${plans} plans`);

    // ── Alertes ───────────────────────────────────────────────────
    const ALERTES = [
      { code: 'MOT-203', type: 'anomaly', sev: 'high', titre: 'Dérive vibratoire palier avant', msg: 'Niveau vibratoire en hausse continue depuis 3 semaines (2,4 → 3,4 mm/s).', statut: 'active', seuil: '3.0', valeur: '3.4' },
      { code: 'CMP-001', type: 'threshold', sev: 'medium', titre: 'Température de refoulement élevée', msg: 'Dépassement ponctuel du seuil haut sur deux cycles.', statut: 'acknowledged', seuil: '75', valeur: '77.2' },
      { code: 'PRS-002', type: 'maintenance_due', sev: 'high', titre: 'Immobilisation pour maintenance', msg: 'Presse à l\'arrêt — remplacement kit joints en cours.', statut: 'active', seuil: null, valeur: null },
      { code: 'GRP-001', type: 'anomaly', sev: 'medium', titre: 'Pression condenseur instable', msg: 'Oscillations supérieures à la normale sur 48 h.', statut: 'active', seuil: '15', valeur: '15.8' },
      { code: 'CHD-001', type: 'threshold', sev: 'low', titre: 'Pression vapeur en limite basse', msg: 'Retour à la normale après réglage brûleur.', statut: 'resolved', seuil: '8.5', valeur: '8.4' },
      { code: 'GEN-001', type: 'maintenance_due', sev: 'critical', titre: 'Groupe de secours indisponible', msg: 'Hors service depuis la révision — remise en service planifiée.', statut: 'active', seuil: null, valeur: null },
    ];
    for (const a of ALERTES) {
      const idEq = idsParCode.get(a.code);
      if (!idEq) continue;
      const cree = ilYA(entre(1, 25));
      await db.insert(alertsNotifications).values({
        tenantId: TENANT_DEMO,
        alertType: a.type,
        equipmentId: idEq,
        severity: a.sev,
        title: a.titre,
        message: a.msg,
        status: a.statut,
        triggerValue: a.valeur,
        thresholdValue: a.seuil,
        createdAt: cree,
        resolvedAt: a.statut === 'resolved' ? new Date(cree.getTime() + 2 * JOUR) : null,
      });
    }
    console.log(`── Alertes ──\n   ${ALERTES.length} alertes`);

    // ═══════════════════════════════════════════════════════════════
    // LOT 2 — LES ONZE DOMAINES QUE LE JEU INITIAL LAISSAIT VIDES
    // ═══════════════════════════════════════════════════════════════
    //
    // HYPOTHÈSES RETENUES POUR CONSTRUIRE CES DONNÉES, et pourquoi.
    //
    // 1. RIEN N'EST INVENTÉ EN BOUT DE CHAÎNE. Comme pour le jeu initial, on
    //    fournit la MATIÈRE et on laisse Maintrix calculer : des relevés par
    //    poste, pas un taux d'OEE ; des lignes budgétaires engagées, pas un
    //    taux de consommation. Les seules valeurs calculées écrites ici sont
    //    celles que le schéma stocke par construction — disponibilité,
    //    performance, qualité et OEE d'un relevé — et elles le sont à partir
    //    des grandeurs brutes de la même ligne, pas tirées au hasard.
    //
    // 2. AUCUN RÉSULTAT DE DIAGNOSTIC IA N'EST PRÉSENTÉ COMME VALIDÉ. Les RCA
    //    et les AMDEC posées ici sont des analyses HUMAINES, avec leur méthode
    //    (5 pourquoi, Ishikawa) et leur raisonnement visible. Aucune ne
    //    prétend sortir d'un modèle, aucune n'est marquée comme vérifiée
    //    expérimentalement. Les cotations gravité/occurrence/détection sont
    //    des jugements d'atelier, ce qu'elles sont dans la réalité.
    //
    // 3. TOUT SE RATTACHE AU PARC EXISTANT. Chaque enregistrement part d'un
    //    fait déjà présent dans le jeu : la dérive vibratoire de MOT-203, la
    //    réfection de vérin de PRS-002, le groupe électrogène GEN-001 à
    //    l'arrêt. On ne crée pas un onzième îlot de données sans lien.
    //
    // 4. LES FOURNISSEURS SONT LES FABRICANTS DU PARC. Atlas Copco, Grundfos
    //    et Siemens figurent déjà comme constructeurs des équipements : en
    //    faire les fournisseurs référencés rend l'ensemble traçable d'un écran
    //    à l'autre, au lieu de peupler deux listes étrangères l'une à l'autre.
    //
    // 5. LES DATES SONT RELATIVES À L'EXÉCUTION, jamais fixes : un jeu chargé
    //    dans six mois doit rester crédible, et les écrans qui filtrent sur
    //    « ce mois » ou « cet exercice » doivent continuer de montrer quelque
    //    chose.

    const idDe = (code: string) => idsParCode.get(code);
    const anneeCourante = new Date(maintenant).getFullYear();
    const reference = (prefixe: string, n: number) =>
      `${prefixe}-${anneeCourante}-${String(n).padStart(4, '0')}`;

    // ── Fournisseurs ───────────────────────────────────────────────
    // TOUS les constructeurs du parc y figurent, pas seulement quelques-uns :
    // une première version n'en couvrait que trois, et seuls 4 équipements sur
    // 14 pouvaient alors être reliés à leur fournisseur. La traçabilité d'un
    // écran à l'autre valait mieux que l'économie de sept lignes.
    const FOURNISSEURS = [
      { code: 'FRN-0001', nom: 'Atlas Copco France', type: 'constructeur', contact: 'M. Lemoine', courriel: 'contact@atlascopco.demo.invalid', note: 4 },
      { code: 'FRN-0002', nom: 'Grundfos Distribution', type: 'constructeur', contact: 'Mme Ferrand', courriel: 'contact@grundfos.demo.invalid', note: 4 },
      { code: 'FRN-0003', nom: 'Siemens Industrie', type: 'constructeur', contact: 'M. Ravel', courriel: 'contact@siemens.demo.invalid', note: 5 },
      { code: 'FRN-0004', nom: 'Interroll Convoyage', type: 'constructeur', contact: 'M. Baumann', courriel: 'contact@interroll.demo.invalid', note: 4 },
      { code: 'FRN-0005', nom: 'Schneider Electric', type: 'constructeur', contact: 'Mme Tissot', courriel: 'contact@schneider.demo.invalid', note: 5 },
      { code: 'FRN-0006', nom: 'KUKA Robotique', type: 'constructeur', contact: 'M. Weiss', courriel: 'contact@kuka.demo.invalid', note: 4 },
      { code: 'FRN-0007', nom: 'Systemair Ventilation', type: 'constructeur', contact: 'Mme Olsson', courriel: 'contact@systemair.demo.invalid', note: 3 },
      { code: 'FRN-0008', nom: 'Bosch Rexroth', type: 'constructeur', contact: 'M. Keller', courriel: 'contact@rexroth.demo.invalid', note: 4 },
      { code: 'FRN-0009', nom: 'Caterpillar Énergie', type: 'constructeur', contact: 'M. Dubois', courriel: 'contact@cat.demo.invalid', note: 4 },
      { code: 'FRN-0010', nom: 'Schuler Presses', type: 'constructeur', contact: 'Mme Brandt', courriel: 'contact@schuler.demo.invalid', note: 3 },
      { code: 'FRN-0011', nom: 'ProMinent Dosage', type: 'constructeur', contact: 'M. Hartmann', courriel: 'contact@prominent.demo.invalid', note: 4 },
      { code: 'FRN-0012', nom: 'Carrier Froid Industriel', type: 'constructeur', contact: 'Mme Reyes', courriel: 'contact@carrier.demo.invalid', note: 3 },
      { code: 'FRN-0013', nom: 'Roulements Sud-Ouest', type: 'distributeur', contact: 'M. Caillaux', courriel: 'ventes@rso.demo.invalid', note: 3 },
      { code: 'FRN-0014', nom: 'MétroLab Étalonnages', type: 'prestataire', contact: 'Mme Nkomo', courriel: 'labo@metrolab.demo.invalid', note: 5 },
    ];
    await db.insert(suppliers).values(FOURNISSEURS.map((f) => ({
      tenantId: TENANT_DEMO,
      supplierCode: f.code,
      companyName: f.nom,
      supplierType: f.type,
      contactPerson: f.contact,
      email: f.courriel,
      rating: f.note,
      isActive: true,
    })));
    console.log(`── Fournisseurs ──\n   ${FOURNISSEURS.length} référencés`);

    // ── Cycle de vie des actifs ────────────────────────────────────
    // Un actif par équipement, daté de sa mise en service. C'est l'âge qui
    // détermine l'étape du cycle : sans cela l'écran n'aurait rien à montrer
    // qu'une liste plate.
    const AGES = [12, 9, 7, 5, 11, 14, 16, 6, 3, 18, 8, 4, 10, 19];
    const DUREE_VIE = 20;
    const ACTIFS = PARC.map((e, i) => {
      const ageAns = AGES[i] ?? 8;
      const miseEnService = new Date(maintenant - ageAns * 365 * JOUR);
      const restant = DUREE_VIE - ageAns;
      const etape = restant <= 2 ? 'disposal_planned'
        : restant <= 5 ? 'late_life'
        : ageAns <= 3 ? 'commissioning'
        : 'in_service';
      return {
        tenantId: TENANT_DEMO,
        assetTag: `ACT-${e.code}`,
        name: e.nom,
        category: e.type,
        manufacturer: e.fabricant,
        model: e.modele,
        equipmentId: idDe(e.code),
        lifecycleStage: etape,
        commissioningDate: miseEnService,
        purchaseDate: new Date(miseEnService.getTime() - 90 * JOUR),
        plannedReplacementDate: new Date(miseEnService.getTime() + DUREE_VIE * 365 * JOUR),
        usefulLifeYears: String(DUREE_VIE),
        location: e.zone,
      };
    });
    await db.insert(assetLifecycle).values(ACTIFS);
    console.log(`── Cycle de vie ──\n   ${ACTIFS.length} actifs, ${ACTIFS.filter((a) => a.lifecycleStage === 'disposal_planned').length} en fin de vie`);

    // ── Relevés OEE ────────────────────────────────────────────────
    // Trois équipements de production, deux postes par jour, huit semaines.
    // Les trois composantes sont CALCULÉES depuis les grandeurs brutes de la
    // ligne — temps d'arrêt, cadence, rebuts — jamais posées directement.
    const EQUIPEMENTS_OEE = ['CVY-101', 'PRS-002', 'ROB-011'];
    const relevesOee: Array<Record<string, unknown>> = [];
    for (const code of EQUIPEMENTS_OEE) {
      const idEq = idDe(code);
      const eq = PARC.find((e) => e.code === code);
      if (!idEq || !eq) continue;
      for (let j = 56; j >= 0; j -= 1) {
        for (const poste of ['matin', 'apres-midi']) {
          const tempsPlanifie = 480;
          // ⚠️ ORDRES DE GRANDEUR INDUSTRIELS, et c'est tout l'enjeu de ce
          // bloc. Une première version tirait des arrêts de 0 à 16 min sur un
          // poste de 480 : l'écran affichait 96 % d'OEE, « Classe mondiale »
          // sur les trois équipements et zéro critique. Invraisemblable — le
          // niveau dit « classe mondiale » est à 85 %, et une usine réelle
          // tourne entre 50 et 75 %. Montrer 96 % à un responsable de
          // maintenance décrédibilise la démonstration au lieu de la servir.
          //
          // Le modèle retenu, par poste :
          //   • 60 min d'arrêt de base — changements de série, réglages,
          //     nettoyages, pauses techniques — que toute ligne subit ;
          //   • un arrêt subi proportionnel au taux de panne de l'équipement.
          //     C'est le CONVOYEUR qui a le plus fort du trio (5,3 contre 2,9
          //     et 3,0), et le modèle doit suivre la donnée, pas l'inverse ;
          //   • l'immobilisation de la PRESSE sur les dix derniers jours. Elle
          //     est déclarée `etat: 'maintenance'` dans le parc, elle porte un
          //     ordre correctif « Remplacement kit joints vérin principal » en
          //     cours et une alerte « Immobilisation pour maintenance » active.
          //     Son OEE doit donc s'effondrer sur cette période : sans cela,
          //     l'écran OEE contredirait les trois autres écrans qui annoncent
          //     la machine à l'arrêt ;
          //   • une perte de cadence de 8 à 16 %, écart habituel entre cadence
          //     nominale et cadence réelle.
          const arretBase = 60;
          const arretSubi = Math.round(eq.tauxPanne * 8 * alea());
          const immobilisation = code === 'PRS-002' && j <= 10 ? 260 : 0;
          const arret = Math.min(tempsPlanifie - 40, arretBase + arretSubi + immobilisation);
          const perteCadence = Math.round(tempsPlanifie * (0.08 + 0.08 * alea()));
          const productionPlanifiee = 1200;
          const tempsUtile = tempsPlanifie - arret;
          const production = Math.round(
            productionPlanifiee * (tempsUtile / tempsPlanifie) * (1 - perteCadence / 480),
          );
          const rebuts = Math.round(production * (0.004 + 0.012 * alea()));

          const disponibilite = tempsUtile / tempsPlanifie;
          const performance = production / (productionPlanifiee * (tempsUtile / tempsPlanifie));
          const qualite = (production - rebuts) / production;

          relevesOee.push({
            tenantId: TENANT_DEMO,
            equipmentId: idEq,
            equipmentName: eq.nom,
            recordDate: new Date(maintenant - j * JOUR),
            shift: poste,
            plannedTime: String(tempsPlanifie),
            downtime: String(arret),
            speedLoss: String(perteCadence),
            plannedProduction: productionPlanifiee,
            actualProduction: production,
            defectiveUnits: rebuts,
            availability: disponibilite.toFixed(4),
            performance: performance.toFixed(4),
            quality: qualite.toFixed(4),
            oee: (disponibilite * performance * qualite).toFixed(4),
          });
        }
      }
    }
    for (let i = 0; i < relevesOee.length; i += 500) {
      await db.insert(oeeRecords).values(relevesOee.slice(i, i + 500) as never);
    }
    console.log(`── OEE ──\n   ${relevesOee.length} relevés sur ${EQUIPEMENTS_OEE.length} équipements de production`);

    // ── Calibrations ───────────────────────────────────────────────
    // Échéances volontairement étalées : l'écran doit montrer à la fois des
    // instruments à jour et des échéances proches, sinon il ne démontre rien.
    const INSTRUMENTS = [
      { code: 'MOT-203', nom: 'Accéléromètre palier avant', type: 'vibration', jours: -18, intervalle: 365 },
      { code: 'CHD-001', nom: 'Transmetteur pression vapeur', type: 'pression', jours: -40, intervalle: 365 },
      { code: 'PMP-014', nom: 'Débitmètre alimentation', type: 'debit', jours: -300, intervalle: 365 },
      { code: 'GRP-001', nom: 'Sonde température process', type: 'temperature', jours: -330, intervalle: 365 },
      { code: 'TRF-001', nom: 'Analyseur réseau 630 kVA', type: 'electrique', jours: -200, intervalle: 730 },
      { code: 'CMP-001', nom: 'Manomètre sortie compresseur', type: 'pression', jours: -95, intervalle: 365 },
    ];
    await db.insert(calibrationRecords).values(INSTRUMENTS.map((inst, i) => {
      const date = new Date(maintenant + inst.jours * JOUR);
      const eq = PARC.find((e) => e.code === inst.code);
      return {
        tenantId: TENANT_DEMO,
        calibrationNumber: reference('CAL', i + 1),
        instrumentName: inst.nom,
        instrumentTag: `INS-${inst.code}`,
        equipmentId: idDe(inst.code),
        equipmentName: eq?.nom,
        instrumentType: inst.type,
        calibrationDate: date,
        nextCalibrationDate: new Date(date.getTime() + inst.intervalle * JOUR),
        calibrationIntervalDays: inst.intervalle,
        externalLab: 'MétroLab Étalonnages',
        certificateNumber: `ML-${anneeCourante}-${1200 + i}`,
        location: eq?.zone,
      };
    }));
    console.log(`── Calibrations ──\n   ${INSTRUMENTS.length} instruments suivis`);

    // ── Permis de travail ──────────────────────────────────────────
    // Rattachés aux interventions en cours du jeu initial : la réfection du
    // vérin exige une consignation, la recherche de fuite du groupe froid un
    // permis d'espace confiné.
    const PERMIS = [
      { code: 'PRS-002', type: 'consignation', titre: 'Consignation hydraulique presse 200 t', risque: 'high', statut: 'active' },
      { code: 'GRP-001', type: 'espace_confine', titre: 'Intervention circuit frigorifique', risque: 'high', statut: 'pending_approval' },
      { code: 'CHD-001', type: 'point_chaud', titre: 'Soudure piquage vapeur', risque: 'critical', statut: 'closed' },
      { code: 'TRF-001', type: 'electrique', titre: 'Mesures sous tension 630 kVA', risque: 'critical', statut: 'closed' },
    ];
    await db.insert(permitToWork).values(PERMIS.map((p, i) => {
      const eq = PARC.find((e) => e.code === p.code);
      return {
        tenantId: TENANT_DEMO,
        permitNumber: reference('PTW', i + 1),
        type: p.type,
        title: p.titre,
        status: p.statut,
        riskLevel: p.risque,
        equipmentId: idDe(p.code),
        location: eq?.zone,
        description: `Travaux sur ${eq?.nom}.`,
        plannedStart: new Date(maintenant - (i + 1) * 2 * JOUR),
        plannedEnd: new Date(maintenant - (i + 1) * 2 * JOUR + 8 * 3600_000),
      };
    }));
    console.log(`── Permis de travail ──\n   ${PERMIS.length} permis, ${PERMIS.filter((p) => p.statut !== 'closed').length} en cours`);

    // ── Analyses de causes racines ─────────────────────────────────
    // ⚠️ Analyses HUMAINES, avec leur méthode et leur raisonnement visible.
    // Aucune ne sort d'un modèle, aucune n'est marquée comme validée
    // expérimentalement : ce serait faire dire à une démonstration ce que le
    // produit ne garantit pas.
    const RCA = [
      {
        code: 'MOT-203', titre: 'Dérive vibratoire du palier avant', methode: '5_whys', gravite: 'high', perte: 8400,
        enonce: "Le niveau vibratoire du palier avant est passé de 2,4 à 3,4 mm/s en trois semaines, sans changement de régime ni de charge.",
        pourquoi: [
          { question: "Pourquoi le niveau vibratoire augmente-t-il ?", reponse: "Jeu croissant dans le roulement côté accouplement." },
          { question: "Pourquoi ce jeu apparaît-il ?", reponse: "Écaillage débutant de la bague extérieure." },
          { question: "Pourquoi un écaillage à sept ans de service ?", reponse: "Graissage insuffisant sur les douze derniers mois." },
          { question: "Pourquoi le graissage a-t-il été insuffisant ?", reponse: "Le plan préventif prévoyait un graissage semestriel, sans spécifier la quantité." },
          { question: "Pourquoi la quantité n'était-elle pas spécifiée ?", reponse: "La gamme a été reprise du constructeur sans l'adapter au régime réel de la ligne 2." },
        ],
      },
      {
        code: 'PRS-002', titre: 'Fuite interne du vérin principal', methode: 'ishikawa', gravite: 'critical', perte: 23500,
        enonce: "Perte de pression de maintien sur le vérin principal, cadence réduite de 15 % pendant onze jours avant immobilisation.",
        pourquoi: null,
      },
      {
        code: 'GEN-001', titre: 'Refus de démarrage du groupe de secours', methode: '5_whys', gravite: 'critical', perte: 0,
        enonce: "Le groupe électrogène n'a pas démarré lors de l'essai mensuel en charge.",
        pourquoi: [
          { question: "Pourquoi le groupe n'a-t-il pas démarré ?", reponse: "Batterie de démarrage déchargée." },
          { question: "Pourquoi la batterie était-elle déchargée ?", reponse: "Chargeur de maintien hors service depuis une date inconnue." },
          { question: "Pourquoi la panne du chargeur est-elle passée inaperçue ?", reponse: "Aucun report d'alarme du chargeur vers la supervision." },
        ],
      },
    ];
    await db.insert(rcaAnalyses).values(RCA.map((r, i) => ({
      tenantId: TENANT_DEMO,
      rcaNumber: reference('RCA', i + 1),
      title: r.titre,
      description: r.enonce,
      methodology: r.methode,
      severity: r.gravite,
      equipmentId: idDe(r.code),
      failureDate: new Date(maintenant - (20 + i * 15) * JOUR),
      detectionDate: new Date(maintenant - (18 + i * 15) * JOUR),
      estimatedLoss: String(r.perte),
      currency: 'EUR',
      whyChain: r.pourquoi,
      status: i === 0 ? 'in_progress' : 'completed',
    })));
    console.log(`── Analyses RCA ──\n   ${RCA.length} analyses, méthodes 5 pourquoi et Ishikawa`);

    // ── AMDEC ──────────────────────────────────────────────────────
    // Gravité, occurrence et détection sont des COTATIONS d'atelier — c'est
    // leur nature. La criticité qui en découle est laissée au calcul de
    // l'application, on ne la pose pas.
    const FMEA = [
      {
        code: 'MOT-203', titre: 'AMDEC moteur convoyeur ligne 2', perimetre: 'Entraînement et transmission',
        lignes: [
          { composant: 'Roulement côté accouplement', mode: 'Écaillage de bague', effet: 'Arrêt de ligne', cause: 'Graissage insuffisant', gravite: 8, occurrence: 4, detection: 3 },
          { composant: 'Accouplement élastique', mode: "Rupture d'élastomère", effet: "Perte d'entraînement", cause: 'Désalignement résiduel', gravite: 7, occurrence: 3, detection: 4 },
          { composant: 'Bobinage stator', mode: 'Court-circuit entre spires', effet: 'Destruction moteur', cause: 'Surchauffe répétée', gravite: 9, occurrence: 2, detection: 5 },
        ],
      },
      {
        code: 'CHD-001', titre: 'AMDEC chaudière vapeur 4 t/h', perimetre: 'Production de vapeur',
        lignes: [
          { composant: 'Soupape de sûreté', mode: "Refus d'ouverture", effet: 'Surpression', cause: 'Entartrage du siège', gravite: 10, occurrence: 2, detection: 4 },
          { composant: 'Faisceau tubulaire', mode: 'Percement', effet: 'Arrêt chaufferie', cause: 'Corrosion côté eau', gravite: 9, occurrence: 3, detection: 6 },
        ],
      },
    ];
    await db.insert(fmeaAnalyses).values(FMEA.map((f, i) => ({
      tenantId: TENANT_DEMO,
      fmeaNumber: reference('FMEA', i + 1),
      title: f.titre,
      scope: f.perimetre,
      equipmentId: idDe(f.code),
      equipmentName: PARC.find((e) => e.code === f.code)?.nom,
      entries: f.lignes,
      status: 'approved',
      revision: 1,
    })));
    console.log(`── AMDEC ──\n   ${FMEA.length} analyses, ${FMEA.reduce((n, f) => n + f.lignes.length, 0)} modes de défaillance cotés`);

    // ── Budgets ────────────────────────────────────────────────────
    // Montants cohérents avec les interventions du jeu : le correctif
    // déborde, le préventif non. C'est le cas qui vaut d'être montré.
    const BUDGETS = [
      { titre: 'Maintenance corrective', service: 'Maintenance', alloue: 180000, depense: 164200, engage: 21800 },
      { titre: 'Maintenance préventive', service: 'Maintenance', alloue: 95000, depense: 61300, engage: 12400 },
      { titre: 'Pièces de rechange et magasin', service: 'Logistique', alloue: 120000, depense: 88700, engage: 15600 },
      { titre: 'Prestations extérieures et métrologie', service: 'Maintenance', alloue: 48000, depense: 29500, engage: 6200 },
    ];
    await db.insert(budgetPlans).values(BUDGETS.map((b, i) => ({
      tenantId: TENANT_DEMO,
      budgetNumber: reference('BUD', i + 1),
      title: b.titre,
      fiscalYear: anneeCourante,
      department: b.service,
      budgetType: 'annuel',
      totalAllocated: String(b.alloue),
      totalSpent: String(b.depense),
      totalCommitted: String(b.engage),
      currency: 'EUR',
      startDate: new Date(anneeCourante, 0, 1),
      endDate: new Date(anneeCourante, 11, 31),
      status: 'active',
    })));
    console.log(`── Budgets ──\n   ${BUDGETS.length} enveloppes, exercice ${anneeCourante}`);

    // ── Système de management de la maintenance ────────────────────
    const SMM = [
      { type: 'politique', titre: 'Politique de maintenance', contenu: "Priorité au préventif conditionnel sur les équipements critiques, maintien du taux de préventif planifié au-dessus de 60 %, traitement sous 48 h de toute alerte critique." },
      { type: 'procedure', titre: 'Procédure de consignation', contenu: "Toute intervention sur un équipement sous énergie fait l'objet d'un permis de consignation, validé par le responsable maintenance avant ouverture des travaux." },
      { type: 'procedure', titre: 'Gestion des pièces critiques', contenu: "Les références classées critiques font l'objet d'un stock de sécurité calculé sur la consommation des douze derniers mois et le délai fournisseur." },
      { type: 'indicateur', titre: 'Définition des indicateurs de maintenance', contenu: "MTBF : moyenne des intervalles entre déclenchements de pannes. MTTR : moyenne des durées d'intervention corrective. Les deux sont calculés sur les ordres clos, et restent indéfinis sous trois occurrences." },
    ];
    await db.insert(smmDocuments).values(SMM.map((d) => ({
      tenantId: TENANT_DEMO,
      documentType: d.type,
      title: d.titre,
      content: d.contenu,
      version: '1.0',
      status: 'approved',
    })));
    console.log(`── SMM ──\n   ${SMM.length} documents de référence`);

    // ── Base de connaissances ──────────────────────────────────────
    const CONNAISSANCES = [
      { type: 'gamme', titre: 'Remplacement roulement moteur asynchrone', typeEq: 'moteur', contenu: "Dépose accouplement, extraction à l'arrache-moyeu, contrôle de portée d'arbre, montage à chaud à 110 °C, graissage initial 18 g, contrôle vibratoire après quatre heures de marche." },
      { type: 'gamme', titre: 'Réfection de vérin hydraulique', typeEq: 'presse', contenu: "Consignation hydraulique, purge, dépose de tige, remplacement du kit de joints, contrôle de l'état de chemise, remontage au couple, essai à 1,5 fois la pression de service." },
      { type: 'retour_experience', titre: 'Cavitation sur pompe alimentaire', typeEq: 'pompe', contenu: "Trois occurrences en deux ans, toutes consécutives à un colmatage de crépine d'aspiration. Contrôle de la crépine ajouté à la gamme trimestrielle." },
      { type: 'fiche_technique', titre: 'Seuils vibratoires ISO 10816 appliqués au parc', typeEq: 'moteur', contenu: "Zone A sous 2,3 mm/s, zone B de 2,3 à 4,5, zone C de 4,5 à 7,1, zone D au-delà. Alerte posée à 3,0 mm/s sur les moteurs de la ligne 2." },
      { type: 'gamme', titre: 'Contrôle annuel de chaudière vapeur', typeEq: 'chaudiere', contenu: "Épreuve hydraulique, contrôle de la soupape de sûreté, inspection du faisceau par endoscopie, relevé d'épaisseur par ultrasons sur les points de référence." },
    ];
    await db.insert(knowledgeHubDocuments).values(CONNAISSANCES.map((d) => ({
      tenantId: TENANT_DEMO,
      documentType: d.type,
      title: d.titre,
      description: d.contenu.slice(0, 160),
      content: d.contenu,
      equipmentType: d.typeEq,
      tags: [d.typeEq, d.type],
    })));
    console.log(`── Base de connaissances ──\n   ${CONNAISSANCES.length} documents`);

    // ── Indicateurs KPI ────────────────────────────────────────────
    // Agrégats mensuels sur douze mois. Ils ne REMPLACENT pas le calcul de
    // l'application : ils alimentent les écrans qui lisent une série
    // historique au lieu de la recalculer à chaque affichage.
    const kpis: Array<Record<string, unknown>> = [];
    for (let m = 11; m >= 0; m -= 1) {
      const debut = new Date(anneeCourante, new Date(maintenant).getMonth() - m, 1);
      const fin = new Date(debut.getFullYear(), debut.getMonth() + 1, 0, 23, 59, 59);
      const progression = (12 - m) / 12;
      const SERIES: Array<[string, number, number]> = [
        ['availability', 0.918, 0.035],
        ['planned_maintenance_ratio', 0.58, 0.09],
        ['first_time_fix', 0.74, 0.08],
      ];
      for (const [type, base, amplitude] of SERIES) {
        kpis.push({
          tenantId: TENANT_DEMO,
          metricType: type,
          metricValue: (base + amplitude * (progression - 0.5) + (alea() - 0.5) * amplitude * 0.4).toFixed(4),
          periodStart: debut,
          periodEnd: fin,
          calculationDate: fin,
          context: { source: 'jeu-de-demonstration', mois: debut.getMonth() + 1, annee: debut.getFullYear() },
        });
      }
    }
    await db.insert(kpiMetrics).values(kpis as never);
    console.log(`── Indicateurs ──\n   ${kpis.length} points sur 12 mois`);

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║  JEU DE DÉMONSTRATION CHARGÉ                                   ║
╚════════════════════════════════════════════════════════════════╝

  Organisation : Usine Verrières ${MARQUEUR}
  Identifiant  : ${TENANT_DEMO}

  QUATRE COMPTES, QUATRE SECRETS DISTINCTS. Les secrets ne sont PAS
  affichés ici : cette sortie reste dans l'historique du terminal et dans
  les journaux de tout outil qui a lancé la commande.

${COMPTES.map((c) => `    ${c.email.padEnd(36)} ${c.libelle}`).join('\n')}

  Leurs secrets sont déposés dans :
    ${canal.chemin}
    ${canal.protection}

  Pour les récupérer — ce qui efface le dépôt :
      npm run demo:secrets

  Pour couper l'accès sans rien effacer :  npm run demo:desactiver

  Les indicateurs affichés sont CALCULÉS à partir de ces données :
  MTBF et MTTR sur les interventions closes, courbes mensuelles sur
  14 mois, point de commande sur les consommations réelles, IMCA et
  RUL sur la dérive vibratoire de ${repere(CODE_DERIVE)}.

  Pour tout effacer :  npm run demo:retirer
`);
  } finally {
    await pool.end();
  }
}

/**
 * Retire le jeu de démonstration — et rien d'autre.
 *
 * Une suppression est irréversible : le marqueur est donc vérifié AVANT le
 * premier `DELETE`, et l'ensemble s'exécute dans une transaction. Mieux vaut
 * un retrait qui échoue en bloc qu'une organisation à moitié effacée.
 */
async function effacer(db: any, t: any): Promise<void> {
  console.log('── Retrait du jeu de démonstration ──');

  const [locataire] = await db.select().from(t.tenants)
    .where(eq(t.tenants.id, TENANT_DEMO)).limit(1);

  if (!locataire) {
    console.log('   Rien à retirer : cette organisation n\'existe pas.');
    return;
  }
  if (!locataire.name?.includes(MARQUEUR)) {
    throw new Error(
      `L'organisation ${TENANT_DEMO} ne porte pas le marqueur ${MARQUEUR} — `
      + `elle n'a donc pas été créée par ce script.\n`
      + `Refus de supprimer des données dont ce script n'est pas l'auteur.`,
    );
  }

  await db.transaction(async (tx: any) => {
    const equipements = await tx.select({ id: t.equipmentRegistry.id })
      .from(t.equipmentRegistry).where(eq(t.equipmentRegistry.tenantId, TENANT_DEMO));
    const ids = equipements.map((e: any) => e.id);

    // Cinq tables référencent `equipment_registry.id` SANS porter de
    // `tenant_id` : la cascade du locataire ne les atteint pas, et la
    // suppression des équipements échouerait sur contrainte de clé étrangère.
    // On passe donc par les identifiants d'équipement — jamais par le
    // locataire, qu'elles ne connaissent pas, et jamais sans filtre, ce qui
    // effacerait les données d'autrui.
    if (ids.length) {
      for (const table of [
        t.iotSensorData, t.iotDevices, t.maintenanceReports,
        t.smartNotifications, t.automatedSymptomDetection,
        // ⚠️ `alerts_notifications` PORTE un tenant_id, et il serait donc
        // tentant de la laisser au bloc suivant. Mesuré : le moteur d'alertes
        // du serveur en écrit avec `tenant_id` À NULL sur des équipements de
        // démonstration — 10 lignes en quelques minutes de fonctionnement.
        // Supprimées par locataire, elles survivaient, et la suppression des
        // équipements qu'elles référencent échouait sur la clé étrangère :
        // « update or delete on table equipment_registry violates foreign key
        // constraint alerts_notifications_equipment_id_... ». Le retrait du jeu
        // était donc impossible dès que le serveur avait tourné.
        //
        // On passe par les identifiants d'équipement, qui attrapent les deux
        // cas. Le bloc suivant la reprend par locataire, pour les alertes sans
        // équipement rattaché.
        t.alertsNotifications,
      ]) {
        await tx.delete(table).where(inArray(table.equipmentId, ids));
      }
    }

    // Le reste est rattaché au locataire. L'ordre respecte les dépendances :
    // ce qui référence est supprimé avant ce qui est référencé.
    for (const table of [
      t.alertsNotifications, t.stockMovements, t.spareParts,
      t.preventiveMaintenancePlans,
      // ── Lot 2 ── Retirées AVANT les ordres de travail et les équipements :
      // plusieurs portent une clé étrangère vers eux (rca.work_order_id,
      // permis.equipment_id, oee.equipment_id…). L'ordre n'est pas cosmétique,
      // il conditionne le succès du retrait.
      t.rcaAnalyses, t.fmeaAnalyses, t.permitToWork, t.oeeRecords,
      t.calibrationRecords, t.assetLifecycle, t.kpiMetrics,
      t.budgetPlans, t.suppliers, t.smmDocuments, t.knowledgeHubDocuments,
      t.workOrders, t.equipmentRegistry, t.userProfiles,
    ]) {
      await tx.delete(table).where(eq(table.tenantId, TENANT_DEMO));
    }

    await tx.delete(t.tenants).where(eq(t.tenants.id, TENANT_DEMO));
  });

  console.log('   Jeu de démonstration retiré. Aucune autre organisation touchée.');
}

main().catch((e) => {
  // Drizzle enveloppe les échecs de connexion dans une erreur dont le message
  // est la requête SQL complète — illisible, et surtout trompeuse : on croit à
  // un problème de schéma alors que le serveur n'a jamais répondu. La cause
  // réelle vit dans `e.cause`.
  const cause = (e as { cause?: { code?: string; message?: string } }).cause;
  if (cause?.code === 'ECONNREFUSED' || cause?.code === 'ENOTFOUND') {
    console.error(
      `\n⛔ Base de données injoignable (${cause.code}).\n`
      + `   Vérifiez DATABASE_URL et que le serveur PostgreSQL écoute bien.\n`,
    );
  } else if (cause?.message) {
    console.error(`\n⛔ ${cause.message}\n`);
  } else {
    console.error(`\n⛔ ${e.message}\n`);
  }
  process.exit(1);
});

