import { NextRequest } from "next/server";
import { AuthError, errorResponse, getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { promoteIntelligenceItem } from "@/lib/repositories/intelligence-repository";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthOrg(req);
    const { id } = await params;
    const promoted = await promoteIntelligenceItem(auth, id);
    if (!promoted) return errorResponse("Intelligence item not found", 404);
    return jsonResponse({ promoted });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse("Failed to promote intelligence item: " + (error as Error).message, 400);
  }
}
