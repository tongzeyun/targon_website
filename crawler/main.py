"""SalesEye 爬虫引擎 - 主入口

使用方法:
    python main.py --once          # 单次运行
    python main.py --schedule      # 定时运行
    python main.py --test          # 测试模式（只爬1个平台1个关键词）
"""

import os
import sys
import argparse
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

# Load the same root configuration used by Web/Worker; externally injected values win.
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)

from crawlers.bid_platforms import BidPlatformCrawler
from pipelines.ai_extract import AIExtractionPipeline

console = Console()


def crawl_bids(test_mode: bool = False):
    """爬取招标信息"""
    console.print("\n[bold blue]═══ 招标信息爬取 ═══[/bold blue]\n")

    keywords = ["真空泵", "真空设备", "半导体设备"] if test_mode else None
    max_pages = 1 if test_mode else 5

    crawler = BidPlatformCrawler(
        keywords=keywords,
        max_pages=max_pages,
        headless=True,
    )

    results = crawler.run()

    # 显示结果
    table = Table(title="爬取结果")
    table.add_column("来源", style="cyan")
    table.add_column("标题", style="white")
    table.add_column("内容长度", style="green")

    for r in results:
        table.add_row(r.source_name, r.title[:50], str(len(r.text_content)))

    console.print(table)

    return results


def process_with_ai(results: list):
    """AI 提取结构化信息"""
    console.print("\n[bold blue]═══ AI 信息提取 ═══[/bold blue]\n")

    pipeline = AIExtractionPipeline()
    extracted = []

    for i, result in enumerate(results):
        console.print(f"[{i+1}/{len(results)}] 处理: {result.title[:60]}...")

        if "招标" in result.source_name or "采购" in result.source_name:
            info = pipeline.extract_bid_info(
                result.html_content,
                result.url,
                result.source_name,
            )
        else:
            info = pipeline.classify_signal(
                result.html_content,
                result.url,
                result.source_name,
            )

        if info.get("confidence_score", 0) >= 50:
            extracted.append(info)
            console.print(f"  [green]✓ 置信度: {info.get('confidence_score')}%[/green]")
            if info.get("project_name"):
                console.print(f"  项目: {info['project_name']}")
            if info.get("budget_amount"):
                console.print(f"  预算: {info['budget_amount']}")
        else:
            console.print(f"  [yellow]⊘ 置信度过低，跳过[/yellow]")

    return extracted


def run_scheduled():
    """定时运行模式"""
    import schedule
    import time

    console.print("[bold green]SalesEye 爬虫引擎已启动（定时模式）[/bold green]")
    console.print("高频爬取: 每4小时 | 中频爬取: 每天9:00 | 低频爬取: 每周一9:00")

    def job_high_freq():
        console.print(f"\n[dim]高频爬取 [{datetime.now().strftime('%H:%M')}][/dim]")
        results = crawl_bids(test_mode=False)
        process_with_ai(results)

    schedule.every(4).hours.do(job_high_freq)

    # 立即执行一次
    job_high_freq()

    while True:
        schedule.run_pending()
        time.sleep(60)


def main():
    parser = argparse.ArgumentParser(description="SalesEye 爬虫引擎")
    parser.add_argument("--once", action="store_true", help="单次运行")
    parser.add_argument("--schedule", action="store_true", help="定时运行")
    parser.add_argument("--test", action="store_true", help="测试模式")
    args = parser.parse_args()

    if args.schedule:
        run_scheduled()
    else:
        console.print("[bold green]SalesEye 爬虫引擎 v0.1[/bold green]")
        results = crawl_bids(test_mode=args.test)

        if results:
            extracted = process_with_ai(results)
            console.print(f"\n[bold green]✅ 提取到 {len(extracted)} 条有效商机[/bold green]")
        else:
            console.print("\n[yellow]⚠ 未获取到结果[/yellow]")


if __name__ == "__main__":
    main()
