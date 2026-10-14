import type { Locale } from "@/lib/locales";

// Fixed UI copy only. Business records, AI output and generated documents stay unchanged.
const zh = {
  common: {
    user: "用户", companyUnset: "未设置公司", retry: "重试", errorTitle: "出错了",
    unexpectedError: "页面加载出现意外错误", openNav: "打开导航", closeNav: "关闭导航",
    mainNav: "业务导航", mobileNav: "移动导航", tools: "文档工具",
  },
  nav: {
    dashboard: "总览", products: "产品库", accounts: "目标客户", projects: "项目跟进",
    research: "深度情报", pipeline: "销售管线", quotation: "报价单", contract: "合同制作",
    bid: "标书制作", meeting: "沟通梳理", convert: "格式转换", settings: "系统设置",
  },
  login: {
    title: "灵眸智售登录页", registerTitle: "注册账号", subtitle: "Osmo Smart Sales Login Page",
    registerSubtitle: "Create your Smart Sales Account", email: "邮箱", password: "密码",
    passwordHint: "至少 8 位", show: "显示", hide: "隐藏", showPassword: "显示密码",
    hidePassword: "隐藏密码", submit: "确认", register: "注册", processing: "处理中...",
    toRegister: "没有账号？点击注册", toLogin: "已有账号？点击登录",
    required: "请输入邮箱和密码", welcome: "欢迎回来！", registered: "注册成功！",
    failed: "操作失败", networkError: "网络错误，请重试",
    errors: {
      AUTH_INVALID_CREDENTIALS: "邮箱或密码错误", AUTH_ORIGIN_FORBIDDEN: "请求来源不被允许",
      AUTH_INVALID_REQUEST: "请求格式不正确", AUTH_VALIDATION_FAILED: "输入信息不正确",
      AUTH_EMAIL_ALREADY_REGISTERED: "该邮箱已被注册", AUTH_INTERNAL_ERROR: "服务暂时不可用，请稍后重试",
      AUTH_RATE_LIMITED: "操作过于频繁，请稍后重试",
    },
  },
  dashboard: {
    title: "总览", subtitle: "销售数据全景", accounts: "客户总数", projects: "活跃项目",
    weighted: "加权管线金额", won: "已签约金额", matched: "{count}家已匹配",
    total: "总{amount}", deals: "{count}单成交", loading: "正在加载销售数据",
  },
};

const en: typeof zh = {
  common: {
    user: "User", companyUnset: "Company not set", retry: "Retry", errorTitle: "Something went wrong",
    unexpectedError: "An unexpected error occurred while loading the page", openNav: "Open navigation",
    closeNav: "Close navigation", mainNav: "Workspace navigation", mobileNav: "Mobile navigation", tools: "Document tools",
  },
  nav: {
    dashboard: "Overview", products: "Products", accounts: "Target accounts", projects: "Projects",
    research: "Deep research", pipeline: "Sales pipeline", quotation: "Quotations", contract: "Contracts",
    bid: "Bids", meeting: "Meeting notes", convert: "Conversion", settings: "Settings",
  },
  login: {
    title: "Smart Sales Login", registerTitle: "Create an Account", subtitle: "Osmo Smart Sales Login Page",
    registerSubtitle: "Create your Smart Sales Account", email: "Email", password: "Password",
    passwordHint: "At least 8 characters", show: "Show", hide: "Hide", showPassword: "Show password",
    hidePassword: "Hide password", submit: "Sign in", register: "Register", processing: "Processing...",
    toRegister: "No account? Register", toLogin: "Already have an account? Sign in",
    required: "Enter your email and password", welcome: "Welcome back!", registered: "Registration successful!",
    failed: "The request could not be completed", networkError: "Network error. Please try again",
    errors: {
      AUTH_INVALID_CREDENTIALS: "Incorrect email or password", AUTH_ORIGIN_FORBIDDEN: "This request origin is not allowed",
      AUTH_INVALID_REQUEST: "Invalid request format", AUTH_VALIDATION_FAILED: "Check your email and password",
      AUTH_EMAIL_ALREADY_REGISTERED: "This email is already registered", AUTH_INTERNAL_ERROR: "Service temporarily unavailable. Please try again later",
      AUTH_RATE_LIMITED: "Too many requests. Please try again later",
    },
  },
  dashboard: {
    title: "Overview", subtitle: "Sales performance at a glance", accounts: "Total accounts", projects: "Active projects",
    weighted: "Weighted pipeline", won: "Closed won", matched: "{count} matched accounts",
    total: "Total {amount}", deals: "{count} closed deals", loading: "Loading sales data",
  },
};

export function getSmartEyeCopy(lang: Locale) {
  return lang === "en" ? en : zh;
}

export function formatPipelineAmount(amountInTenThousands: number, lang: Locale): string {
  const rounded = Math.round(amountInTenThousands);
  return lang === "zh"
    ? `¥${rounded.toLocaleString("zh-CN")}万`
    : new Intl.NumberFormat("en-US", {
      style: "currency", currency: "CNY", notation: "compact", maximumFractionDigits: 2,
    }).format(rounded * 10_000);
}
