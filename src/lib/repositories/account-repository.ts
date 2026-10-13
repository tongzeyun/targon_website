import type { AuthContext } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { serializeJson } from "@/lib/db/json";
import { camelize, camelizeAll } from "@/lib/db/transform";
import { v4 as uuid } from "uuid";
import { normalizeTitle } from "./normalization";
import { ALLOWED_COLUMNS, buildUpdateSets } from "./update-sets";

const now = () => new Date().toISOString();

export async function getAccounts(organizationId: string) {
  return camelizeAll(await db.query("SELECT * FROM target_accounts WHERE organization_id = $1 ORDER BY match_score DESC", [organizationId]));
}

export async function getAccount(id: string, organizationId: string) {
  return camelize(await db.queryOne("SELECT * FROM target_accounts WHERE id = $1 AND organization_id = $2", [id, organizationId]));
}

export async function getAccountWithRelations(id: string, organizationId: string) {
  const account = await getAccount(id, organizationId);
  if (!account) return null;
  const [contacts, decisionChain, strategyCards] = await Promise.all([
    db.query("SELECT * FROM contacts WHERE account_id = $1 AND organization_id = $2", [id, organizationId]),
    db.queryOne("SELECT * FROM decision_chains WHERE account_id = $1 AND organization_id = $2", [id, organizationId]),
    db.query("SELECT * FROM strategy_cards WHERE account_id = $1 AND organization_id = $2 ORDER BY generated_at DESC", [id, organizationId]),
  ]);
  return {
    ...account,
    contacts: camelizeAll(contacts),
    decisionChain: camelize(decisionChain),
    strategyCards: camelizeAll(strategyCards),
  };
}

export async function createAccount(
  ctx: AuthContext,
  data: Record<string, unknown>,
  options: { aiRunId?: string | null } = {}
) {
  const id = (data.id as string) || uuid();
  await db.execute(
    `INSERT INTO target_accounts (id, organization_id, company_name, industry, sub_industry, size, revenue, website, locations, parent_company, tech_stack, match_score, match_reasoning, enriched_data, tags, status, created_at, updated_at, ai_run_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    [
      id,
      ctx.organizationId,
      data.companyName,
      data.industry,
      data.subIndustry,
      data.size,
      data.revenue,
      data.website,
      serializeJson(data.locations, []),
      data.parentCompany,
      serializeJson(data.techStack, {}),
      data.matchScore,
      data.matchReasoning,
      serializeJson(data.enrichedData, {}),
      serializeJson(data.tags, []),
      data.status || "active",
      now(),
      now(),
      options.aiRunId || null,
    ]
  );
  return getAccount(id, ctx.organizationId);
}

export interface DeepResearchAccountInput extends Record<string, unknown> {
  companyName: string;
  industry?: string;
  province?: string;
  location?: string;
  matchScore?: number;
  whyTarget?: string;
}

export interface CreateDeepResearchAccountsInput {
  accounts: DeepResearchAccountInput[];
  productId?: string | null;
  aiRunId?: string | null;
  reportId?: string | null;
  jobId?: string | null;
}

export interface CreateDeepResearchAccountsResult {
  accountsCreated: number;
  duplicatesSkipped: number;
  accountIds: string[];
}

export async function createDeepResearchAccounts(
  ctx: AuthContext,
  input: CreateDeepResearchAccountsInput
): Promise<CreateDeepResearchAccountsResult> {
  const uniqueAccounts = new Map<string, DeepResearchAccountInput>();
  for (const account of input.accounts) {
    const companyName = account.companyName.trim();
    if (!companyName) throw new Error("Selected account is missing companyName");
    const normalizedName = normalizeTitle(companyName);
    if (!uniqueAccounts.has(normalizedName)) {
      uniqueAccounts.set(normalizedName, { ...account, companyName });
    }
  }

  const sortedAccounts = [...uniqueAccounts.entries()].sort(([left], [right]) => left.localeCompare(right));
  let duplicatesSkipped = input.accounts.length - sortedAccounts.length;
  const accountIds: string[] = [];

  await db.transaction(async () => {
    for (const [normalizedName, account] of sortedAccounts) {
      await db.queryOne("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `target-account:${ctx.organizationId}:${normalizedName}`,
      ]);

      const existing = await db.queryOne(
        `SELECT id FROM target_accounts
         WHERE organization_id = $1
           AND LOWER(REGEXP_REPLACE(BTRIM(company_name), '\\s+', '', 'g')) = $2
         LIMIT 1`,
        [ctx.organizationId, normalizedName]
      );
      if (existing) {
        duplicatesSkipped++;
        continue;
      }

      const accountId = uuid();
      const province = typeof account.province === "string" ? account.province.trim() : "";
      const city = typeof account.location === "string" ? account.location.trim() : "";
      const locations = province || city
        ? [{ province: province || undefined, city: city || undefined, type: "HQ" }]
        : [];

      await createAccount(
        ctx,
        {
          id: accountId,
          companyName: account.companyName,
          industry: typeof account.industry === "string" ? account.industry.trim() : null,
          locations,
          matchScore: typeof account.matchScore === "number" && Number.isFinite(account.matchScore)
            ? account.matchScore
            : null,
          matchReasoning: typeof account.whyTarget === "string" ? account.whyTarget : null,
          enrichedData: {
            source: "deep_research_selection",
            productId: input.productId || null,
            reportId: input.reportId || null,
            jobId: input.jobId || null,
            analysis: account,
          },
          tags: ["深度情报"],
          status: "active",
        },
        { aiRunId: input.aiRunId || null }
      );
      accountIds.push(accountId);
    }
  });

  return {
    accountsCreated: accountIds.length,
    duplicatesSkipped,
    accountIds,
  };
}

export async function updateAccount(id: string, ctx: AuthContext, data: Record<string, unknown>) {
  const { sets, params } = buildUpdateSets(data, ALLOWED_COLUMNS.accounts);
  if (sets.length === 0) return null;
  params.push(now());
  sets.push(`updated_at = $${params.length}`);
  params.push(id);
  const idPh = `$${params.length}`;
  params.push(ctx.organizationId);
  const orgPh = `$${params.length}`;
  await db.execute(`UPDATE target_accounts SET ${sets.join(", ")} WHERE id = ${idPh} AND organization_id = ${orgPh}`, params);
  return getAccount(id, ctx.organizationId);
}

export async function listAccountsForMatching(organizationId: string) {
  return camelizeAll(await db.query(
    `SELECT id, company_name, industry, sub_industry, size, locations, tech_stack
     FROM target_accounts WHERE organization_id = $1`,
    [organizationId]
  ));
}

export async function listAccountNames(organizationId: string) {
  return camelizeAll(await db.query(
    "SELECT id, company_name FROM target_accounts WHERE organization_id = $1",
    [organizationId]
  ));
}

export interface AccountMatchResultInput {
  matchScore: number;
  matchReasoning: string;
  aiRunId: string;
}

export async function updateAccountMatchResult(
  organizationId: string,
  accountId: string,
  input: AccountMatchResultInput
) {
  await db.execute(
    `UPDATE target_accounts SET match_score = $1, match_reasoning = $2, ai_run_id = $3, updated_at = $4
     WHERE id = $5 AND organization_id = $6`,
    [input.matchScore, input.matchReasoning, input.aiRunId, now(), accountId, organizationId]
  );
}

export interface AccountEnrichmentFields {
  industry: string;
  subIndustry: string;
  size: string;
  revenue: string;
  website: string;
  locations: unknown;
  techStack: unknown;
}

export async function updateAccountFromEnrichment(
  organizationId: string,
  accountId: string,
  fields: AccountEnrichmentFields,
  aiRunId: string
) {
  await db.execute(
    `UPDATE target_accounts SET
       industry = $1, sub_industry = $2, size = $3, revenue = $4, website = $5,
       locations = $6, tech_stack = $7, updated_at = $8, ai_run_id = $9
     WHERE id = $10 AND organization_id = $11`,
    [
      fields.industry,
      fields.subIndustry,
      fields.size,
      fields.revenue,
      fields.website,
      serializeJson(fields.locations, []),
      serializeJson(fields.techStack, {}),
      now(),
      aiRunId,
      accountId,
      organizationId,
    ]
  );
}
