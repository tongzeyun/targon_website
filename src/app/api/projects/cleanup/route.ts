import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { cleanupProjects } from "@/lib/repositories/project-repository";

export async function POST(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const { mode } = await req.json().catch(() => ({ mode: "clean" }));
  return jsonResponse(await cleanupProjects(auth, mode));
}
