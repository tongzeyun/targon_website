import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { listStrategyCards } from "@/lib/repositories/strategy-card-repository";

export async function GET(req: NextRequest) {
  const auth = await getAuthOrg(req);
  return jsonResponse(await listStrategyCards(auth));
}
