import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse } from "@/lib/api/auth";
import { isContactInfluenceLevel } from "@/lib/contact-influence";
import { createContact } from "@/lib/repositories/contact-repository";

export async function POST(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const body = await req.json() as Record<string, unknown>;
  if (body.influenceLevel !== undefined && !isContactInfluenceLevel(body.influenceLevel)) {
    return jsonResponse({ error: "影响力必须是 1 到 5 之间的整数" }, 400);
  }
  const contact = await createContact(auth, body);
  if (!contact) return jsonResponse({ error: "目标账户不存在" }, 404);
  return jsonResponse(contact, 201);
}
