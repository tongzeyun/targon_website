import { NextResponse } from "next/server";
import { getProviderDailyQuotaStatus } from "@/lib/ai/provider-quota";
import { getJobProviderResource } from "@/lib/jobs/provider-quota-policy";
import type { JobType } from "@/lib/repositories/job-repository";

const RESOURCE_LABELS = {
  deepseek: "DeepSeek",
  iflytek_document: "讯飞文档",
  iflytek_speech: "讯飞语音",
} as const;

export async function checkJobCreationProviderQuota(
  userId: string,
  type: JobType
): Promise<NextResponse | null> {
  const resource = getJobProviderResource(type);
  if (!resource) return null;

  const status = await getProviderDailyQuotaStatus({ userId, resource });
  if (status.available) return null;

  const label = RESOURCE_LABELS[resource];
  return NextResponse.json(
    {
      error: `今日 ${label} 成功调用额度不足，每日额度为 ${status.dailyLimit} 次，将于北京时间次日 00:00 重置`,
      code: "PROVIDER_DAILY_QUOTA_EXCEEDED",
      resource,
      dailyLimit: status.dailyLimit,
      successfulCount: status.successfulCount,
      activeCount: status.activeCount,
      resetsAt: status.resetsAt,
    },
    {
      status: 429,
      headers: { "Retry-After": String(status.retryAfterSeconds) },
    }
  );
}
