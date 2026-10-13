/**
 * 合同 API — JSON body 模式
 * POST /api/documents/contract
 * { mode: "fill-form", requirements } → AI 填充
 * { mode: "generate-job", data } → 创建 document_generate_contract job (202)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthOrg, errorResponse } from "@/lib/api/auth";
import { ensureClient, AI_MODEL, withRetry } from "@/lib/ai/client";
import { runAiTask } from "@/lib/ai/run-task";
import { validateContractForm } from "@/lib/ai/schemas/document";
import { ContractData } from "@/lib/document/contract-template";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { createJob } from "@/lib/repositories/job-repository";
import { ProviderQuotaExceededError } from "@/lib/ai/provider-quota";
import {
  calculateContractAmounts,
  formatContractCurrency,
  parseContractTaxRate,
} from "@/lib/document/contract-amounts";

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
      if (!requirements.trim()) return errorResponse("请输入合同要点");

      const ai = await ensureClient();
      const model = AI_MODEL();
      const systemPrompt = `你是合同填写专家。根据用户描述提取信息填充销售合同字段。返回纯JSON：
{ partyA, partyAAddress, partyAContact, partyAPhone, partyB, partyBAddress, partyBContact, partyBPhone,
  contractNo, productName, productSpec, quantity, unitPrice, subtotal, taxRate, taxAmount, totalAmount, totalAmountCN,
  deliveryTime, deliveryPlace, paymentTerms, warranty, penaltyClause, disputeResolution, validUntil, remarks }
单价为未税单价；taxRate 格式如"13%"；subtotal 为未税金额；taxAmount 为税额；totalAmount 为含税总金额。
不确定的字段留空。`;
      const userPrompt = `合同要点：${requirements}\n\n请提取并返回JSON。`;
      const result = await runAiTask<Record<string, unknown>>({
        organizationId: auth.organizationId,
        userId: auth.userId,
        taskType: "fill_contract_form",
        promptVersion: "fill-contract-form:v1",
        schemaName: "contract_data",
        model,
        provider: "deepseek",
        input: { requirements, systemPrompt, userPrompt },
        validate: validateContractForm,
        callModel: async () => {
          const response = await withRetry(() =>
            ai.chat.completions.create({
              model, max_tokens: 3000, temperature: 0.2,
              ...{ thinking: { type: "disabled" as const } },
              messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            }),
            "fill-contract"
          );
          return { rawOutput: response.choices[0]?.message?.content || "", tokenUsage: response.usage };
        },
      });
      return NextResponse.json({ ...result.data, aiRunId: result.aiRunId });
    }

    if (mode === "generate-job") {
      const submittedData = body.data as ContractData;
      if (!submittedData || !submittedData.partyB) return errorResponse("请填写乙方（卖方）信息");
      if (parseContractTaxRate(submittedData.taxRate) === null) {
        return errorResponse("税率必须是 0% 到 100% 之间的有效数值");
      }
      const amounts = calculateContractAmounts(submittedData);
      const data: ContractData = {
        ...submittedData,
        subtotal: formatContractCurrency(amounts.subtotal),
        taxAmount: formatContractCurrency(amounts.taxAmount),
        totalAmount: formatContractCurrency(amounts.totalAmount),
      };
      const trace = getDocumentJobTraceFields(body as Record<string, unknown>);
      const job = await createJob({
        organizationId: auth.organizationId,
        userId: auth.userId,
        type: "document_generate_contract",
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
    console.error("合同处理失败:", error);
    return errorResponse("处理失败: " + (error as Error).message, 500);
  }
}
