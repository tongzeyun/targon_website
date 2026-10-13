import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Current timestamp in ISO-8601 format. */
export function isoNow(): string {
  return new Date().toISOString();
}

// Shared helpers — use these everywhere instead of copy-pasting

/** Parse a value that could be JSON string or already-parsed object */
export function parseJson<T = unknown>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v === "object") return v as T;
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return v as T; } }
  return v as T;
}

/** Parse JSON array string or return empty array */
export function parseJsonArr<T = unknown>(v: unknown): T[] {
  const parsed = parseJson(v);
  return Array.isArray(parsed) ? parsed as T[] : [];
}

/** Convert camelCase to snake_case */
export function snakify(k: string): string {
  return k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}

// ============================================================
// Shared TypeScript types
// ============================================================

export interface Account {
  id: string; companyName: string; industry?: string; subIndustry?: string;
  size?: string; revenue?: string; website?: string; locations?: unknown;
  techStack?: unknown; matchScore?: number; matchReasoning?: string;
  tags?: unknown; status?: string; createdAt?: string; updatedAt?: string;
  contacts?: Contact[]; decisionChain?: unknown; strategyCards?: StrategyCard[];
}

export interface Contact {
  id: string; accountId: string; name: string; title?: string; department?: string;
  roleInDecision?: string; influenceLevel?: number; contactInfo?: unknown;
  notes?: string; createdAt?: string;
}

export interface Product {
  id: string; name: string; category: string; model?: string; specs?: unknown;
  targetIndustries: string[]; applications: string[]; competitorProducts: string[];
  priceRange?: string; description?: string; isActive?: boolean;
}

export interface Project {
  id: string; projectName: string; projectType?: string; industry?: string;
  budgetRange?: string; timeline?: unknown; fundingSource?: string;
  buyerName?: string; buyerContact?: unknown; location?: string;
  confidenceScore?: number; summary?: string; status?: string;
  signals?: Signal[]; bidDocuments?: unknown[];
}

export interface Signal {
  id: string; projectId?: string; signalType?: string; sourceUrl?: string;
  sourceName?: string; title?: string; publishDate?: string;
  extractedData?: unknown; relevanceScore?: number;
}

export interface StrategyCard {
  id: string; accountId: string; productId?: string;
  recommendedApproach?: string; keyMilestones?: unknown;
  competitorAnalysis?: string; talkingPoints?: unknown;
  riskWarnings?: unknown; generatedBy?: string; generatedAt?: string;
}

export interface Pipeline {
  id: string; projectId?: string; productId?: string; accountId?: string;
  currentStage?: string; dealAmount?: string; probability?: number;
  nextAction?: string; nextActionDate?: string;
  notes?: string; expectedCloseDate?: string;
}
