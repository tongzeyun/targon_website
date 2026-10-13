import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse, errorResponse } from "@/lib/api/auth";
import { getProjectWithSignals, updateProject } from "@/lib/repositories/project-repository";
import { deleteProjectWithRelations } from "@/lib/repositories/project-repository";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const project = await getProjectWithSignals(id, auth.organizationId);
  if (!project) return errorResponse("Not found", 404);
  return jsonResponse(project);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const project = await updateProject(id, auth, await req.json());
  if (!project) return errorResponse("Not found", 404);
  return jsonResponse(project);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const deleted = await deleteProjectWithRelations(auth, id);
  if (!deleted) return errorResponse("Not found", 404);
  return jsonResponse({ success: true });
}
