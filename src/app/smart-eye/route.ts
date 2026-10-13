import { NextResponse, type NextRequest } from "next/server";
import { getDefaultLocale } from "@/lib/smart-eye-paths";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = `/${getDefaultLocale()}${url.pathname}`;
  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
