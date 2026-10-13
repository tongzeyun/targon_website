import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFileStorageDescriptor } from "@/lib/storage/file-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.queryOne<{ ok: number }>("SELECT 1 AS ok");
    const storage = getFileStorageDescriptor();

    return NextResponse.json(
      {
        status: "ready",
        database: "ok",
        storage: storage.driver,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Readiness check failed:", error);
    return NextResponse.json(
      { status: "not_ready" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
