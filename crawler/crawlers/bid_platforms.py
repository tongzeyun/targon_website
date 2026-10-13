"""招标平台爬虫"""

import json
from datetime import datetime
from typing import Optional
from playwright.sync_api import Page
from rich.console import Console

from .base import BaseCrawler, CrawlResult

console = Console()

# 招标平台配置
BID_PLATFORMS = [
    {
        "name": "中国招标投标公共服务平台",
        "url": "https://ctbpsp.com/",
        "search_url": "https://ctbpsp.com/#/bulletinList?keywords={keyword}&page={page}",
        "type": "government",
    },
    {
        "name": "中国政府采购网",
        "url": "https://www.ccgp.gov.cn/",
        "search_url": "https://search.ccgp.gov.cn/bxsearch?searchtype=1&page_index={page}&keyword={keyword}",
        "type": "government",
    },
]


class BidPlatformCrawler(BaseCrawler):
    """公开招标平台爬虫"""

    def __init__(
        self,
        keywords: list[str] = None,
        platforms: list[dict] = None,
        max_pages: int = 5,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.keywords = keywords or [
            "真空泵", "真空规", "真空阀", "真空腔体",
            "真空系统", "真空设备", "真空镀膜",
            "半导体设备", "刻蚀", "PVD", "CVD",
            "分子泵", "干泵", "低温泵",
        ]
        self.platforms = platforms or BID_PLATFORMS
        self.max_pages = max_pages

    def _search_platform(
        self, page: Page, platform: dict, keyword: str
    ) -> list[CrawlResult]:
        """在单个平台搜索关键词"""
        results = []

        try:
            url = platform["search_url"].format(keyword=keyword, page=1)
            console.log(f"[cyan]访问: {url}[/cyan]")
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)  # 等待 JS 渲染

            # 提取搜索结果
            # 注意：各平台 HTML 结构不同，这里提供通用框架
            # 实际使用时需根据每个平台的 HTML 结构调整选择器
            content = page.content()
            text = page.inner_text("body")

            if text and len(text) > 100:
                result = CrawlResult(
                    url=url,
                    title=f"{platform['name']} - {keyword}",
                    html_content=content,
                    text_content=text[:10000],  # 限制长度
                    source_name=platform["name"],
                )
                result.content_hash = self._content_hash(content)
                results.append(result)

                console.log(f"  [green]✓ {platform['name']}: 获取到 {len(text)} 字符[/green]")
            else:
                console.log(f"  [yellow]⚠ {platform['name']}: 内容过短，可能被反爬[/yellow]")

        except Exception as e:
            console.log(f"  [red]✗ {platform['name']}: {e}[/red]")

        return results

    def crawl(self) -> list[CrawlResult]:
        """执行爬取"""
        all_results = []
        page = self.new_page()

        for platform in self.platforms:
            console.log(f"\n[bold]正在爬取: {platform['name']}[/bold]")

            for keyword in self.keywords[:3]:  # MVP: 每个平台只爬前3个关键词
                console.log(f"  关键词: {keyword}")
                results = self._search_platform(page, platform, keyword)
                all_results.extend(results)
                self._delay()

        return all_results

    def extract_bid_list(self, page: Page) -> list[dict]:
        """从招标列表页提取项目列表（通用框架）"""
        items = []

        # 尝试多种常见的招标列表选择器
        selectors = [
            ".bulletin-item",
            ".bid-item",
            ".result-item",
            "table tbody tr",
            ".list-item",
            "ul.list li",
        ]

        for selector in selectors:
            try:
                elements = page.query_selector_all(selector)
                if elements:
                    for el in elements[:10]:
                        title_el = el.query_selector("a")
                        date_el = el.query_selector("span.date, .time")

                        items.append({
                            "title": title_el.inner_text() if title_el else "",
                            "url": title_el.get_attribute("href") if title_el else "",
                            "date": date_el.inner_text() if date_el else "",
                            "source": el.inner_text(),
                        })
                    break
            except Exception:
                continue

        return items
