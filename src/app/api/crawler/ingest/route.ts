import { NextRequest, NextResponse } from "next/server";
import { createJob } from "@/lib/repositories/job-repository";

function getCrawlerConfig() {
  const apiKey = process.env.CRAWLER_API_KEY;
  const organizationId = process.env.CRAWLER_ORGANIZATION_ID;
  if (process.env.NODE_ENV === "production") {
    if (!apiKey || !organizationId) {
      throw new Error("CRAWLER_API_KEY and CRAWLER_ORGANIZATION_ID must be configured in production");
    }
    return { apiKey, organizationId };
  }
  return {
    apiKey: apiKey || "saleseye-crawler-dev-key",
    organizationId: organizationId || "org-001",
  };
}

export async function POST(req: NextRequest) {
  let config: { apiKey: string; organizationId: string };
  try {
    config = getCrawlerConfig();
  } catch {
    return NextResponse.json({ error: "Crawler configuration error" }, { status: 500 });
  }

  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== config.apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const signals =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).signals
      : undefined;

  if (!Array.isArray(signals)) {
    return NextResponse.json({ error: "signals must be an array" }, { status: 400 });
  }

  try {
    const job = await createJob({
      organizationId: config.organizationId,
      userId: "crawler",
      type: "crawler_ingest",
      payload: { signals },
      priority: 0,
    });

    return NextResponse.json(
      { success: true, queued: true, jobId: job.id, job },
      { status: 202 }
    );
  } catch (error) {
    console.error("Crawler ingest job creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create job: " + (error as Error).message },
      { status: 500 }
    );
  }
}
