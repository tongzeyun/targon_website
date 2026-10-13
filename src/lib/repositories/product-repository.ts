import type { AuthContext } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { serializeJson } from "@/lib/db/json";
import { camelize, camelizeAll } from "@/lib/db/transform";
import { v4 as uuid } from "uuid";
import { ALLOWED_COLUMNS, buildUpdateSets } from "./update-sets";

const now = () => new Date().toISOString();

export async function getProducts(organizationId: string) {
  return camelizeAll(await db.query("SELECT * FROM products WHERE organization_id = $1 ORDER BY created_at DESC", [organizationId]));
}

export interface ProductInferenceRow {
  name?: string | null;
  category?: string | null;
  applications?: string | null;
}

export async function listProductsForInference(organizationId: string): Promise<ProductInferenceRow[]> {
  return db.query<ProductInferenceRow>(
    "SELECT name, category, applications FROM products WHERE organization_id = $1",
    [organizationId]
  );
}

export async function getProduct(id: string, organizationId: string) {
  return camelize(await db.queryOne("SELECT * FROM products WHERE id = $1 AND organization_id = $2", [id, organizationId]));
}

export async function createProduct(ctx: AuthContext, data: Record<string, unknown>) {
  const id = (data.id as string) || uuid();
  await db.execute(
    `INSERT INTO products (id, organization_id, name, category, model, specs, target_industries, applications, competitor_products, price_range, description, is_active, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      id,
      ctx.organizationId,
      data.name,
      data.category,
      data.model || null,
      serializeJson(data.specs, {}),
      serializeJson(data.targetIndustries, []),
      serializeJson(data.applications, []),
      serializeJson(data.competitorProducts, []),
      data.priceRange || null,
      data.description || null,
      data.isActive !== false ? true : false,
      now(),
      now(),
    ]
  );
  return getProduct(id, ctx.organizationId);
}

export async function updateProduct(id: string, ctx: AuthContext, data: Record<string, unknown>) {
  const { sets, params } = buildUpdateSets(data, ALLOWED_COLUMNS.products);
  if (sets.length === 0) return null;
  params.push(now());
  sets.push(`updated_at = $${params.length}`);
  params.push(id);
  const idPh = `$${params.length}`;
  params.push(ctx.organizationId);
  const orgPh = `$${params.length}`;
  await db.execute(`UPDATE products SET ${sets.join(", ")} WHERE id = ${idPh} AND organization_id = ${orgPh}`, params);
  return getProduct(id, ctx.organizationId);
}

export async function deleteProduct(id: string, organizationId: string) {
  await db.execute("DELETE FROM products WHERE id = $1 AND organization_id = $2", [id, organizationId]);
}
