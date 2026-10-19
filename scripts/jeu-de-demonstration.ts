/**
 * Jeu de démonstration — une usine crédible, pour montrer Maintrix.
 *
 *   npx tsx scripts/jeu-de-demonstration.ts            (charge)
 *   npx tsx scripts/jeu-de-demonstration.ts --retirer  (efface)
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
 * Mot de passe des comptes de démonstration.
 *
 * ⚠️ Volontairement ABSENT du code. Ce dépôt est public, et ce jeu de données
 * est destiné à être chargé sur un serveur accessible par Internet : un mot de
 * passe écrit ici serait un compte `owner` ouvert à quiconque lit le dépôt.
 *
 * Deux usages :
 *   • sans rien préciser, un mot de passe aléatoire est tiré et affiché une
 *     fois en fin de chargement ;
 *   • avec `MAINTRIX_DEMO_PASSWORD`, c'est celui-là qui est posé — utile pour
 *     retrouver le même accès d'une session de captures à l'autre.
 */
function motDePasseDemo(): { valeur: string; origine: 'fourni' | 'tiré' } {
  const fourni = process.env.MAINTRIX_DEMO_PASSWORD;
  if (fourni) {
    if (VALEURS_DEXEMPLE.includes(fourni.trim().toLowerCase())) {
      throw new Error(
        `MAINTRIX_DEMO_PASSWORD vaut « ${fourni} », qui est une valeur d'exemple.\n`
        + `Choisissez autre chose, ou ne renseignez rien pour un tirage aléatoire.`,
      );
    }
    if (fourni.length < 12) {
      throw new Error('MAINTRIX_DEMO_PASSWORD doit faire au moins 12 caractères.');
    }
    return { valeur: fourni, origine: 'fourni' };
  }

  // Tirage cryptographique — pas le générateur déterministe ci-dessous, qui
  // est reproductible par construction et donc inapte à un mot de passe.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const octets = randomBytes(20);
  const tire = Array.from(octets, (o) => alphabet[o % alphabet.length]).join('');
  return { valeur: `Demo-${tire}`, origine: 'tiré' };
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

function verifierBase(url: string): void {
  const nom = (() => { try { return new URL(url).pathname.replace(/^\//, ''); } catch { return ''; } })();
  const autorise = process.env.MAINTRIX_DEMO_ALLOW_ANY_DB === '1';

  // ⚠️ Ce jeu de données n'a rien à faire dans la base d'un client. Le
  // garde-fou est volontairement bruyant : on préfère refuser à tort que
  // peupler à tort.
  if (/prod/i.test(nom) && !autorise) {
    throw new Error(
      `Refus de charger un jeu de démonstration dans « ${nom} » : le nom de base `
      + `évoque un environnement de production.\n`
      + `Pour forcer — et vous saurez ce que vous faites : MAINTRIX_DEMO_ALLOW_ANY_DB=1`,
    );
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL absent.');
  verifierBase(url);

  const retirer = process.argv.includes('--retirer');

  // Avant toute connexion et toute écriture. Un script qui écrit d'abord et
  // découvre ensuite que son jeu est inexploitable laisse derrière lui une
  // organisation à moitié remplie, qu'il faut retirer à la main.
  // Le mot de passe est résolu ici, et non au moment de créer les comptes :
  // un MAINTRIX_DEMO_PASSWORD refusé doit arrêter le script avant la première
  // écriture, pas après le chargement du parc.
  const motDePasse = retirer
    ? { valeur: '', origine: 'tiré' as const }
    : motDePasseDemo();

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
  } = await import('@shared/schema');

  try {
    if (retirer) {
      await effacer(db, {
        tenants, userProfiles, equipmentRegistry, workOrders, spareParts,
        stockMovements, preventiveMaintenancePlans, iotSensorData, alertsNotifications,
        iotDevices, maintenanceReports, smartNotifications, automatedSymptomDetection,
      });
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

    const empreinte = await bcrypt.hash(motDePasse.valeur, 10);
    const COMPTES = [
      // `owner` d'abord : c'est le rôle le plus étendu d'un locataire, donc
      // celui qui donne accès à tous les écrans à capturer.
      { email: `direction@${DOMAINE_DEMO}`, username: 'demo_direction', role: 'owner', prenom: 'Hélène', nom: 'Daumier' },
      { email: `responsable@${DOMAINE_DEMO}`, username: 'demo_responsable', role: 'maintenance_manager', prenom: 'Claire', nom: 'Vasseur' },
      { email: `technicien@${DOMAINE_DEMO}`, username: 'demo_technicien', role: 'technician', prenom: 'Samir', nom: 'Benali' },
      { email: `planificateur@${DOMAINE_DEMO}`, username: 'demo_planificateur', role: 'planner', prenom: 'Léa', nom: 'Moreau' },
    ];
    for (const c of COMPTES) {
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
    console.log(`   ${COMPTES.length} comptes`);

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

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║  JEU DE DÉMONSTRATION CHARGÉ                                   ║
╚════════════════════════════════════════════════════════════════╝

  Organisation : Usine Verrières ${MARQUEUR}
  Identifiant  : ${TENANT_DEMO}

  Connexion    : direction@${DOMAINE_DEMO}   (accès le plus large)
  Mot de passe : ${motDePasse.valeur}
                 ${motDePasse.origine === 'tiré'
                   ? '↑ tiré au hasard, affiché UNE SEULE FOIS — notez-le maintenant.\n'
                     + '                   Pour en imposer un : MAINTRIX_DEMO_PASSWORD=…'
                   : '↑ celui de MAINTRIX_DEMO_PASSWORD.'}

  Trois autres comptes, même mot de passe, pour capturer les écrans
  tels que chaque métier les voit :
    responsable@${DOMAINE_DEMO}      (responsable maintenance)
    planificateur@${DOMAINE_DEMO}    (planificateur)
    technicien@${DOMAINE_DEMO}       (technicien)

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
      ]) {
        await tx.delete(table).where(inArray(table.equipmentId, ids));
      }
    }

    // Le reste est rattaché au locataire. L'ordre respecte les dépendances :
    // ce qui référence est supprimé avant ce qui est référencé.
    for (const table of [
      t.alertsNotifications, t.stockMovements, t.spareParts,
      t.preventiveMaintenancePlans, t.workOrders, t.equipmentRegistry, t.userProfiles,
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

