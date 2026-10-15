import { NextResponse, type NextRequest } from "next/server";
import { getDefaultLocale } from "@/lib/smart-eye-paths";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const response = new NextResponse(null, {
    status: 302,
    headers: { Location: `/${getDefaultLocale()}${pathname}${search}` },
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
