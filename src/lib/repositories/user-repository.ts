import { db } from "@/lib/db";
import { v4 as uuid } from "uuid";

const now = () => new Date().toISOString();

export interface CreateUserInput {
  id?: string;
  email: string;
  fullName: string;
  organizationId: string;
  role: string;
  passwordHash: string;
}

export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  organization_id: string;
  role: string;
}

export interface UserWithPasswordRow extends UserRow {
  password_hash: string;
}

export async function createUser(input: CreateUserInput) {
  const id = input.id || uuid();
  const timestamp = now();
  await db.execute(
    "INSERT INTO users (id, email, full_name, organization_id, role, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [id, input.email, input.fullName, input.organizationId, input.role, input.passwordHash, timestamp, timestamp]
  );
  return { id };
}

export async function findUserByEmail(email: string): Promise<UserWithPasswordRow | null> {
  return db.queryOne<UserWithPasswordRow>(
    "SELECT id, email, full_name, organization_id, role, password_hash FROM users WHERE email = $1",
    [email.toLowerCase().trim()]
  );
}

export async function findUserById(id: string): Promise<UserRow | null> {
  return db.queryOne<UserRow>(
    "SELECT id, email, full_name, organization_id, role FROM users WHERE id = $1",
    [id]
  );
}
