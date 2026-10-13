import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { updateStrategyCard } from "@/lib/repositories/strategy-card-repository";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const updated = await updateStrategyCard(auth, id, await req.json());
  if (!updated) return jsonResponse({ error: "策略卡不存在" }, 404);
  return jsonResponse(updated);
}
