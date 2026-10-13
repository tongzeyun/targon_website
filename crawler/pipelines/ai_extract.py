"""AI 结构化提取管线

从爬取的 HTML 中提取结构化商机信息
使用 DeepSeek API（OpenAI 兼容接口）
"""

import json
import os
from typing import Optional
from openai import OpenAI
from rich.console import Console

console = Console()

# DeepSeek 配置
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
AI_MODEL = os.getenv("AI_MODEL", "deepseek-chat")
AI_REASONER_MODEL = "deepseek-reasoner"


class AIExtractionPipeline:
    """AI 提取管线（使用 DeepSeek）"""

    def __init__(self, api_key: str = None, base_url: str = None):
        self.client = OpenAI(
            api_key=api_key or DEEPSEEK_API_KEY,
            base_url=base_url or DEEPSEEK_BASE_URL,
        )

    def _chat(self, system_prompt: str, user_prompt: str, model: str = None, max_tokens: int = 4000) -> str:
        """发送聊天请求，返回文本内容"""
        response = self.client.chat.completions.create(
            model=model or AI_MODEL,
            max_tokens=max_tokens,
            temperature=0.1,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.choices[0].message.content or ""

    def _extract_json(self, text: str) -> dict:
        """从 AI 响应中提取 JSON"""
        # 清理可能的 markdown 代码块
        text = text.replace("```json", "").replace("```", "").strip()
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
        return {"confidence_score": 0, "error": "No JSON found in response"}

    def extract_bid_info(self, html_content: str, source_url: str, source_name: str) -> dict:
        """从招标公告网页提取结构化信息"""
        system_prompt = """你是一个招标信息提取专家。从网页内容中提取结构化的招标/项目信息。
只提取客观存在的信息，不要推断或编造。如果某个字段无法确定，使用 null。"""

        user_prompt = f"""## 数据来源
- 网站名称: {source_name}
- 页面URL: {source_url}

## 网页内容
{html_content[:15000]}

## 提取要求
提取以下结构化信息，返回纯 JSON（不要markdown标记）：

{{
  "project_name": "项目名称",
  "bid_number": "招标编号或 null",
  "budget_amount": "预算金额或 null",
  "submission_deadline": "投标截止日期 ISO格式或 null",
  "buyer_name": "采购单位名称或 null",
  "buyer_contact": {{
    "name": "联系人姓名或 null",
    "phone": "联系电话或 null",
    "email": "联系邮箱或 null"
  }},
  "requirements": "采购需求摘要或 null",
  "eligibility_criteria": ["资格要求1"],
  "location": "项目所在地或 null",
  "industry": "半导体/面板/光伏/科研/LED/其他",
  "confidence_score": 85
}}"""

        try:
            text = self._chat(system_prompt, user_prompt)
            return self._extract_json(text)
        except Exception as e:
            console.log(f"[red]AI 提取失败: {e}[/red]")
            return {"confidence_score": 0, "error": str(e)}

    def classify_signal(self, html_content: str, source_url: str, source_name: str) -> dict:
        """对非招标网页进行信号分类和提取"""
        system_prompt = """你是一个商业情报分析师，专注于中国半导体和高科技制造行业。
判断网页是否包含以下类型的项目信号：
- eia: 环评公示（环境影响评价，最早的项目信号）
- land: 土地成交（买地 → 建厂/扩产）
- approval: 发改委立项（项目正式获批）
- planning: 规划公示
- company_change: 企业工商变更
- recruitment: 招聘信息
- news: 行业新闻

返回纯 JSON，不要 markdown 标记。"""

        user_prompt = f"""## 数据来源
- 网站名称: {source_name}
- 页面URL: {source_url}

## 网页内容
{html_content[:15000]}

## 分析要求
判断内容是否与半导体/面板/光伏/科研行业相关，返回 JSON：

{{
  "is_relevant": true/false,
  "signal_type": "eia/land/approval/planning/company_change/recruitment/news",
  "title": "信号标题",
  "company_name": "涉及的公司名称",
  "project_name": "项目名称（如有）",
  "description": "信号描述（100字以内）",
  "location": "所在地",
  "amount": "金额（如有）",
  "relevance_score": 85,
  "matched_keywords": ["真空泵", "刻蚀工艺"]
}}

如果与这些行业完全无关，is_relevant 设为 false。"""

        try:
            text = self._chat(system_prompt, user_prompt, max_tokens=2000)
            return self._extract_json(text)
        except Exception as e:
            console.log(f"[red]信号分类失败: {e}[/red]")
            return {"is_relevant": False, "error": str(e)}

    def deduplicate_projects(self, projects: list[dict]) -> list[dict]:
        """使用 AI 判断项目列表中的重复项"""
        if len(projects) < 2:
            return projects

        system_prompt = "你是一个数据分析助手。判断以下项目列表中哪些是重复的（同一个项目在多个平台发布）。"

        user_prompt = f"""## 项目列表
{json.dumps(projects, ensure_ascii=False, indent=2)}

## 任务
识别重复项目。返回 JSON：
{{
  "unique_indices": [0, 2, 3]
}}

unique_indices 里是去重后的项目序号（从0开始）。"""

        try:
            text = self._chat(system_prompt, user_prompt, max_tokens=2000)
            result = self._extract_json(text)
            indices = result.get("unique_indices", list(range(len(projects))))
            return [projects[i] for i in indices if i < len(projects)]
        except Exception as e:
            console.log(f"[red]去重失败: {e}[/red]")
            return projects
