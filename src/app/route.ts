import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const locale = process.env.SITE_DEFAULT_LOCALE === "en" ? "en" : "zh";
  const response = NextResponse.redirect(new URL(`/${locale}`, request.url), 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
