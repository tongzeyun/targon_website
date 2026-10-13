import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse, errorResponse } from "@/lib/api/auth";
import { getJob } from "@/lib/repositories/job-repository";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const job = await getJob(auth, id);

  if (!job) return errorResponse("Not found", 404);
  const done = job.status === "succeeded" || job.status === "failed" || job.status === "canceled";
  return jsonResponse({ job, done, ok: job.status === "succeeded" });
}
