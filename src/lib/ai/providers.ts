/**
 * AI 模型提供商配置
 *
 * 支持 DeepSeek、OpenAI、Anthropic 三家。
 * 通过 app_settings 表存储用户选择的提供商和 API Key。
 */

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  models: {
    fast: string;      // 日常任务（提取、分类、过滤）
    reasoning: string; // 深度推理（发现、匹配、研究）
  };
  website: string;
  apiKeyUrl: string;
  pricing: string;
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: { fast: "deepseek-v4-pro", reasoning: "deepseek-v4-pro" },
    website: "https://platform.deepseek.com",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    pricing: "DeepSeek V4 Pro",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: { fast: "gpt-4o-mini", reasoning: "gpt-4o" },
    website: "https://platform.openai.com",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    pricing: "GPT-4o mini: $0.15/百万tokens · GPT-4o: $2.50/百万tokens",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    // 注意：Anthropic API 格式与 OpenAI 不兼容，直接使用 openai 包调用此 baseUrl 会失败。
    // 切换到 Anthropic 提供商需额外安装 @anthropic-ai/sdk 并在 client.ts 中实现适配层。
    baseUrl: "https://api.anthropic.com/v1",
    models: { fast: "claude-haiku-4-5-20251001", reasoning: "claude-sonnet-4-6" },
    website: "https://console.anthropic.com",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    pricing: "Haiku: $1/百万tokens · Sonnet: $3/百万tokens",
  },
};

export const DEFAULT_PROVIDER = "deepseek";

export function getProvider(id: string): ProviderConfig {
  return PROVIDERS[id] || PROVIDERS[DEFAULT_PROVIDER];
}
