import { NextRequest } from "next/server";
import { AuthError, errorResponse, getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { listIntelligenceItems, type IntelligenceItemStatus, type IntelligenceItemType } from "@/lib/repositories/intelligence-repository";

function parseStatus(value: string | null): IntelligenceItemStatus | undefined {
  if (value === "candidate" || value === "promoting" || value === "promoted" || value === "rejected") return value;
  return undefined;
}

function parseItemType(value: string | null): IntelligenceItemType | undefined {
  if (value === "candidate_account" || value === "candidate_project") return value;
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthOrg(req);
    const { searchParams } = new URL(req.url);
    const items = await listIntelligenceItems(auth, {
      status: parseStatus(searchParams.get("status")),
      itemType: parseItemType(searchParams.get("itemType")),
    });

    return jsonResponse({ items });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse("Failed to list intelligence items: " + (error as Error).message, 500);
  }
}
