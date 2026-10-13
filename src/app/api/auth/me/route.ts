import { NextRequest, type NextResponse } from "next/server";
import {
  jsonResponse,
  authErrorResponse,
  authenticateRequest,
} from "@/lib/api/auth";

const NO_STORE = "no-store";

function noStore<T extends NextResponse>(response: T): T {
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return noStore(
      authErrorResponse(req, {
        code: "AUTH_REQUIRED",
        message: "未登录或登录已过期",
        status: 401,
      })
    );
  }
  return noStore(jsonResponse({ user }));
}
