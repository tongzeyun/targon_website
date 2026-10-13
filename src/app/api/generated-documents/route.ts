import { NextRequest } from "next/server";
import { AuthError, errorResponse, getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { listGeneratedDocuments } from "@/lib/repositories/generated-document-repository";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthOrg(req);
    const documentType = req.nextUrl.searchParams.get("type") || undefined;
    const documents = await listGeneratedDocuments(auth, { documentType });

    return jsonResponse({ documents });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse("Failed to list generated documents: " + (error as Error).message, 500);
  }
}
