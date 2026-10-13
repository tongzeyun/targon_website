import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { cancelJob } from "@/lib/repositories/job-repository";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const canceled = await cancelJob(auth, id);

  return jsonResponse({ canceled });
}
