"use client";

import { useUiText } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-ui-text";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/badge";
import { ApiResponseError, createApiResponseError } from "@/lib/api/api-error";
import {
  AuthRefreshUnavailableError,
  authenticatedFetch,
} from "@/lib/api/authenticated-fetch";
import { cn } from "@/lib/utils";

export type JobStatusProps = {
  jobId: string;
  onDone?: (job: unknown) => void;
};

interface JobData {
  status: string;
  progress?: number;
  currentStep?: string | null;
  errorMessage?: string | null;
  resultJson?: unknown;
}

interface JobPollResponse {
  job: JobData;
  done: boolean;
  ok: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  queued: "排队中",
  running: "执行中",
  succeeded: "已完成",
  failed: "失败",
  canceled: "已取消",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "secondary",
  running: "default",
  succeeded: "default",
  failed: "destructive",
  canceled: "outline",
};

/** Final 401 after refresh → stop polling; temporary refresh issues may retry. */
export function shouldContinueJobPoll(error: unknown): boolean {
  if (error instanceof ApiResponseError && error.status === 401) {
    return false;
  }
  return true;
}

async function fetchJob(jobId: string): Promise<JobPollResponse> {
  const res = await authenticatedFetch(`/api/jobs/${jobId}`);
  if (!res.ok) {
    throw await createApiResponseError(res, `HTTP ${res.status}`);
  }
  return res.json();
}

export function JobStatus({ jobId, onDone }: JobStatusProps) {
  const uiText = useUiText();
  const [job, setJob] = useState<JobData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onDoneRef = useRef(onDone);
  const doneCalledRef = useRef(false);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (!active) return;
      try {
        const data = await fetchJob(jobId);
        if (!active) return;
        setJob(data.job);
        setError(null);

        if (data.done) {
          if (!doneCalledRef.current) {
            doneCalledRef.current = true;
            onDoneRef.current?.(data.job);
          }
          return;
        }

        timer = setTimeout(poll, 2000);
      } catch (e) {
        if (!active) return;
        const message =
          e instanceof AuthRefreshUnavailableError
            ? e.message
            : e instanceof Error
              ? e.message
              : "请求失败";
        setError(message);
        if (shouldContinueJobPoll(e)) {
          timer = setTimeout(poll, 2000);
        }
      }
    }

    doneCalledRef.current = false;
    poll();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  if (!job && !error) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>{uiText("加载任务状态…")}</span>
      </div>
    );
  }

  const status = job?.status ?? "queued";
  const label = STATUS_LABEL[status] ?? status;
  const variant = STATUS_VARIANT[status] ?? "outline";
  const isActive = status === "queued" || status === "running";

  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-center gap-2">
        {isActive && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
        <Badge variant={variant}>{uiText(label)}</Badge>
        {status === "running" && typeof job?.progress === "number" && (
          <span className="text-muted-foreground">{job.progress}%</span>
        )}
      </div>
      {status === "running" && job?.currentStep && (
        <p className="text-muted-foreground">{uiText(job.currentStep)}</p>
      )}
      {status === "failed" && job?.errorMessage && (
        <p className="text-destructive">{uiText(job.errorMessage)}</p>
      )}
      {error && (
        <p className={cn("text-muted-foreground", !job && "text-destructive")}>
          {uiText(error)}
        </p>
      )}
    </div>
  );
}
