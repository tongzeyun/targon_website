export const CHINA_MAINLAND_PROVINCES = [
  "北京",
  "天津",
  "河北",
  "山西",
  "内蒙古",
  "辽宁",
  "吉林",
  "黑龙江",
  "上海",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "湖北",
  "湖南",
  "广东",
  "广西",
  "海南",
  "重庆",
  "四川",
  "贵州",
  "云南",
  "西藏",
  "陕西",
  "甘肃",
  "青海",
  "宁夏",
  "新疆",
] as const;

export interface DeepResearchFilters {
  industry?: string;
  province?: string;
}

interface FilterableAccount {
  industry?: string;
  province?: string;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function normalizeProvince(value: string): string {
  return normalizeText(value).replace(
    /(壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区|省|市)$/u,
    ""
  );
}

export function getProductTargetIndustries(value: unknown): string[] {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value.split(/[,，、]/u);
    }
  }

  if (!Array.isArray(parsed)) return [];

  return [...new Set(
    parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

export function isChinaMainlandProvince(value: string): boolean {
  const normalized = normalizeProvince(value);
  return CHINA_MAINLAND_PROVINCES.some((province) => normalizeProvince(province) === normalized);
}

export function filterDeepResearchAccounts<T extends FilterableAccount>(
  accounts: T[],
  filters: DeepResearchFilters
): T[] {
  const industry = filters.industry ? normalizeText(filters.industry) : "";
  const province = filters.province ? normalizeProvince(filters.province) : "";

  return accounts.filter((account) => {
    const matchesIndustry = !industry || (
      typeof account.industry === "string" && normalizeText(account.industry) === industry
    );
    const matchesProvince = !province || (
      typeof account.province === "string" && normalizeProvince(account.province) === province
    );
    return matchesIndustry && matchesProvince;
  });
}
