import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const locale = process.env.SITE_DEFAULT_LOCALE === "en" ? "en" : "zh";
  const response = new NextResponse(null, {
    status: 302,
    headers: { Location: `/${locale}` },
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
