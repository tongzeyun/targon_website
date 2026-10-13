import { NextRequest } from "next/server";
import { AuthError, errorResponse, getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { markIntelligenceItemStatus } from "@/lib/repositories/intelligence-repository";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthOrg(req);
    const { id } = await params;
    const updated = await markIntelligenceItemStatus(auth, id, "rejected");
    if (!updated) return errorResponse("Intelligence item not found", 404);
    return jsonResponse({ rejected: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse("Failed to reject intelligence item: " + (error as Error).message, 500);
  }
}
