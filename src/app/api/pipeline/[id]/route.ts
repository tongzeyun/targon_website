import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse, errorResponse } from "@/lib/api/auth";
import { updatePipelineItem } from "@/lib/repositories/pipeline-repository";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const body = await req.json();
  const item = await updatePipelineItem(id, auth, body);
  if (!item) return errorResponse("Not found", 404);
  return jsonResponse(item);
}
