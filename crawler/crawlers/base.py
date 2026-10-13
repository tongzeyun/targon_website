"""基础爬虫类，定义通用爬取逻辑和反爬策略"""

import time
import random
import hashlib
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional
from dataclasses import dataclass, field

from playwright.sync_api import sync_playwright, Page, Browser
from rich.console import Console

console = Console()

# 常见 User-Agent
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]


@dataclass
class CrawlResult:
    """爬取结果"""
    url: str
    title: str
    html_content: str
    text_content: str
    publish_date: Optional[datetime] = None
    source_name: str = ""
    content_hash: str = ""
    metadata: dict = field(default_factory=dict)


class BaseCrawler(ABC):
    """爬虫基类"""

    def __init__(self, headless: bool = True, request_delay: tuple = (3, 10)):
        self.headless = headless
        self.request_delay = request_delay  # (min, max) seconds between requests
        self._browser: Optional[Browser] = None
        self._playwright = None

    def _delay(self):
        """随机延迟，避免触发反爬"""
        delay = random.uniform(*self.request_delay)
        time.sleep(delay)

    def _content_hash(self, content: str) -> str:
        """计算内容哈希，用于去重"""
        return hashlib.md5(content.encode()).hexdigest()

    def _random_ua(self) -> str:
        """随机 User-Agent"""
        return random.choice(USER_AGENTS)

    def start_browser(self):
        """启动浏览器"""
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(
            headless=self.headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ],
        )
        console.log("[green]浏览器已启动[/green]")

    def close_browser(self):
        """关闭浏览器"""
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()
        console.log("[yellow]浏览器已关闭[/yellow]")

    def new_page(self) -> Page:
        """创建新页面（带反爬设置）"""
        if not self._browser:
            self.start_browser()

        context = self._browser.new_context(
            user_agent=self._random_ua(),
            viewport={"width": 1920, "height": 1080},
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
        )
        page = context.new_page()

        # 注入反检测脚本
        page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        """)

        return page

    @abstractmethod
    def crawl(self) -> list[CrawlResult]:
        """执行爬取，返回结果列表"""
        ...

    def run(self) -> list[CrawlResult]:
        """运行爬虫"""
        try:
            self.start_browser()
            results = self.crawl()
            console.log(f"[green]爬取完成: {len(results)} 条结果[/green]")
            return results
        except Exception as e:
            console.log(f"[red]爬取出错: {e}[/red]")
            return []
        finally:
            self.close_browser()
