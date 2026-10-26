import type { Express } from "express";
import { gmaoStorage } from "./gmao-storage";
import { tenantRequis } from "./tenant-requis";
import { evaluerCapteur, scoreDeSante, etatEquipement, type EvaluationCapteur } from "@shared/supervision";

/** Grandeurs présentées par le tableau de bord de santé. */
const TYPES_CAPTEUR = ['temperature', 'vibration', 'pressure', 'current'] as const;

/**
 * Correspondance entre le vocabulaire de `shared/supervision.ts` et celui que
 * l'interface attend déjà. On conserve les trois valeurs historiques pour ne
 * pas casser l'affichage existant, et on en AJOUTE une quatrième —
 * `non_evalue` — parce qu'elle manquait : l'ancien code rangeait « je n'ai
 * aucune donnée » avec « tout va bien », ce qui est précisément la confusion
 * à supprimer.
 */
const ETAT_API = {
  sain: 'healthy',
  surveillance: 'warning',
  anomalie: 'critical',
  non_evalue: 'non_evalue',
} as const;

/**
 * Met une évaluation à la forme attendue par le tableau de bord.
 *
 * `value` et `unit` peuvent valoir `null` : un capteur absent n'a pas de
 * valeur, et prétendre qu'il lit 0 reviendrait à inventer une mesure.
 */
function presenterCapteur(evaluation: EvaluationCapteur, sensorData: any[]) {
  const dernier = sensorData.find((d) => d.sensorType === evaluation.typeCapteur);
  return {
    sensorType: evaluation.typeCapteur,
    value: evaluation.valeurCourante ?? null,
    unit: evaluation.unite ?? null,
    // Vocabulaire des CAPTEURS, distinct de celui des équipements :
    // l'interface teste `sensor.status === 'normal'`.
    status: evaluation.etat === 'anomalie' ? 'critical'
      : evaluation.etat === 'surveillance' ? 'warning'
      : evaluation.etat === 'normal' ? 'normal'
      : 'non_evalue',
    timestamp: dernier?.timestamp ?? null,
    // Ce qui remplace l'ancien `threshold` : non plus une constante, mais
    // l'écart mesuré au régime habituel de CE capteur, et la référence qui a
    // servi à le calculer — pour que l'écran puisse montrer sur quoi il se
    // fonde au lieu d'asséner un verdict.
    ecartReduit: evaluation.ecartReduit ?? null,
    reference: evaluation.reference ?? null,
    motif: evaluation.motif ?? null,
  };
}

export function registerEquipmentHealthRoutes(app: Express) {
  // Get equipment health data with predictive analytics
  app.get("/api/equipment/health", async (req, res) => {
    try {
      const { equipmentId, timeRange } = req.query;
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const equipment = await gmaoStorage.getEquipmentRegistry(tenantId);

      // ⚠️ `lastMaintenance` valait `eq.createdAt` et `nextMaintenance`
      // « aujourd'hui + 30 jours », pour TOUS les équipements — le code les
      // annotait lui-même « Mock ». Un exploitant lisait donc une date de
      // dernière intervention qui était la date de saisie de la fiche, et une
      // échéance identique sur tout le parc. Les deux se lisent réellement :
      // la dernière intervention close d'une part, l'échéance des plans
      // préventifs d'autre part. Chargés une fois ici, pas par équipement,
      // pour ne pas multiplier les requêtes.
      const [ordres, plans] = await Promise.all([
        gmaoStorage.getWorkOrders(tenantId),
        gmaoStorage.getPreventiveMaintenancePlans(tenantId),
      ]);

      const derniereIntervention = new Map<number, Date>();
      for (const ot of ordres) {
        if (ot.status !== 'completed' || !ot.actualEnd || !ot.equipmentId) continue;
        const fin = new Date(ot.actualEnd);
        const connue = derniereIntervention.get(ot.equipmentId);
        if (!connue || fin > connue) derniereIntervention.set(ot.equipmentId, fin);
      }

      const prochaineEcheance = new Map<number, Date>();
      for (const plan of plans) {
        if (plan.isActive === false || !plan.nextDue) continue;
        const ids = Array.isArray(plan.equipmentIds) ? plan.equipmentIds : [];
        const echeance = new Date(plan.nextDue);
        for (const brut of ids) {
          const id = Number(brut);
          if (!Number.isFinite(id)) continue;
          const connue = prochaineEcheance.get(id);
          if (!connue || echeance < connue) prochaineEcheance.set(id, echeance);
        }
      }

      const healthData = await Promise.all(equipment.map(async (eq) => {
        // Get recent sensor data for this equipment
        const sensorData = await gmaoStorage.getIotSensorData(tenantId, eq.id, undefined, 200);

        // Chaque capteur est jugé par rapport à son PROPRE historique : voir
        // `shared/supervision.ts` pour la raison détaillée.
        const evaluations = evaluerCapteurs(sensorData);
        const healthScore = scoreDeSante(evaluations) ?? null;
        const status = ETAT_API[etatEquipement(evaluations)];
        const sensors = evaluations.map((e) => presenterCapteur(e, sensorData));

        // Generate trend data (last 24 hours)
        const trends = generateTrendData(sensorData);

        // Generate predictive data
        const predictions = generatePredictions(sensorData, eq);

        // Get recent alerts for this equipment
        const alerts = await gmaoStorage.getAlerts(tenantId, eq.id);

        return {
          id: eq.id,
          equipmentName: eq.equipmentName,
          equipmentCode: eq.equipmentId,
          healthScore,
          status,
          lastMaintenance: derniereIntervention.get(eq.id)?.toISOString() ?? null,
          nextMaintenance: prochaineEcheance.get(eq.id)?.toISOString() ?? null,
          sensors,
          trends,
          predictions,
          alerts: alerts.slice(0, 5) // Last 5 alerts
        };
      }));

      // Filter by equipment if specified
      const filteredData = equipmentId && equipmentId !== 'all' 
        ? healthData.filter(eq => eq.id.toString() === equipmentId)
        : healthData;

      res.json(filteredData);
    } catch (error) {
      console.error("Error fetching equipment health:", error);
      res.status(500).json({ message: "Failed to fetch equipment health data" });
    }
  });

  // Get equipment alerts
  app.get("/api/equipment/alerts", async (req, res) => {
    try {
      const { timeRange } = req.query;
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;

      // Generate sample alerts based on IoT data
      const equipment = await gmaoStorage.getEquipmentRegistry(tenantId);
      const allAlerts = [];
      
      for (const eq of equipment) {
        const sensorData = await gmaoStorage.getIotSensorData(tenantId, eq.id, undefined, 10);
        const alerts = generateAlertsFromSensorData(eq, sensorData);
        allAlerts.push(...alerts);
      }
      
      // Sort by timestamp (most recent first)
      allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      res.json(allAlerts.slice(0, 50)); // Return last 50 alerts
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // Get predictive maintenance recommendations
  app.get("/api/equipment/predictions", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const equipment = await gmaoStorage.getEquipmentRegistry(tenantId);

      const predictions = await Promise.all(equipment.map(async (eq) => {
        const sensorData = await gmaoStorage.getIotSensorData(tenantId, eq.id, undefined, 100);
        return {
          equipmentId: eq.id,
          equipmentName: eq.equipmentName,
          predictions: generatePredictions(sensorData, eq),
          recommendedActions: generateMaintenanceRecommendations(sensorData, eq)
        };
      }));
      
      res.json(predictions);
    } catch (error) {
      console.error("Error generating predictions:", error);
      res.status(500).json({ message: "Failed to generate predictions" });
    }
  });
}

/**
 * Évalue chaque grandeur suivie sur un équipement.
 *
 * ⚠️ La version précédente de cette fonction inventait trois choses :
 *
 *   • un score de 85 quand il n'y avait AUCUNE donnée — une machine non
 *     surveillée était donc annoncée saine à 85 % ;
 *   • pour un capteur absent, `value: 0, status: 'normal'` — un capteur
 *     manquant était présenté comme un capteur sain lisant zéro ;
 *   • l'unité, déduite du TYPE de capteur alors que chaque relevé porte son
 *     unité enregistrée : un capteur en psi s'affichait en bar.
 *
 * Elle ne retourne plus que ce qui est mesuré, et dit explicitement ce qui ne
 * l'est pas.
 */
function evaluerCapteurs(sensorData: any[]): EvaluationCapteur[] {
  return TYPES_CAPTEUR.map((type) => {
    const releves = sensorData.filter((d) => d.sensorType === type);
    // L'unité vient du relevé, pas d'une table de correspondance.
    const unite = releves[0]?.unit ?? undefined;
    return evaluerCapteur(
      type,
      releves.map((d) => ({ valeur: Number(d.value), horodatage: d.timestamp })),
      unite,
    );
  });
}

function generateTrendData(sensorData: any[]): any[] {
  // Group sensor data by timestamp (hourly intervals)
  const groupedData = new Map<string, { timestamp: string; temperature: number[]; vibration: number[]; pressure: number[]; current: number[] }>();
  
  sensorData.forEach(reading => {
    const hour = new Date(reading.timestamp);
    hour.setMinutes(0, 0, 0); // Round to hour
    const hourKey = hour.toISOString();
    
    if (!groupedData.has(hourKey)) {
      groupedData.set(hourKey, {
        timestamp: hourKey,
        temperature: [],
        vibration: [],
        pressure: [],
        current: []
      });
    }
    
    const group = groupedData.get(hourKey)!;
    const sensorKey = reading.sensorType as keyof typeof group;
    if (Array.isArray(group[sensorKey])) {
      (group[sensorKey] as number[]).push(reading.value);
    }
  });
  
  // Calculate averages and health scores
  // ⚠️ Ce bloc substituait des valeurs INVENTÉES quand une grandeur manquait
  // sur un intervalle : 65 °C, 3,2 mm/s, 3,5 bar, 8,5 A. Les courbes de
  // tendance affichaient donc une mesure plausible pour des capteurs qui
  // n'existaient pas, et le lecteur n'avait aucun moyen de distinguer une
  // machine instrumentée d'une machine nue.
  //
  // `null` laisse un trou dans la courbe, ce qui est la représentation exacte
  // d'une absence de mesure. Le score par intervalle a disparu : il était
  // calculé avec les seuils absolus dont tout ce fichier vient d'être
  // débarrassé, et un point isolé n'a de toute façon pas d'historique auquel
  // se comparer (voir `shared/supervision.ts`).
  const moyenneOuNull = (xs: number[], decimales: number): number | null =>
    xs.length ? parseFloat((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(decimales)) : null;

  return Array.from(groupedData.values())
    .map(group => ({
      timestamp: group.timestamp,
      temperature: moyenneOuNull(group.temperature, 1),
      vibration: moyenneOuNull(group.vibration, 2),
      pressure: moyenneOuNull(group.pressure, 1),
      current: moyenneOuNull(group.current, 1),
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-24); // Last 24 hours
}

function generatePredictions(sensorData: any[], equipment: any): any[] {
  const predictions: any[] = [];
  const sensorTypes = ['temperature', 'vibration', 'pressure', 'current'];
  
  sensorTypes.forEach(sensorType => {
    const readings = sensorData
      .filter(d => d.sensorType === sensorType)
      .slice(0, 20); // Last 20 readings
    
    if (readings.length < 5) return; // Need sufficient data
    
    // Simple trend analysis  
    const values = readings.map(r => {
      const val = parseFloat(r.value);
      return isNaN(val) ? 0 : val;
    });
    const trend = calculateTrend(values);
    const trendSafe = isNaN(trend) ? 0 : trend;
    const currentValue = values[0] || 0;
    const prediction = currentValue + (trendSafe * 24);
    const predictedValue = isNaN(prediction) ? currentValue : parseFloat(prediction.toFixed(2));
    
    // ⚠️ La confiance avait un PLANCHER à 60 % : une série incohérente au
    // point de rendre toute extrapolation absurde était quand même annoncée
    // « fiable à 60 % ». Le plancher est retiré ; une confiance basse doit
    // pouvoir dire qu'elle est basse.
    const variance = calculateVariance(values);
    const confidence = Math.max(0, Math.min(95, 90 - variance * 10));

    // ⚠️ Le niveau de risque et le temps avant défaillance se déduisaient des
    // seuils absolus globaux (voir `shared/supervision.ts`). Sur une presse à
    // 185 bar, `predictedValue > 4.0` était vrai en permanence : risque
    // « élevé » perpétuel. Et quand tout allait bien, le code renvoyait
    // `365` — « un an », une durée de vie restante purement inventée.
    //
    // Le risque se lit désormais sur l'écart de la période récente à la
    // référence de ce capteur, et le temps avant défaillance n'est PAS
    // calculé ici : il relève de `server/stochastic-rul.ts`, qui le fait sur
    // un modèle de dégradation et renvoie `null` quand il ne sait pas.
    const evaluation = evaluerCapteur(
      sensorType,
      readings.map((r) => ({ valeur: Number(r.value), horodatage: r.timestamp })),
    );
    const riskLevel = evaluation.etat === 'anomalie' ? 'high'
      : evaluation.etat === 'surveillance' ? 'medium'
      : evaluation.etat === 'normal' ? 'low'
      : 'unknown';

    predictions.push({
      metric: sensorType,
      currentValue: parseFloat((currentValue || 0).toFixed(2)),
      predictedValue,
      confidence: Math.round(confidence),
      ecartReduit: evaluation.ecartReduit ?? null,
      timeToFailure: null,
      riskLevel
    });
  });
  
  return predictions;
}

/**
 * Alertes déduites de l'état des capteurs d'un équipement.
 *
 * ⚠️ Cette fonction comparait CHAQUE relevé aux seuils absolus globaux et
 * produisait une alerte par relevé fautif. Sur une presse à 185 bar, avec un
 * seuil de 4,0, cela faisait une alerte « critique » par mesure — des
 * milliers par jour, toutes fausses. C'est la définition même du noyage
 * d'alarmes : passé un certain volume, plus personne ne les lit.
 *
 * Désormais : une alerte par GRANDEUR en écart, pas par relevé, et seulement
 * si l'écart à la référence du capteur est significatif.
 *
 * Les identifiants étaient tirés au hasard (`Math.random() * 10000`), donc
 * instables d'un appel à l'autre et susceptibles de collision — une interface
 * qui s'en sert comme clé de liste réaffiche n'importe quoi. Ils sont
 * maintenant dérivés de l'équipement et de la grandeur, donc stables.
 */
function generateAlertsFromSensorData(equipment: any, sensorData: any[]): any[] {
  const alerts: any[] = [];

  for (const type of TYPES_CAPTEUR) {
    const releves = sensorData.filter((d) => d.sensorType === type);
    if (!releves.length) continue;

    const evaluation = evaluerCapteur(
      type,
      releves.map((d) => ({ valeur: Number(d.value), horodatage: d.timestamp })),
      releves[0]?.unit ?? undefined,
    );
    if (evaluation.etat !== 'anomalie' && evaluation.etat !== 'surveillance') continue;

    const sens = (evaluation.ecartReduit ?? 0) > 0 ? 'en hausse' : 'en baisse';
    const ecarts = Math.abs(evaluation.ecartReduit ?? 0).toFixed(1);
    const unite = evaluation.unite ? ` ${evaluation.unite}` : '';

    alerts.push({
      id: `${equipment.id}-${type}`,
      severity: evaluation.etat === 'anomalie' ? 'critical' : 'warning',
      message:
        `${equipment.equipmentName} : ${type} ${sens} — `
        + `${evaluation.moyenneRecente?.toFixed(2)}${unite} contre `
        + `${evaluation.reference?.moyenne.toFixed(2)}${unite} habituellement `
        + `(${ecarts} écarts-types)`,
      timestamp: releves[0]?.timestamp ?? new Date().toISOString(),
      equipmentId: equipment.id
    });
  }

  return alerts;
}

/**
 * Actions suggérées à partir des grandeurs en écart.
 *
 * ⚠️ Les trois règles s'appuyaient sur les seuils absolus globaux : sur une
 * presse hydraulique, « Inspection circuit hydraulique — Pression anormale »
 * était recommandée en permanence, puisque 185 bar dépasse 4,0.
 *
 * Les durées annoncées (« 2 heures », « 4 heures », « 3 heures ») restent des
 * ordres de grandeur métier assumés, pas des mesures : elles sont présentées
 * comme telles, et non comme une estimation calculée.
 */
function generateMaintenanceRecommendations(sensorData: any[], equipment: any): any[] {
  const recommendations: any[] = [];

  const gammes: Record<string, { action: string; priorite: string; duree: string }> = {
    temperature: { action: 'Vérification du refroidissement et de la ventilation', priorite: 'high', duree: '2 heures' },
    vibration: { action: 'Relevé vibratoire, équilibrage et alignement', priorite: 'medium', duree: '4 heures' },
    pressure: { action: 'Inspection du circuit et recherche de fuite', priorite: 'high', duree: '3 heures' },
    current: { action: 'Contrôle électrique et mesure d’isolement', priorite: 'medium', duree: '2 heures' },
  };

  for (const type of TYPES_CAPTEUR) {
    const releves = sensorData.filter((d) => d.sensorType === type);
    if (!releves.length) continue;

    const evaluation = evaluerCapteur(
      type,
      releves.map((d) => ({ valeur: Number(d.value), horodatage: d.timestamp })),
      releves[0]?.unit ?? undefined,
    );
    if (evaluation.etat !== 'anomalie') continue;

    const gamme = gammes[type];
    const sens = (evaluation.ecartReduit ?? 0) > 0 ? 'hausse' : 'baisse';
    recommendations.push({
      type: 'maintenance',
      priority: gamme.priorite,
      action: gamme.action,
      reason:
        `${type} en ${sens} de ${Math.abs(evaluation.ecartReduit ?? 0).toFixed(1)} écarts-types `
        + `par rapport au régime habituel de cet équipement`,
      estimatedDuration: gamme.duree,
      dureeEstimative: true,
    });
  }

  return recommendations;
}

// ⚠️ Trois fonctions ont été RETIRÉES d'ici (2026-10-25) :
//
//   getUnitForSensorType()      — déduisait l'unité du TYPE de capteur, alors
//                                 que chaque relevé porte son unité
//                                 enregistrée. Un capteur en psi s'affichait
//                                 en bar. L'unité vient désormais du relevé.
//
//   getThresholdForSensorType() — rendait quatre constantes universelles
//                                 (75 / 4,5 / 4,0 / 10) qui ne décrivaient
//                                 aucune installation réelle et rendaient
//                                 toute usine « critique » en permanence.
//                                 Remplacée par l'évaluation statistique de
//                                 `shared/supervision.ts`.
//
//   determineEquipmentStatus()  — déduisait l'état de ces mêmes seuils, et
//                                 confondait « sain » et « non mesuré ».
//                                 Remplacée par `etatEquipement()`.
//
// Elles ne doivent pas revenir : un seuil d'alarme est un paramètre
// d'ingénierie propre à chaque machine, pas une constante de programme. Le
// jour où `sensor_thresholds` sera rétablie (elle est aujourd'hui rattachée à
// `iot_devices`, que rien ne remplit), c'est de là que viendront les limites
// absolues.

function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;
  
  // Simple linear trend calculation
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, val, idx) => sum + val * idx, 0);
  const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return slope || 0;
}

function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return variance;
}