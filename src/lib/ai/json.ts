/**
 * AI JSON 解析器 — 处理 DeepSeek 偶尔返回格式不完美的问题
 */

function cleanAIJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

/**
 * 严格解析完整 JSON。用于 JSON Output 场景，禁止从残缺根对象中提取内部对象。
 */
export function parseStrictAIJson(text: string): unknown {
  const clean = cleanAIJson(text);
  if (!clean) throw new Error("AI 返回了空的 JSON 内容");

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error("AI 返回的 JSON 不完整或格式无效");
  }
}

export function parseAIJson(text: string): unknown {
  // 1. 移除 markdown 代码块标记
  const clean = cleanAIJson(text);

  // 2. 尝试直接解析
  try { return JSON.parse(clean); } catch {}

  // 3. 尝试提取 JSON 数组或对象（包括截断的，且去除尾部多余文本）
  const arrayMatch = clean.match(/\[[\s\S]*?\]/) || clean.match(/\[[\s\S]*/);
  if (arrayMatch) {
    try { return fixTruncated(arrayMatch[0]); } catch {}
  }
  const objMatch = clean.match(/\{[\s\S]*?\}/) || clean.match(/\{[\s\S]*/);
  if (objMatch) {
    try { return fixTruncated(objMatch[0]); } catch {}
  }

  // 4. 逐行解析 JSONL
  const lines = clean.split("\n").filter(l => l.trim().startsWith("{"));
  for (const line of lines) {
    try { return JSON.parse(line); } catch {}
  }

  throw new Error("无法解析 AI 返回的 JSON: " + clean.slice(0, 300));
}

function fixTruncated(json: string): unknown {
  // Remove trailing commas
  json = json.replace(/,(\s*[}\]])/g, "$1");

  // Count unclosed structures
  const ob = (json.match(/\{/g) || []).length;
  const cb = (json.match(/\}/g) || []).length;
  const oa = (json.match(/\[/g) || []).length;
  const ca = (json.match(/\]/g) || []).length;

  // Close unclosed strings
  const quoteCount = (json.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) json += '"';

  // Close unclosed objects/arrays
  for (let i = cb; i < ob; i++) json += "}";
  for (let i = ca; i < oa; i++) json += "]";

  return JSON.parse(json);
}
