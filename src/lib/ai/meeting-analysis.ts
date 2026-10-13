"use server";

import { ensureClient, AI_MODEL, withRetry } from "./client";
import { runAiTask, type RunAiTaskResult } from "./run-task";
import { validateCommunicationAnalysis, validateMeetingMinutes } from "./schemas/meeting";
import type { Validator } from "./schemas/types";

export interface MeetingMinutes {
  title: string;
  date: string;
  attendees: string[];
  topics: Array<{
    topic: string;
    discussion: string;
    decisions: string[];
    actions: Array<{ task: string; owner: string; deadline: string }>;
  }>;
  nextMeeting?: string;
  summary: string;
}

export interface CommunicationAnalysis {
  title: string;
  customerName: string;
  contactPerson: string;
  keyTopics: string[];
  customerNeeds: string[];
  competitiveInfo: string;
  opportunities: Array<{ description: string; priority: "high" | "medium" | "low" }>;
  risks: Array<{ description: string; mitigation: string }>;
  recommendedActions: Array<{ action: string; timing: string; expectedOutcome: string }>;
  summary: string;
}

export type AnalysisMode = "minutes" | "analysis";

export interface MeetingAnalysisResult {
  mode: AnalysisMode;
  content: MeetingMinutes | CommunicationAnalysis;
  rawText: string;
  aiRunId: string;
}

interface StructuredTaskInput<T> {
  ai: Awaited<ReturnType<typeof ensureClient>>;
  organizationId: string;
  userId: string;
  taskType: string;
  promptVersion: string;
  schemaName: string;
  systemPrompt: string;
  userPrompt: string;
  input: unknown;
  validate: Validator<T>;
  temperature: number;
  retryLabel: string;
}

const MEETING_CHUNK_MAX_CHARS = 200_000;
const MEETING_MERGE_MAX_CHARS = 200_000;
const MEETING_MAX_OUTPUT_TOKENS = 16_000;

const MINUTES_SYSTEM_PROMPT = `你是专业的会议纪要撰写专家。根据会议记录生成结构化的会议纪要。
规则：
1. 提取参会人员名单
2. 按议题归纳讨论内容
3. 明确列出决议事项
4. 列出待办任务，明确责任人和时间节点
5. 语言简洁专业`;

const ANALYSIS_SYSTEM_PROMPT = `你是专业的销售沟通分析师。从销售人员的角度分析客户沟通内容，提取商业情报和行动建议。
规则：
1. 识别客户的关键需求和痛点
2. 发现竞争情报（客户提到哪些竞品？态度如何？）
3. 判断商机优先级
4. 给出下一步具体行动建议`;

const MINUTES_OUTPUT_SCHEMA = `{
  "title": "会议纪要 - XXX会议",
  "date": "2026-06-23",
  "attendees": ["张三", "李四"],
  "topics": [
    {
      "topic": "议题标题",
      "discussion": "讨论内容摘要",
      "decisions": ["决议1", "决议2"],
      "actions": [{"task":"任务描述","owner":"负责人","deadline":"2026-07-01"}]
    }
  ],
  "nextMeeting": "下次会议时间或待定",
  "summary": "会议总结（50-100字）"
}`;

const ANALYSIS_OUTPUT_SCHEMA = `{
  "title": "客户沟通分析报告",
  "customerName": "客户公司名称",
  "contactPerson": "对接人",
  "keyTopics": ["话题1", "话题2"],
  "customerNeeds": ["需求1", "需求2"],
  "competitiveInfo": "竞品信息分析",
  "opportunities": [{"description":"商机描述","priority":"high|medium|low"}],
  "risks": [{"description":"风险描述","mitigation":"应对措施"}],
  "recommendedActions": [{"action":"行动建议","timing":"时机","expectedOutcome":"预期结果"}],
  "summary": "总体分析（100-200字）"
}`;

function splitOversizedParagraph(paragraph: string, maxChars: number): string[] {
  const chunks: string[] = [];
  for (let offset = 0; offset < paragraph.length; offset += maxChars) {
    chunks.push(paragraph.slice(offset, offset + maxChars));
  }
  return chunks;
}

function splitMeetingText(text: string, maxChars = MEETING_CHUNK_MAX_CHARS): string[] {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) => paragraph.length > maxChars
      ? splitOversizedParagraph(paragraph, maxChars)
      : [paragraph]);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = paragraph;
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text];
}

function groupForMerge<T>(items: T[], maxChars = MEETING_MERGE_MAX_CHARS): T[][] {
  const groups: T[][] = [];
  let current: T[] = [];
  let currentChars = 2;
  for (const item of items) {
    const itemChars = JSON.stringify(item).length + 1;
    if (current.length && currentChars + itemChars > maxChars) {
      groups.push(current);
      current = [];
      currentChars = 2;
    }
    current.push(item);
    currentChars += itemChars;
  }
  if (current.length) groups.push(current);
  return groups;
}

async function runStructuredTask<T>(input: StructuredTaskInput<T>): Promise<RunAiTaskResult<T>> {
  const model = AI_MODEL();
  return runAiTask<T>({
    organizationId: input.organizationId,
    userId: input.userId,
    taskType: input.taskType,
    promptVersion: input.promptVersion,
    schemaName: input.schemaName,
    model,
    provider: "deepseek",
    input: input.input,
    validate: input.validate,
    callModel: async () => {
      const response = await withRetry(
        () => input.ai.chat.completions.create({
          model,
          max_tokens: MEETING_MAX_OUTPUT_TOKENS,
          temperature: input.temperature,
          response_format: { type: "json_object" },
          ...{ thinking: { type: "disabled" as const } },
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userPrompt },
          ],
        }),
        input.retryLabel
      );
      return {
        rawOutput: response.choices[0]?.message?.content || "",
        tokenUsage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
      };
    },
  });
}

function minutesPrompt(textContent: string, chunkIndex?: number, chunkCount?: number): string {
  const chunkContext = chunkIndex != null && chunkCount != null
    ? `这是完整会议记录的第 ${chunkIndex + 1}/${chunkCount} 段，只提取本段明确出现的信息，不要推测其他分段。\n\n`
    : "";
  return `${chunkContext}## 会议记录
${textContent}

## 任务
生成结构化会议纪要，返回 JSON：
${MINUTES_OUTPUT_SCHEMA}
只返回 JSON。`;
}

function analysisPrompt(textContent: string, chunkIndex?: number, chunkCount?: number): string {
  const chunkContext = chunkIndex != null && chunkCount != null
    ? `这是完整沟通记录的第 ${chunkIndex + 1}/${chunkCount} 段，只分析本段明确出现的信息，不要推测其他分段。\n\n`
    : "";
  return `${chunkContext}## 沟通内容
${textContent}

## 任务
进行销售沟通分析，返回 JSON：
${ANALYSIS_OUTPUT_SCHEMA}
只返回 JSON。`;
}

async function analyzeMinutesChunk(
  ai: Awaited<ReturnType<typeof ensureClient>>,
  textContent: string,
  organizationId: string,
  userId: string,
  chunkIndex?: number,
  chunkCount?: number
): Promise<RunAiTaskResult<MeetingMinutes>> {
  return runStructuredTask({
    ai,
    organizationId,
    userId,
    taskType: chunkCount ? "meeting_minutes_chunk" : "meeting_minutes",
    promptVersion: chunkCount ? "meeting-minutes-chunk:v2" : "meeting-minutes:v2",
    schemaName: "meeting_minutes",
    systemPrompt: MINUTES_SYSTEM_PROMPT,
    userPrompt: minutesPrompt(textContent, chunkIndex, chunkCount),
    input: { textContent, chunkIndex, chunkCount },
    validate: validateMeetingMinutes<MeetingMinutes>,
    temperature: 0.2,
    retryLabel: "meeting-minutes",
  });
}

async function analyzeCommunicationChunk(
  ai: Awaited<ReturnType<typeof ensureClient>>,
  textContent: string,
  organizationId: string,
  userId: string,
  chunkIndex?: number,
  chunkCount?: number
): Promise<RunAiTaskResult<CommunicationAnalysis>> {
  return runStructuredTask({
    ai,
    organizationId,
    userId,
    taskType: chunkCount ? "meeting_analysis_chunk" : "meeting_analysis",
    promptVersion: chunkCount ? "meeting-analysis-chunk:v2" : "meeting-analysis:v2",
    schemaName: "communication_analysis",
    systemPrompt: ANALYSIS_SYSTEM_PROMPT,
    userPrompt: analysisPrompt(textContent, chunkIndex, chunkCount),
    input: { textContent, chunkIndex, chunkCount },
    validate: validateCommunicationAnalysis<CommunicationAnalysis>,
    temperature: 0.3,
    retryLabel: "meeting-analysis",
  });
}

async function mergeMinutes(
  ai: Awaited<ReturnType<typeof ensureClient>>,
  contents: MeetingMinutes[],
  organizationId: string,
  userId: string,
  level: number
): Promise<RunAiTaskResult<MeetingMinutes>> {
  const userPrompt = `## 分段会议纪要
${JSON.stringify(contents)}

## 任务
合并为一份完整会议纪要。去重但不得遗漏各段明确出现的议题、决议和待办，不得编造。返回 JSON：
${MINUTES_OUTPUT_SCHEMA}
只返回 JSON。`;
  return runStructuredTask({
    ai,
    organizationId,
    userId,
    taskType: "meeting_minutes_merge",
    promptVersion: "meeting-minutes-merge:v2",
    schemaName: "meeting_minutes",
    systemPrompt: MINUTES_SYSTEM_PROMPT,
    userPrompt,
    input: { level, contents },
    validate: validateMeetingMinutes<MeetingMinutes>,
    temperature: 0.2,
    retryLabel: "meeting-minutes-merge",
  });
}

async function mergeCommunicationAnalysis(
  ai: Awaited<ReturnType<typeof ensureClient>>,
  contents: CommunicationAnalysis[],
  organizationId: string,
  userId: string,
  level: number
): Promise<RunAiTaskResult<CommunicationAnalysis>> {
  const userPrompt = `## 分段沟通分析
${JSON.stringify(contents)}

## 任务
合并为一份完整销售沟通分析。合并重复信息，保留各段明确出现的需求、态度、竞品、风险、商机和行动建议，不得编造。返回 JSON：
${ANALYSIS_OUTPUT_SCHEMA}
只返回 JSON。`;
  return runStructuredTask({
    ai,
    organizationId,
    userId,
    taskType: "meeting_analysis_merge",
    promptVersion: "meeting-analysis-merge:v2",
    schemaName: "communication_analysis",
    systemPrompt: ANALYSIS_SYSTEM_PROMPT,
    userPrompt,
    input: { level, contents },
    validate: validateCommunicationAnalysis<CommunicationAnalysis>,
    temperature: 0.3,
    retryLabel: "meeting-analysis-merge",
  });
}

async function reduceMinutes(
  ai: Awaited<ReturnType<typeof ensureClient>>,
  initial: RunAiTaskResult<MeetingMinutes>[],
  organizationId: string,
  userId: string
): Promise<RunAiTaskResult<MeetingMinutes>> {
  let results = initial;
  let level = 1;
  while (results.length > 1) {
    const next: RunAiTaskResult<MeetingMinutes>[] = [];
    for (const group of groupForMerge(results.map((result) => result.data))) {
      if (group.length === 1 && results.length > 1) {
        const existing = results.find((result) => result.data === group[0]);
        if (existing) next.push(existing);
      } else {
        next.push(await mergeMinutes(ai, group, organizationId, userId, level));
      }
    }
    results = next;
    level += 1;
  }
  return results[0];
}

async function reduceCommunicationAnalysis(
  ai: Awaited<ReturnType<typeof ensureClient>>,
  initial: RunAiTaskResult<CommunicationAnalysis>[],
  organizationId: string,
  userId: string
): Promise<RunAiTaskResult<CommunicationAnalysis>> {
  let results = initial;
  let level = 1;
  while (results.length > 1) {
    const next: RunAiTaskResult<CommunicationAnalysis>[] = [];
    for (const group of groupForMerge(results.map((result) => result.data))) {
      if (group.length === 1 && results.length > 1) {
        const existing = results.find((result) => result.data === group[0]);
        if (existing) next.push(existing);
      } else {
        next.push(await mergeCommunicationAnalysis(ai, group, organizationId, userId, level));
      }
    }
    results = next;
    level += 1;
  }
  return results[0];
}

export async function analyzeMeeting(
  textContent: string,
  mode: AnalysisMode,
  organizationId: string,
  userId: string
): Promise<MeetingAnalysisResult> {
  const ai = await ensureClient();
  const chunks = splitMeetingText(textContent);

  if (mode === "minutes") {
    const partials: RunAiTaskResult<MeetingMinutes>[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      partials.push(await analyzeMinutesChunk(
        ai,
        chunks[index],
        organizationId,
        userId,
        chunks.length > 1 ? index : undefined,
        chunks.length > 1 ? chunks.length : undefined
      ));
    }
    const result = await reduceMinutes(ai, partials, organizationId, userId);
    return { mode, content: result.data, rawText: result.rawOutput, aiRunId: result.aiRunId };
  }

  const partials: RunAiTaskResult<CommunicationAnalysis>[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    partials.push(await analyzeCommunicationChunk(
      ai,
      chunks[index],
      organizationId,
      userId,
      chunks.length > 1 ? index : undefined,
      chunks.length > 1 ? chunks.length : undefined
    ));
  }
  const result = await reduceCommunicationAnalysis(ai, partials, organizationId, userId);
  return { mode, content: result.data, rawText: result.rawOutput, aiRunId: result.aiRunId };
}
