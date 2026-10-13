import { db } from "@/lib/db";

export interface AlertRuleRow {
  id: string;
  name: string;
  keywords?: string | null;
  industries?: string | null;
  regions?: string | null;
}

export interface AlertSignalRow {
  id: string;
  title?: string | null;
  raw_content?: string | null;
  extracted_data?: string | Record<string, unknown> | null;
}

export async function listActiveAlertRules(organizationId: string): Promise<AlertRuleRow[]> {
  return db.query<AlertRuleRow>(
    "SELECT * FROM alert_rules WHERE organization_id = $1 AND is_active = TRUE",
    [organizationId]
  );
}

export async function listRecentSignalsForAlerts(
  organizationId: string,
  cutoffIso: string,
  limit = 200
): Promise<AlertSignalRow[]> {
  return db.query<AlertSignalRow>(
    `SELECT * FROM project_signals
     WHERE organization_id = $1
       AND created_at >= $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [organizationId, cutoffIso, limit]
  );
}
