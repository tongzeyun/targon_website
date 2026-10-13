import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse, errorResponse } from "@/lib/api/auth";
import { getAccountWithRelations, updateAccount } from "@/lib/repositories/account-repository";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const account = await getAccountWithRelations(id, auth.organizationId);
  if (!account) return errorResponse("Not found", 404);
  return jsonResponse(account);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthOrg(req);
  const { id } = await params;
  const body = await req.json();
  const account = await updateAccount(id, auth, body);
  if (!account) return errorResponse("Not found", 404);
  return jsonResponse(account);
}
