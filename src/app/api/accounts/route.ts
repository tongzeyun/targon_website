import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { getAccounts, createAccount } from "@/lib/repositories/account-repository";

export async function GET(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const accounts = await getAccounts(auth.organizationId);
  return jsonResponse(accounts);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const body = await req.json();
  const account = await createAccount(auth, body);
  return jsonResponse(account, 201);
}
