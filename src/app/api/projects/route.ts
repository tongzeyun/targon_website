import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { getProjects, createProject } from "@/lib/repositories/project-repository";

export async function GET(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const projects = await getProjects(auth.organizationId);
  return jsonResponse(projects);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const body = await req.json();
  const project = await createProject(auth, body);
  return jsonResponse(project, 201);
}
