import type { AuthContext } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { camelize, camelizeAll } from "@/lib/db/transform";
import { serializeJson } from "@/lib/db/json";
import { v4 as uuid } from "uuid";

const TEMPLATE_LIST_COLUMNS = "id, organization_id, template_type, name, file_type, parsed_text, structure, placeholders, created_at, updated_at";

export interface CreateTemplateInput {
  type: string;
  name: string;
  fileType: string;
  parsedText: string;
  structure: unknown;
  placeholders: unknown[];
  fileData: string;
}

export async function listTemplates(ctx: AuthContext, type?: string) {
  if (type) {
    return camelizeAll(await db.query(
      `SELECT ${TEMPLATE_LIST_COLUMNS} FROM document_templates WHERE organization_id = $1 AND template_type = $2 ORDER BY created_at DESC`,
      [ctx.organizationId, type]
    ));
  }

  return camelizeAll(await db.query(
    `SELECT ${TEMPLATE_LIST_COLUMNS} FROM document_templates WHERE organization_id = $1 ORDER BY created_at DESC`,
    [ctx.organizationId]
  ));
}

export async function createTemplate(ctx: AuthContext, input: CreateTemplateInput) {
  const id = uuid();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO document_templates (id, organization_id, template_type, name, file_type, parsed_text, structure, placeholders, file_data, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      ctx.organizationId,
      input.type,
      input.name,
      input.fileType,
      input.parsedText,
      input.structure,
      serializeJson(input.placeholders, []),
      input.fileData,
      now,
      now,
    ]
  );

  return getTemplateSummary(ctx, id);
}

export async function getTemplateSummary(ctx: AuthContext, id: string) {
  return camelize(await db.queryOne(
    `SELECT ${TEMPLATE_LIST_COLUMNS} FROM document_templates WHERE id = $1 AND organization_id = $2`,
    [id, ctx.organizationId]
  ));
}

export async function deleteTemplate(ctx: AuthContext, id: string): Promise<boolean> {
  const result = await db.execute(
    "DELETE FROM document_templates WHERE id = $1 AND organization_id = $2",
    [id, ctx.organizationId]
  );
  return result.changes > 0;
}
