import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { isContactInfluenceLevel } from "@/lib/contact-influence";
import { deleteContact, updateContact } from "@/lib/repositories/contact-repository";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  if (body.influenceLevel !== undefined && !isContactInfluenceLevel(body.influenceLevel)) {
    return jsonResponse({ error: "影响力必须是 1 到 5 之间的整数" }, 400);
  }
  const updated = await updateContact(auth, id, body);
  if (!updated) return jsonResponse({ error: "联系人不存在" }, 404);
  return jsonResponse(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const deleted = await deleteContact(auth, id);
  if (!deleted) return jsonResponse({ error: "联系人不存在" }, 404);
  return jsonResponse({ success: true });
}
