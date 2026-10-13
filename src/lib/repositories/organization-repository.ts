import { db } from "@/lib/db";

const now = () => new Date().toISOString();

export interface CreateOrganizationInput {
  id: string;
  name: string;
  slug: string;
}

export async function createOrganization(input: CreateOrganizationInput) {
  const timestamp = now();
  await db.execute(
    "INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
    [input.id, input.name, input.slug, timestamp, timestamp]
  );
  return { id: input.id };
}
