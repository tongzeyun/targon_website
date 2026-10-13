"use server";

import { AI_MODEL, ensureClient, withRetry } from "./client";
import { runAiTask } from "./run-task";
import { validateBidTemplateSemanticMap } from "./schemas/bid-template";
import type {
  BidTemplateRegion,
  BidTemplateSemanticMap,
  RawBidTemplateDocument,
} from "@/lib/document/bid-template-model";

const TEMPLATE_AI_MAX_TOKENS = 24_000;
const BID_AI_TIMEOUT_MS = 300_000;

function promptNodes(document: RawBidTemplateDocument, candidate: BidTemplateRegion | null) {
  if (!candidate) return document.nodes;
  const start = document.nodes.findIndex((node) => node.nodeId === candidate.startNodeId);
  const end = document.nodes.findIndex((node) => node.nodeId === candidate.endNodeId);
  return start >= 0 && end >= start ? document.nodes.slice(start, end + 1) : document.nodes;
}

export async function analyzeBidTemplateSemantics(input: {
  document: RawBidTemplateDocument;
  candidateRegion: BidTemplateRegion | null;
  organizationId: string;
  userId: string;
  jobId: string;
}): Promise<{ data: BidTemplateSemanticMap; aiRunId: string }> {
  const ai = await ensureClient();
  const model = AI_MODEL();
  const nodes = promptNodes(input.document, input.candidateRegion);
  const fixedRegion = input.document.source === "separate_upload" && nodes.length
    ? { startNodeId: nodes[0].nodeId, endNodeId: nodes[nodes.length - 1].nodeId }
    : input.candidateRegion;
  const prompt = `你是投标模板语义标注器。后端已经从 DOCX 中提取了有序节点，节点 ID、顺序和表格结构是唯一权威来源。

## 任务
1. 识别模板区域。独立模板必须使用给定全部节点；内嵌模板有候选区域时只能在候选范围内收紧起止节点，没有候选区域时检查全部节点；确实没有内嵌模板则返回空数组。
2. 为已有节点标注语义：section_heading、static_text、field、generated_paragraph、table、instruction。
3. 对 field/generated_paragraph 提供 label、description、valueType、sourcePolicy、required。
4. 对 table 的每个已有 columnId 提供 label、description、valueType、sourcePolicy、required。

## 强约束
- 只能引用输入中存在的 nodeId 和 columnId。
- 不得创建、删除、重排节点，不得改变表格行列。
- 签字、签名、盖章必须是 manual。
- 报价、单价、总价、保证金默认 manual。
- 企业资质、人员、业绩只能来自 company。
- 招标编号、项目名称、技术要求等客观事实来自 tender。
- 需要撰写的方案正文使用 generated。
- 不输出 confidence。
- 只返回 JSON。

## 建议模板区域
${JSON.stringify(fixedRegion)}

## 后端原始节点
${JSON.stringify(nodes)}

## 输出格式
{
  "templateRegions": [{"startNodeId":"p-0001","endNodeId":"p-0100"}],
  "nodeSemantics": {
    "p-0001": {"role":"section_heading","title":"投标函"},
    "p-0002": {"role":"field","label":"投标人名称","description":"投标企业全称","valueType":"string","sourcePolicy":"company_or_manual","required":true},
    "t-0001": {"role":"table","title":"投标一览表","columns":{"t-0001:c-01":{"label":"货物名称","description":"拟投货物名称","valueType":"string","sourcePolicy":"tender","required":true}}}
  }
}`;

  const result = await runAiTask<BidTemplateSemanticMap>({
    organizationId: input.organizationId,
    userId: input.userId,
    jobId: input.jobId,
    taskType: "analyze_bid_template_semantics",
    promptVersion: "bid-template-semantic:v1",
    schemaName: "bid_template_semantic_map",
    model,
    provider: "deepseek",
    parseMode: "strict",
    input: { source: input.document.source, candidateRegion: fixedRegion, nodes },
    validate: validateBidTemplateSemanticMap,
    callModel: async () => {
      const response = await withRetry(
        () => ai.chat.completions.create({
          model,
          max_tokens: TEMPLATE_AI_MAX_TOKENS,
          response_format: { type: "json_object" },
          ...{ thinking: { type: "disabled" as const } },
          messages: [
            { role: "system", content: "你只标注后端已有模板节点的语义，不得生成或修改模板结构。输出合法 JSON。" },
            { role: "user", content: prompt },
          ],
        }, { timeout: BID_AI_TIMEOUT_MS }),
        "bid-template-analyze"
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
