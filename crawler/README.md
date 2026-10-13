# SalesEye 爬虫引擎

真空半导体设备行业招标信息与项目情报爬虫系统。

## 当前实现范围（阶段A迁入）

源码目前运行的是招标平台采集、AI提取和终端打印；**没有自动调用 ingest 入库**。`max_pages` 的完整分页能力、中频/低频调度仍未实现。下文数据源频率为规划范围；目前 `--schedule` 实际只注册每4小时的高频任务，并立即执行一次。

阶段A保留源码和独立Python环境，不运行采集、定时任务或付费AI调用。原 requirements 使用版本下限，重装可能解析不同版本；运行可用性由用户手动验证。

## 架构

```
crawler/
├── main.py                 # 入口，定时调度
├── crawlers/               # 各网站爬虫
│   ├── base.py             # 基础爬虫类（重试、编码检测、反检测）
│   └── bid_platforms.py    # 招标平台爬虫
├── pipelines/              # 数据处理管线
│   └── ai_extract.py       # AI 结构化提取
├── requirements.txt
└── README.md
```

## 数据源清单

### 高频（1-4小时）
- 中国招标投标公共服务平台 (ctbpsp.com)
- 机电产品招标投标电子交易平台
- 各省政府采购网

### 中频（每天）
- 各级环保部门环评公示
- 自然资源局土地成交公告
- 发改委项目审批公示

### 低频（每周）
- 天眼查/企查查目标企业监控
- 行业媒体

## 安装

```bash
cd crawler
pip install -r requirements.txt
playwright install
```

建议使用独立虚拟环境。Windows 在仓库根目录执行：

```powershell
python -m venv crawler/.venv
./crawler/.venv/Scripts/python.exe -m pip install -r crawler/requirements.txt
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location).Path 'crawler/.venv/browsers'
./crawler/.venv/Scripts/python.exe -m playwright install chromium
```

运行时保持同一个 `PLAYWRIGHT_BROWSERS_PATH`，在 `crawler` 目录运行 `./.venv/Scripts/python.exe main.py --once`。这些运行命令会实际采集并可能调用模型，阶段A本轮未执行。

## 环境变量

在项目根目录 `.env.local` 中配置：

| 变量 | 说明 |
|------|------|
| `CRAWLER_API_KEY` | 爬虫调用 API 的认证密钥 |
| `CRAWLER_ORGANIZATION_ID` | 生产环境必填，爬虫写入候选情报时使用的组织 ID |
| `CRAWLER_BASE_URL` | API 基础地址（默认 `http://localhost:3000`） |
| `DEEPSEEK_API_KEY` | Python 侧 AI 提取所需的模型密钥 |
| `DEEPSEEK_BASE_URL` | 可选，DeepSeek/OpenAI 兼容 API 地址 |
| `AI_MODEL` | 可选，默认 `deepseek-chat` |

## 运行

```bash
# 单次运行
python main.py --once

# 定时运行（每 4 小时）
python main.py --schedule

# 测试模式（1 个平台，3 个关键词）
python main.py --test
```

## 数据写入边界

系统提供 `POST /api/crawler/ingest` 作为候选情报写入入口；当前Python源码未接入这个接口。外部调用者使用该接口时必须带 `x-api-key`，并在生产环境配置 `CRAWLER_API_KEY` 与 `CRAWLER_ORGANIZATION_ID`。

**调用契约（异步）：**

1. `POST /api/crawler/ingest`，请求体 `{ "signals": [ ... ] }`（不要传 `organizationId`）
2. 成功返回 **HTTP 202**：`{ "success": true, "queued": true, "jobId": "...", "job": { ... } }`
3. 记录 `jobId`；如需结果，使用有权访问该组织的浏览器会话轮询 `GET /api/jobs/:id`（该接口不是爬虫API Key认证），完成后 `resultJson` 含 `{ "type": "crawler_ingest", "signals": N, "candidatesCreated": M }`
4. 生产环境必须运行 `npm run worker:jobs`，否则 job 不会执行

爬虫采集结果只能作为候选情报进入系统：

- 可以写入 `project_signals`、`intelligence_sources`、`intelligence_items` 和 `evidence_links`。
- 不应直接创建正式 `projects` 或 `target_accounts`。
- 正式业务记录必须通过 promote/确认流程生成，并保留来源和证据链。
