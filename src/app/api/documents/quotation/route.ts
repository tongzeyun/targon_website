/**
 * 报价单 API
 * POST /api/documents/quotation
 *
 * JSON body 模式：
 * 1. { mode: "fill-form", requirements: "..." } → AI 填充返回 QuotationData
 * 2. { mode: "generate-job", data: QuotationData } → 创建 document_generate_quotation job (202)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthOrg, errorResponse } from "@/lib/api/auth";
import { ensureClient, AI_MODEL, withRetry } from "@/lib/ai/client";
import { runAiTask } from "@/lib/ai/run-task";
import { validateQuotationForm } from "@/lib/ai/schemas/document";
import { QuotationData } from "@/lib/document/quotation-template";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { createJob } from "@/lib/repositories/job-repository";
import { ProviderQuotaExceededError } from "@/lib/ai/provider-quota";

const SYNC_DOWNLOAD_REMOVED =
  "Synchronous document download is no longer supported. Create a document job instead.";

function getDocumentJobTraceFields(body: Record<string, unknown>) {
  const pick = (key: string) =>
    typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null;
  return { templateId: pick("templateId"), aiRunId: pick("aiRunId") };
}

export async function POST(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const rateLimit = checkRateLimit(auth.userId, RATE_LIMITS.document);
  if (rateLimit) return rateLimit;

  try {
    const body = await req.json();
    const mode = typeof body.mode === "string" ? body.mode : undefined;

    if (mode === "download") {
      return errorResponse(SYNC_DOWNLOAD_REMOVED, 410);
    }

    if (mode === "fill-form") {
      const requirements = body.requirements || "";
      if (!requirements.trim()) return errorResponse("请输入需求描述");

      const ai = await ensureClient();
      const model = AI_MODEL();
      const systemPrompt = `你是报价单填写专家。根据用户需求描述，提取信息填充报价单字段。返回纯JSON。
字段说明：
- sellerCompany: 卖方（我方）公司
- buyerCompany: 买方（客户）公司
- buyerContact/buyerPhone: 客户联系人信息
- items: 产品列表 [{name, spec, unit, quantity, unitPrice}]，单价格式"¥28.5万/台"
- subtotal: 小计，taxRate: 税率如"13%"，totalAmount: 含税总价
- totalAmountCN: 中文大写金额，如"叁拾贰万柒仟元整"
- deliveryTime: 交货时间，paymentTerms: 付款方式，warranty: 质保期
- 不确定的字段留空`;
      const userPrompt = `客户需求：${requirements}\n\n请提取报价信息，返回完整JSON。`;
      const result = await runAiTask<Record<string, unknown>>({
        organizationId: auth.organizationId,
        userId: auth.userId,
        taskType: "fill_quotation_form",
        promptVersion: "fill-quotation-form:v1",
        schemaName: "quotation_data",
        model,
        provider: "deepseek",
        input: { requirements, systemPrompt, userPrompt },
        validate: validateQuotationForm,
        callModel: async () => {
          const response = await withRetry(() =>
            ai.chat.completions.create({
              model, max_tokens: 3000, temperature: 0.2,
              ...{ thinking: { type: "disabled" as const } },
              messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            }),
            "fill-quotation"
          );
          return { rawOutput: response.choices[0]?.message?.content || "", tokenUsage: response.usage };
        },
      });
      return NextResponse.json({ ...result.data, aiRunId: result.aiRunId });
    }

    if (mode === "generate-job") {
      const data = body.data as QuotationData;
      if (!data || !data.sellerCompany) return errorResponse("请填写卖方公司信息");
      const trace = getDocumentJobTraceFields(body as Record<string, unknown>);
      const job = await createJob({
        organizationId: auth.organizationId,
        userId: auth.userId,
        type: "document_generate_quotation",
        payload: { data, format: "docx", ...trace },
        priority: 0,
      });
      return NextResponse.json({ jobId: job.id, job, queued: true }, { status: 202 });
    }

    return errorResponse("未知模式");
  } catch (error) {
    if (error instanceof ProviderQuotaExceededError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    console.error("报价单处理失败:", error);
    return errorResponse("处理失败: " + (error as Error).message, 500);
  }
}
