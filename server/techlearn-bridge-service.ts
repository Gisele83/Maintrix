import { pool as sharedPool } from "./db";
import { fetchTpRecommendations, fetchQuizResultsForEmail } from "./techlearn-client";

export interface CompetencyGap {
  workOrderId: number;
  orderNumber: string;
  technicianId: number;
  technicianName: string;
  technicianEmail: string | null;
  equipmentId: number;
  equipmentName: string;
  equipmentType: string;
}

// Un technicien assigné à un OT ouvert qui n'a JAMAIS clôturé un OT sur ce même type
// d'équipement — signal réel construit sur l'historique work_orders, pas une estimation.
// Volontairement scopé au type d'équipement (pas à un mode de panne précis) : c'est la
// granularité que le modèle de données peut établir sans inventer une taxonomie de
// compétences qui n'existe pas encore côté Maintrix.
const GAP_QUERY = `
  SELECT wo.id AS work_order_id, wo.order_number, wo.assigned_to AS technician_id,
         COALESCE(up.first_name || ' ' || up.last_name, up.username) AS technician_name,
         up.email AS technician_email,
         er.id AS equipment_id, er.equipment_name, er.equipment_type
  FROM work_orders wo
  JOIN equipment_registry er ON er.id = wo.equipment_id
  JOIN user_profiles up ON up.id = wo.assigned_to
  WHERE wo.tenant_id = $1
    AND wo.status IN ('assigned', 'in_progress')
    AND wo.assigned_to IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM work_orders wo2
      JOIN equipment_registry er2 ON er2.id = wo2.equipment_id
      WHERE wo2.assigned_to = wo.assigned_to
        AND wo2.status = 'completed'
        AND er2.equipment_type = er.equipment_type
        AND wo2.tenant_id = wo.tenant_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM training_requests tr
      WHERE tr.work_order_id = wo.id AND tr.technician_id = wo.assigned_to
        AND tr.status IN ('detected', 'requested', 'in_progress', 'completed')
    )
`;

export async function detectCompetencyGaps(tenantId: string): Promise<CompetencyGap[]> {
  const result = await sharedPool.query(`${GAP_QUERY} ORDER BY wo.created_at DESC`, [tenantId]);
  return result.rows.map(rowToGap);
}

export async function getGapForWorkOrder(tenantId: string, workOrderId: number): Promise<CompetencyGap | null> {
  const result = await sharedPool.query(`${GAP_QUERY} AND wo.id = $2`, [tenantId, workOrderId]);
  return result.rows[0] ? rowToGap(result.rows[0]) : null;
}

function rowToGap(row: any): CompetencyGap {
  return {
    workOrderId: row.work_order_id,
    orderNumber: row.order_number,
    technicianId: row.technician_id,
    technicianName: row.technician_name,
    technicianEmail: row.technician_email,
    equipmentId: row.equipment_id,
    equipmentName: row.equipment_name,
    equipmentType: row.equipment_type,
  };
}

export async function listTrainingRequests(tenantId: string) {
  const result = await sharedPool.query(
    `SELECT tr.*, up.first_name, up.last_name, wo.order_number
     FROM training_requests tr
     JOIN user_profiles up ON up.id = tr.technician_id
     LEFT JOIN work_orders wo ON wo.id = tr.work_order_id
     WHERE tr.tenant_id = $1
     ORDER BY tr.created_at DESC
     LIMIT 100`,
    [tenantId],
  );
  return result.rows;
}

export async function requestTraining(tenantId: string, workOrderId: number, requestedByUserId: number) {
  const gap = await getGapForWorkOrder(tenantId, workOrderId);
  if (!gap) {
    throw new Error("Aucun écart de compétence détecté pour cet ordre de travail (ou déjà couvert)");
  }

  const existing = await sharedPool.query(
    `SELECT * FROM training_requests
     WHERE tenant_id = $1 AND work_order_id = $2 AND technician_id = $3
       AND status IN ('detected', 'requested', 'in_progress')`,
    [tenantId, workOrderId, gap.technicianId],
  );

  let requestRow = existing.rows[0];
  if (!requestRow) {
    const inserted = await sharedPool.query(
      `INSERT INTO training_requests
         (tenant_id, work_order_id, technician_id, equipment_type, gap_reason, status, requested_by, requested_at)
       VALUES ($1, $2, $3, $4, $5, 'requested', $6, now())
       RETURNING *`,
      [
        tenantId,
        workOrderId,
        gap.technicianId,
        gap.equipmentType,
        `${gap.technicianName} n'a jamais clôturé d'OT sur un équipement de type "${gap.equipmentType}"`,
        requestedByUserId,
      ],
    );
    requestRow = inserted.rows[0];
  } else if (requestRow.status === "detected") {
    const updated = await sharedPool.query(
      `UPDATE training_requests SET status = 'requested', requested_by = $2, requested_at = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [requestRow.id, requestedByUserId],
    );
    requestRow = updated.rows[0];
  }

  const recommendation = await fetchTpRecommendations(gap.equipmentType, 1);
  if (recommendation.connected && recommendation.recommendations.length > 0) {
    const tp = recommendation.recommendations[0];
    const updated = await sharedPool.query(
      `UPDATE training_requests
       SET techlearn_tp_id = $2, techlearn_tp_title = $3, techlearn_tp_url = $4, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [requestRow.id, tp.tpId, tp.title, tp.url],
    );
    requestRow = updated.rows[0];
  }

  return { request: requestRow, techlearnConnected: recommendation.connected, techlearnReason: (recommendation as any).reason };
}

// Interroge TechLearn (par email, seule clé commune aux deux bases utilisateurs) pour
// chaque demande encore ouverte, et clôture celles où un quiz a été passé depuis la
// demande. Best-effort : une demande reste "requested" tant que TechLearn n'a rien à
// rapporter — ce n'est pas une erreur, juste l'absence de nouvelle donnée.
export async function syncCompletedTraining(tenantId: string): Promise<{ checked: number; completed: number }> {
  const pending = await sharedPool.query(
    `SELECT tr.id, tr.requested_at, up.email
     FROM training_requests tr
     JOIN user_profiles up ON up.id = tr.technician_id
     WHERE tr.tenant_id = $1 AND tr.status = 'requested' AND up.email IS NOT NULL`,
    [tenantId],
  );

  let completed = 0;
  for (const row of pending.rows) {
    const since = row.requested_at ? new Date(row.requested_at) : undefined;
    const result = await fetchQuizResultsForEmail(row.email, since);
    if (result.connected && result.attempts.length > 0) {
      const best = result.attempts.reduce((a, b) => (b.score > a.score ? b : a));
      await sharedPool.query(
        `UPDATE training_requests
         SET status = 'completed', techlearn_score = $2, completed_at = now(), updated_at = now()
         WHERE id = $1`,
        [row.id, best.score],
      );
      completed++;
    }
  }

  return { checked: pending.rows.length, completed };
}
