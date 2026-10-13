"use server";

import { AI_MODEL, ensureClient, withRetry } from "./client";
import { runAiTask } from "./run-task";
import { validateBidFillResult } from "./schemas/bid-template";
import type { BidFillContract, BidFillResult } from "@/lib/document/bid-template-model";

const BID_AI_MAX_TOKENS = 48_000;
const BID_AI_TIMEOUT_MS = 300_000;

export async function fillBidTemplateContent(input: {
  tenderText: string;
  companyInfo: string;
  contract: BidFillContract;
  organizationId: string;
  userId: string;
  jobId: string;
}): Promise<{ data: BidFillResult; aiRunId: string }> {
  const ai = await ensureClient();
  const model = AI_MODEL();
  const prompt = `你是投标文件内容提取与填写工具。后端已经确定完整模板结构，你只按给定动态 KV 契约返回值。

## 招标文件正文
${input.tenderText}

## 企业信息
${input.companyInfo || "未提供"}

## 动态 KV 契约
${JSON.stringify(input.contract)}

## 填写规则
1. 输出只能包含 values 和 tables，不得返回 sections、blocks、columns 或任何模板结构。
2. key 必须与动态契约完全一致，不得新增 key。
3. 无法确定的值返回 null，不得编造。
4. sourcePolicy=manual、calculated、template 的字段必须返回 null。
5. sourcePolicy=tender 只能从招标正文提取。
6. sourcePolicy=company/company_or_manual 只能从企业信息提取，未提供则返回 null。
7. sourcePolicy=tender_or_company 只能使用招标正文或已提供的企业信息，不得补充外部事实。
8. sourcePolicy=generated 可以根据招标要求和企业信息生成正文，但不得编造资质、报价、人员、业绩、签字和盖章。
9. 表格行数根据招标正文中的实际货物、技术要求或商务条款确定；没有内容时返回空数组。
10. 不输出 confidence，只返回合法 JSON。

## 输出格式
{
  "values": {
    "meta.projectName": "项目名称",
    "field:p-0002": null
  },
  "tables": {
    "table:t-0001": [
      {"t-0001:c-01": "货物名称", "t-0001:c-02": null}
    ]
  }
}`;

  const result = await runAiTask<BidFillResult>({
    organizationId: input.organizationId,
    userId: input.userId,
    jobId: input.jobId,
    taskType: "fill_bid_template_content",
    promptVersion: "bid-template-fill:v1",
    schemaName: "bid_fill_result",
    model,
    provider: "deepseek",
    parseMode: "strict",
    input: { tenderText: input.tenderText, companyInfo: input.companyInfo, contract: input.contract },
    validate: validateBidFillResult,
    callModel: async () => {
      const response = await withRetry(
        () => ai.chat.completions.create({
          model,
          max_tokens: BID_AI_MAX_TOKENS,
          response_format: { type: "json_object" },
          ...{ thinking: { type: "disabled" as const } },
          messages: [
            { role: "system", content: "你只返回后端动态契约要求的 KV 值，不得生成模板结构。输出合法 JSON。" },
            { role: "user", content: prompt },
          ],
        }, { timeout: BID_AI_TIMEOUT_MS }),
        "bid-content-fill"
      );
      return {
        rawOutput: response.choices[0]?.message?.content || "",
        tokenUsage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
      };
    },
  });
  return { data: result.data, aiRunId: result.aiRunId };
}
