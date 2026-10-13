import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api/auth";
import { runNextJob } from "@/lib/jobs/worker";

const DEV_WORKER_KEY = "saleseye-worker-dev-key";

function getExpectedWorkerKey(): string | null {
  const key = process.env.JOB_WORKER_KEY;
  if (key) return key;
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    return DEV_WORKER_KEY;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const expectedKey = getExpectedWorkerKey();
  if (!expectedKey) return errorResponse("JOB_WORKER_KEY is required outside development/test", 500);

  const workerKey = req.headers.get("x-worker-key");
  if (workerKey !== expectedKey) return errorResponse("Invalid worker key", 401);

  const result = await runNextJob();
  return jsonResponse(result);
}
