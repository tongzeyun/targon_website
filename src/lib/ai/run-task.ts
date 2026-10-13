import {
  completeAiRun,
  createAiRun,
  failAiRun,
  type AiValidationStatus,
} from "@/lib/repositories/ai-run-repository";
import { parseAIJson, parseStrictAIJson } from "./json";
import type { Validator } from "./schemas/types";
import { withProviderQuota } from "./provider-quota";

interface RunAiTaskInput<T> {
  organizationId: string;
  userId: string;
  jobId?: string | null;
  taskType: string;
  promptVersion: string;
  schemaName: string;
  model: string;
  provider: string;
  input: unknown;
  callModel: () => Promise<{
    rawOutput: string;
    tokenUsage?: unknown;
    finishReason?: string | null;
  }>;
  validate: Validator<T>;
  parseMode?: "lenient" | "strict";
}

export interface RunAiTaskResult<T> {
  aiRunId: string;
  data: T;
  rawOutput: string;
}

export async function runAiTask<T>(input: RunAiTaskInput<T>): Promise<RunAiTaskResult<T>> {
  const startedAt = Date.now();
  const aiRunId = await createAiRun({
    organizationId: input.organizationId,
    userId: input.userId,
    taskType: input.taskType,
    promptVersion: input.promptVersion,
    schemaName: input.schemaName,
    model: input.model,
    provider: input.provider,
    input: input.input,
  });

  let rawOutput = "";
  let parsed: unknown;
  let tokenUsage: unknown;
  let finishReason: string | null | undefined;

  try {
    const modelResult = await withProviderQuota(
      {
        userId: input.userId,
        resource: "deepseek",
        operation: input.taskType,
        jobId: input.jobId,
        aiRunId,
      },
      input.callModel
    );
    rawOutput = modelResult.rawOutput;
    finishReason = modelResult.finishReason;
    tokenUsage = finishReason && modelResult.tokenUsage && typeof modelResult.tokenUsage === "object"
      ? { ...modelResult.tokenUsage, finish_reason: finishReason }
      : modelResult.tokenUsage;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failAiRun(aiRunId, {
      validationStatus: "error",
      validationErrors: [message],
      latencyMs: Date.now() - startedAt,
      tokenUsage,
      errorMessage: message,
    });
    throw error;
  }

  if (finishReason === "length") {
    const message = "AI 输出达到单次生成长度上限，返回内容不完整；请上传更精简的文件后重试";
    await failAiRun(aiRunId, {
      rawOutput,
      validationStatus: "parse_error",
      validationErrors: [message],
      latencyMs: Date.now() - startedAt,
      tokenUsage,
      errorMessage: message,
    });
    throw new Error(message);
  }

  try {
    parsed = input.parseMode === "strict"
      ? parseStrictAIJson(rawOutput)
      : parseAIJson(rawOutput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failAiRun(aiRunId, {
      rawOutput,
      validationStatus: "parse_error",
      validationErrors: [message],
      latencyMs: Date.now() - startedAt,
      tokenUsage,
      errorMessage: message,
    });
    throw error;
  }

  const validation = input.validate(parsed);
  const validationStatus: AiValidationStatus = validation.success ? "valid" : "invalid";
  await completeAiRun(aiRunId, {
    rawOutput,
    parsedOutput: parsed,
    validationStatus,
    validationErrors: validation.errors,
    latencyMs: Date.now() - startedAt,
    tokenUsage,
  });

  if (!validation.success || !validation.data) {
    throw new Error(`AI 输出 Schema 校验失败: ${validation.errors.join("; ")}`);
  }

  return { aiRunId, data: validation.data, rawOutput };
}
