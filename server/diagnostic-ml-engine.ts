/**
 * Diagnostic ML Engine
 * Fonctions de similarité et d'aide au diagnostic industriel (règles + texte + sémantique).
 * Extraites de routes.ts pour améliorer la maintenabilité.
 *
 * Note : la fonction callMLEngine() qui spawnait des scripts Python (ml_diagnostic_engine.py,
 * enhanced_ml_diagnostic.py, ml_ensemble_engine.py, continuous_learning_engine.py,
 * advanced_ml_features.py) a été supprimée le 19/07/2026 — ces scripts n'existaient pas
 * dans le repository et les appels échouaient systématiquement. Voir le changelog dans
 * ARCHITECTURE_GLOBALE_MAINTRIX.md.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type MaintenanceType = "preventive" | "corrective" | "emergency";
export type WorkOrderStatus = "completed" | "in_progress" | "cancelled";

// ── Mapping helpers ────────────────────────────────────────────────────────────

export function mapOrderTypeToMaintenanceType(orderType: string): MaintenanceType {
  switch (orderType?.toLowerCase()) {
    case "preventive":
    case "préventive":
      return "preventive";
    case "emergency":
    case "urgence":
    case "urgent":
      return "emergency";
    default:
      return "corrective";
  }
}

export function mapWorkOrderStatus(status: string): WorkOrderStatus {
  switch (status?.toLowerCase()) {
    case "completed": case "terminé": case "fini": case "done":
      return "completed";
    case "cancelled": case "annulé": case "rejected": case "rejeté":
      return "cancelled";
    default:
      return "in_progress";
  }
}

// ── Text similarity ────────────────────────────────────────────────────────────

export function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(text2.split(/\s+/).filter((w) => w.length > 2));
  const intersection = new Set(Array.from(words1).filter((x) => words2.has(x)));
  const union = new Set([...Array.from(words1), ...Array.from(words2)]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

/** Dictionnaire de synonymes industriels français pour l'analyse sémantique. */
const SYNONYM_DICTIONARY: Record<string, string[]> = {
  bruit: ["son", "vibration", "grincement", "sifflement", "claquement", "cognement", "ronflement", "vrombissement", "bourdonnement"],
  vibration: ["tremblement", "oscillation", "secousse", "frémissement", "pulsation", "battement", "soubresaut"],
  grincement: ["crissement", "frottement", "raclement", "grinçage", "couinement"],
  chaud: ["surchauffe", "température élevée", "brûlant", "échauffement", "chauffage excessif", "chaleur anormale"],
  surchauffe: ["température excessive", "échauffement anormal", "trop chaud", "thermique élevé", "chauffe"],
  froid: ["température basse", "refroidissement", "gelé", "glacé", "frais", "sous-refroidi"],
  blocage: ["coincé", "grippé", "bloqué", "immobilisé", "figé", "grippage", "serrage", "dur"],
  glissement: ["patinage", "dérapage", "perte adhérence", "glisse", "échappement"],
  déformation: ["torsion", "pliage", "gauchissement", "voilage", "déformé", "tordu", "plié"],
  usure: ["usé", "détérioration", "dégradation", "érosion", "abrasion", "fatigue"],
  jeu: ["jeu mécanique", "flottement", "ballant", "débattement", "espace"],
  fuite: ["écoulement", "perte", "coulure", "suintement", "égouttement", "infiltration"],
  pression: ["compression", "force", "poussée", "contrainte", "charge"],
  débit: ["flux", "écoulement", "circulation", "passage", "transit"],
  étincelle: ["arc électrique", "décharge", "court-circuit", "amorçage", "spark"],
  coupure: ["arrêt", "interruption", "panne", "défaillance", "dysfonctionnement"],
  courant: ["électricité", "alimentation", "tension", "voltage", "ampérage"],
  lent: ["ralenti", "vitesse réduite", "performance dégradée", "faible vitesse", "retard"],
  rapide: ["accéléré", "vitesse excessive", "emballement", "survitesse", "trop vite"],
  irrégulier: ["saccadé", "instable", "variable", "erratique", "fluctuant", "inconstant"],
  arrêt: ["stop", "coupure", "interruption", "panne", "immobilisation"],
  cassé: ["brisé", "rompu", "fracturé", "endommagé", "détruit"],
  fissuré: ["craquelé", "fendu", "lézardé", "fêlé"],
  oxydé: ["rouillé", "corrodé", "oxidation", "rouille"],
  sale: ["encrassé", "souillé", "pollué", "contaminé", "crasse"],
  désaligné: ["mal aligné", "décentré", "décalé", "faux", "désaxé"],
  desserré: ["lâche", "détendu", "relâché", "libre", "pas serré"],
  sec: ["sans lubrifiant", "manque huile", "non lubrifié", "aride"],
  graisse: ["lubrifiant", "huile", "graissage", "lubrification"],
};

function normalizeText(text: string): string {
  return text.toLowerCase()
    .replace(/[àáâãäå]/g, "a").replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i").replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u").replace(/[ç]/g, "c")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function findLongestCommonSubstring(str1: string, str2: string): string {
  let longest = "";
  for (let i = 0; i < str1.length; i++) {
    for (let j = i + 1; j <= str1.length; j++) {
      const sub = str1.slice(i, j);
      if (str2.includes(sub) && sub.length > longest.length) longest = sub;
    }
  }
  return longest;
}

export function calculateSemanticSimilarity(userSymptoms: string, dbSymptoms: string): number {
  const userText = normalizeText(userSymptoms);
  const dbText = normalizeText(dbSymptoms);
  if (userText.includes(dbText) || dbText.includes(userText)) return 0.9;

  const userWords = userText.split(" ").filter((w) => w.length > 2);
  const dbWords = dbText.split(" ").filter((w) => w.length > 2);
  let matches = 0;
  const totalWords = Math.max(userWords.length, 1);

  for (const userWord of userWords) {
    let best = 0;
    if (dbWords.some((dw) => dw === userWord)) { best = 1.0; }
    else if (dbWords.some((dw) => dw.includes(userWord) || userWord.includes(dw))) { best = 0.95; }
    else {
      for (const [key, synonyms] of Object.entries(SYNONYM_DICTIONARY)) {
        if (userWord.includes(key) || synonyms.some((s) => userWord.includes(s))) {
          if (dbWords.some((dw) => dw.includes(key) || synonyms.some((s) => dw.includes(s)))) {
            best = Math.max(best, 0.85);
          }
        }
        if (dbWords.some((dw) => dw.includes(key))) {
          if (synonyms.some((s) => userWord.includes(s))) best = Math.max(best, 0.8);
        }
      }
    }
    if (best < 0.5) {
      for (const dw of dbWords) {
        if (userWord.length > 3 && dw.length > 3) {
          const cs = findLongestCommonSubstring(userWord, dw);
          if (cs.length >= 4) {
            best = Math.max(best, (cs.length / Math.max(userWord.length, dw.length)) * 0.7);
          }
        }
      }
    }
    matches += best;
  }
  return Math.min(matches / totalWords, 1.0);
}

export function calculateContextualScore(
  userEquipment: string, dbEquipment: string,
  userZone: string, dbZone: string
): number {
  let score = 0;
  const ue = userEquipment.toLowerCase(), de = dbEquipment.toLowerCase();
  if (ue === de) score += 0.4;
  else if (ue.includes(de) || de.includes(ue)) score += 0.2;
  if (userZone && dbZone) {
    const uz = userZone.toLowerCase(), dz = dbZone.toLowerCase();
    if (uz === dz) score += 0.2;
    else if (uz.includes(dz) || dz.includes(uz)) score += 0.1;
  }
  return score;
}

// ── Risk & cost helpers ────────────────────────────────────────────────────────

export function calculateRiskLevel(case_: any, currentUrgency: string): string {
  const scores = { low: 1, medium: 2, high: 3 };
  const avg = ((scores[case_.urgency as keyof typeof scores] ?? 2) +
               (scores[currentUrgency as keyof typeof scores] ?? 2)) / 2;
  if (avg >= 2.5) return "Élevé";
  if (avg >= 1.5) return "Moyen";
  return "Faible";
}

export function estimateRepairCost(duration = 60, equipmentType: string): string {
  const multipliers: Record<string, number> = {
    moteur: 1.2, pompe: 1.0, compresseur: 1.5, convoyeur: 0.8,
    variateur: 1.3, capteur: 0.7, automate: 1.8,
    sts: 2.5, rtg: 2.2, grue_mobile: 2.0, reach_stacker: 1.8,
    straddle_carrier: 1.7, spreader: 1.6, autre: 1.0,
  };
  const cost = Math.round((duration / 60) * 85 * (multipliers[equipmentType] ?? 1.0));
  return `${cost}€`;
}

export function parseDuration(estimatedTime: string): number {
  const m = estimatedTime.match(/(\d+)/);
  if (m) {
    const n = parseInt(m[1]);
    return estimatedTime.toLowerCase().includes("heure") ? n * 60 : n;
  }
  return 60;
}

// ── AI insight generators ──────────────────────────────────────────────────────

export function generateAdvancedAIInsights(
  _case: any, semanticSimilarity: number, textSimilarity: number, contextualScore: number
): string {
  const parts: string[] = [];
  if (semanticSimilarity > 0.8) parts.push(`🎯 Correspondance sémantique exceptionnelle (${Math.round(semanticSimilarity * 100)}%)`);
  else if (semanticSimilarity > 0.6) parts.push(`🧠 Bonne correspondance sémantique (${Math.round(semanticSimilarity * 100)}%)`);
  else if (semanticSimilarity > 0.4) parts.push(`🔍 Correspondance sémantique modérée (${Math.round(semanticSimilarity * 100)}%)`);
  if (contextualScore > 0.3) parts.push("⚙️ Contexte équipement très pertinent");
  else if (contextualScore > 0.1) parts.push("🔧 Contexte équipement pertinent");
  if (textSimilarity > 0.7) parts.push("📝 Correspondance textuelle forte");
  else if (textSimilarity > 0.4) parts.push("📄 Correspondance textuelle modérée");
  if (semanticSimilarity > 0.7 && contextualScore > 0.2)
    parts.push("✅ Diagnostic hautement recommandé pour ce type d'équipement");
  else if (semanticSimilarity > 0.5)
    parts.push("💡 Diagnostic probable basé sur l'analyse sémantique");
  return parts.length > 0 ? parts.join(" • ") : "Analyse en cours...";
}

export function generateAIInsights(case_: any, symptomScore: number, textSimilarity: number): string {
  const parts: string[] = [];
  if (textSimilarity > 0.8) parts.push(`🎯 Correspondance exceptionnelle (${Math.round(textSimilarity * 100)}%)`);
  else if (textSimilarity > 0.6) parts.push(`🔍 Bonne correspondance (${Math.round(textSimilarity * 100)}%)`);
  else if (textSimilarity > 0.4) parts.push(`📊 Correspondance modérée (${Math.round(textSimilarity * 100)}%)`);
  else parts.push("💡 Diagnostic heuristique basé sur l'expérience");
  if (symptomScore > 3) parts.push(`⚠️ Symptômes multiples détectés (${symptomScore} indicateurs)`);
  else if (symptomScore > 1) parts.push("🔍 Symptômes principaux identifiés");
  const zone = case_.zone || "unknown";
  const sector = case_.sector || "unknown";
  if (zone !== "unknown") parts.push(`📍 Zone: ${zone}`);
  if (sector !== "unknown") parts.push(`🏭 Secteur: ${sector}`);
  const urgencyEmoji = case_.urgency === "high" ? "🚨" : case_.urgency === "medium" ? "⚡" : "🔵";
  parts.push(`${urgencyEmoji} Priorité: ${case_.urgency || "medium"}`);
  if (case_.duration && case_.duration < 60) parts.push("⏱️ Réparation rapide probable");
  else if (case_.duration && case_.duration > 180) parts.push("⏳ Intervention complexe prévue");
  return parts.join(" • ");
}

// ── Contextual solution generator ─────────────────────────────────────────────

const SOLUTIONS: Record<string, Record<string, string>> = {
  "Roulement défaillant": {
    moteur: "Remplacer le roulement défaillant, vérifier l'alignement et la lubrification",
    pompe: "Remplacer le roulement, contrôler l'équilibrage de la roue et l'état de l'arbre",
    compresseur: "Changer le roulement, vérifier la pression et les vibrations",
    default: "Remplacement du roulement avec inspection complète",
  },
  "Joint d'étanchéité usé": {
    pompe: "Remplacer les joints d'étanchéité, vérifier la pression et l'alignement",
    moteur: "Changer les joints de carter, contrôler l'étanchéité générale",
    default: "Remplacement des joints avec test d'étanchéité",
  },
  "Amorçage déficient": {
    pompe: "Vérifier le circuit d'aspiration, purger l'air et contrôler le clapet",
    compresseur: "Contrôler le système d'amorçage et les valves d'admission",
    default: "Diagnostic du circuit d'amorçage et réparation",
  },
  "Usure des balais": {
    moteur: "Remplacer les balais, nettoyer le collecteur et vérifier les ressorts",
    default: "Remplacement des balais et maintenance du collecteur",
  },
  "Problème électrique": {
    moteur: "Diagnostic électrique complet, test d'isolement et vérification des connexions",
    automate: "Contrôler les entrées/sorties, vérifier l'alimentation et les câblages",
    variateur: "Test des paramètres, vérification des signaux et calibrage",
    convertisseur: "Diagnostic des modules de puissance, test des thyristors et vérification du refroidissement",
    onduleur: "Test des batteries, vérification de l'onduleur et contrôle du bypass",
    redresseur: "Contrôle du pont de diodes, test des condensateurs et vérification de la régulation",
    carte_electronique: "Diagnostic des composants, test des soudures et vérification du firmware",
    alimentation: "Test de la régulation, contrôle de l'isolation et vérification des découplages",
    capteur: "Calibrage du capteur, test des signaux et vérification de l'environnement",
    default: "Diagnostic électrique approfondi et réparation",
  },
  "Défaillance IGBT": {
    variateur: "Remplacer les modules IGBT, tester les drivers de grille et vérifier le refroidissement",
    convertisseur: "Changer les IGBT défaillants, contrôler les circuits de commande",
    default: "Remplacement des modules IGBT avec test complet",
  },
  "Défaut thyristor": {
    convertisseur: "Remplacer les thyristors défaillants, vérifier les circuits de gâchette",
    redresseur: "Changer les thyristors, contrôler la commutation et le refroidissement",
    default: "Remplacement des thyristors avec test de commutation",
  },
  "Défaillance batterie": {
    onduleur: "Remplacer les batteries, tester le chargeur et contrôler la température",
    default: "Remplacement des batteries avec test de capacité",
  },
  "Dérive capteur": {
    capteur: "Recalibrer le capteur, vérifier l'environnement et les connexions",
    automate: "Contrôler les entrées analogiques, recalibrer si nécessaire",
    default: "Recalibrage du capteur avec vérification complète",
  },
  "Condensateur sec": {
    carte_electronique: "Remplacer les condensateurs électrolytiques, tester les circuits",
    alimentation: "Changer les condensateurs de filtrage, vérifier l'ondulation",
    redresseur: "Remplacer les condensateurs de lissage, contrôler la tension",
    default: "Remplacement des condensateurs avec test complet",
  },
  "Surchauffe composant": {
    carte_electronique: "Identifier le composant en surchauffe, améliorer le refroidissement",
    alimentation: "Contrôler la ventilation, vérifier la charge et les dissipateurs",
    variateur: "Nettoyer les filtres, vérifier les ventilateurs et la charge",
    default: "Diagnostic thermique et amélioration du refroidissement",
  },
};

export function generateContextualSolution(
  diagnosis: string, equipmentType: string,
  zone = "unknown", sector = "unknown"
): string {
  const eq = SOLUTIONS[diagnosis] ?? {};
  let solution = eq[equipmentType] ?? eq["default"] ?? `Intervention technique pour: ${diagnosis}`;
  const zoneContext: Record<string, string> = {
    production: " - Minimiser l'arrêt de production",
    conditionnement: " - Coordonner avec la ligne de conditionnement",
    stockage: " - Prévoir la gestion des stocks pendant l'intervention",
    utilites: " - Vérifier l'impact sur les services auxiliaires",
    maintenance: " - Utiliser l'atelier pour les réparations complexes",
  };
  if (zone in zoneContext) solution += zoneContext[zone];
  if (sector !== "unknown" && sector.includes("ligne")) solution += ` - Intervention sur ${sector.toUpperCase()}`;
  return solution;
}

// ── Predictive tips ────────────────────────────────────────────────────────────

export function generatePredictiveTips(equipmentType: string, _diagnosis: string): string[] {
  const tips: Record<string, string[]> = {
    moteur: ["Vérifier l'alignement tous les 6 mois", "Contrôler la température de fonctionnement", "Surveiller les vibrations régulièrement"],
    pompe: ["Contrôler l'étanchéité mensuellement", "Vérifier la pression d'aspiration", "Surveiller le débit et les fuites"],
    compresseur: ["Vérifier le niveau d'huile hebdomadairement", "Contrôler les filtres à air", "Surveiller la pression de service"],
    convoyeur: ["Vérifier la tension des bandes", "Contrôler l'alignement des rouleaux", "Lubrifier les roulements régulièrement"],
  };
  return tips[equipmentType] ?? ["Effectuer une maintenance préventive régulière"];
}
