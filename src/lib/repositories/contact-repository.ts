import type { AuthContext } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { serializeJson } from "@/lib/db/json";
import { ALLOWED_COLUMNS, buildUpdateSets } from "@/lib/repositories/update-sets";
import { camelize } from "@/lib/db/transform";
import { normalizeContactInfluenceLevel } from "@/lib/contact-influence";
import { v4 as uuid } from "uuid";

export async function createContact(ctx: AuthContext, body: Record<string, unknown>) {
  const account = await db.queryOne(
    "SELECT id FROM target_accounts WHERE id = $1 AND organization_id = $2",
    [body.accountId, ctx.organizationId]
  );
  if (!account) return null;

  const id = uuid();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO contacts (id, organization_id, account_id, name, title, department, role_in_decision, influence_level, contact_info, social_url, notes, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      ctx.organizationId,
      body.accountId,
      body.name,
      body.title,
      body.department,
      body.roleInDecision,
      normalizeContactInfluenceLevel(body.influenceLevel),
      serializeJson(body.contactInfo, {}),
      body.socialUrl || null,
      body.notes || "",
      now,
      now,
    ]
  );
  return { id };
}

export async function updateContact(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const existing = await db.queryOne(
    "SELECT id FROM contacts WHERE id = $1 AND organization_id = $2",
    [id, ctx.organizationId]
  );
  if (!existing) return null;

  const { sets, params } = buildUpdateSets(body, ALLOWED_COLUMNS.contacts);
  if (sets.length > 0) {
    params.push(new Date().toISOString());
    sets.push(`updated_at = $${params.length}`);
    params.push(id);
    const idPh = `$${params.length}`;
    params.push(ctx.organizationId);
    const orgPh = `$${params.length}`;
    await db.execute(`UPDATE contacts SET ${sets.join(", ")} WHERE id = ${idPh} AND organization_id = ${orgPh}`, params);
  }

  return camelize(await db.queryOne("SELECT * FROM contacts WHERE id = $1 AND organization_id = $2", [id, ctx.organizationId]));
}

export async function deleteContact(ctx: AuthContext, id: string): Promise<boolean> {
  const result = await db.execute("DELETE FROM contacts WHERE id = $1 AND organization_id = $2", [id, ctx.organizationId]);
  return result.changes > 0;
}

export interface EnrichedContactInput {
  role?: string;
  department?: string;
  influence?: number;
  typicalBackground?: string;
  howToFind?: string;
  approachTips?: string;
  linkedinSearchHint?: string;
}

export async function insertEnrichedContactsForAccount(
  ctx: AuthContext,
  accountId: string,
  contacts: EnrichedContactInput[],
  aiRunId: string
) {
  const account = await db.queryOne(
    "SELECT id FROM target_accounts WHERE id = $1 AND organization_id = $2",
    [accountId, ctx.organizationId]
  );
  if (!account) return null;

  const timestamp = new Date().toISOString();
  for (const contact of contacts) {
    await db.execute(
      `INSERT INTO contacts (id, organization_id, account_id, name, title, department, role_in_decision, influence_level, contact_info, notes, created_at, updated_at, ai_run_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        uuid(),
        ctx.organizationId,
        accountId,
        `[${contact.role}]`,
        contact.role,
        contact.department,
        contact.role,
        contact.influence,
        serializeJson({}, {}),
        `典型背景: ${contact.typicalBackground || ""}\n如何找到: ${contact.howToFind || ""}\n触达建议: ${contact.approachTips || ""}\n搜索提示: ${contact.linkedinSearchHint || ""}`,
        timestamp,
        timestamp,
        aiRunId,
      ]
    );
  }
  return { count: contacts.length };
}
