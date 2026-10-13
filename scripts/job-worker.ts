import "./load-env";
import { runNextJob } from "../src/lib/jobs/worker";

const DEFAULT_POLL_MS = 5000;

function positiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const pollMs = positiveIntFromEnv("JOB_WORKER_POLL_MS", DEFAULT_POLL_MS);
const workerId = process.env.JOB_WORKER_ID || `worker-${process.pid}`;

let stopping = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("SIGINT", () => {
  stopping = true;
});

process.on("SIGTERM", () => {
  stopping = true;
});

async function main() {
  console.log(`SalesEye job worker started: ${workerId}`);
  console.log(`Polling every ${pollMs}ms`);

  while (!stopping) {
    try {
      const result = await runNextJob(workerId);
      if (result.processed) {
        console.log(`Processed job ${result.jobId}: ${result.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Job worker iteration failed: ${message}`);
    }

    await sleep(pollMs);
  }

  console.log("SalesEye job worker stopped");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
