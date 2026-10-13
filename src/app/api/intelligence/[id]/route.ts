import { NextRequest } from "next/server";
import { AuthError, errorResponse, getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { getIntelligenceItem } from "@/lib/repositories/intelligence-repository";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthOrg(req);
    const { id } = await params;
    const item = await getIntelligenceItem(auth, id);
    if (!item) return errorResponse("Intelligence item not found", 404);
    return jsonResponse({ item });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse("Failed to load intelligence item: " + (error as Error).message, 500);
  }
}
