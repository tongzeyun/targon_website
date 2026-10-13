import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { updateDecisionChain } from "@/lib/repositories/decision-chain-repository";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const updated = await updateDecisionChain(auth, id, await req.json());
  if (!updated) return jsonResponse({ error: "决策链不存在" }, 404);
  return jsonResponse(updated);
}
