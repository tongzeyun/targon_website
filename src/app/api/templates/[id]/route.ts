import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse, errorResponse } from "@/lib/api/auth";
import { deleteTemplate } from "@/lib/repositories/template-repository";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const deleted = await deleteTemplate(auth, id);
  if (!deleted) return errorResponse("模板不存在", 404);
  return jsonResponse({ success: true });
}
