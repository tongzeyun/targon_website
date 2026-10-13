import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { getPipelines, createPipelineItem } from "@/lib/repositories/pipeline-repository";

export async function GET(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const items = await getPipelines(auth.organizationId);
  return jsonResponse(items);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const body = await req.json();
  const item = await createPipelineItem(auth, body);
  return jsonResponse(item, 201);
}
