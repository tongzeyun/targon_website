# Smart Eye / 灵眸智售迁移计划

日期：2026-10-12。状态：阶段A代码与运行资源已迁入，待用户手动验收；尚未操作数据库。本文是唯一迁移计划，包含当前范围、两阶段步骤和排除清单。

## 2026-10-12执行约定更新

用户在阶段A迁入过程中明确要求：**完成阶段A之后不运行测试，由用户手动测试；暂时不再询问测试服务准备。** 因此本轮只执行阶段A代码、依赖与运行资源迁入，不执行typecheck/build、数据库迁移、Web/Worker启动、业务测试或第三方采集。下文统一测试清单保留为用户手动验收参考，不作为本轮自动执行指令。

本轮不复制真实env、不连接原数据库或OSS、不变更旧Docker服务。阶段A的代码迁入状态与待验收事项记录在 `docs/SMARTSALE_MIGRATION_STAGE_A.md`；界面完整双语仍属于阶段B。

阶段A迁入结束后的配置更新：用户已授权将旧项目 `.env.local` 中全部业务配置复制到目标根目录 `.env`，保留SITE_DEFAULT_LOCALE，取消.env的Git跟踪。当前本地页面使用3000端口，目标AUTH_TRUSTED_ORIGIN和NEXT_PUBLIC_APP_URL已从3876适配为3000；原数据库和存储目标保留。尚未启动数据库或Worker，未运行测试。

## 固定范围

- 来源 `D:/T_workspace/saleseye`；目标 `D:/T_workspace/TargonWebsite`。源项目保留，不先在旧项目删除功能。
- 正式环境沿用原 PostgreSQL 与文件存储；业务记录、AI 结果、生成文档维持中文，既有外文输入保留原文。
- 先把原有功能迁入并跑通，再按设计稿改页面。界面中英通过固定文案字典实现，不改变后端数据格式。
- 已确认的20个无调用文件、测试、旧官网、seed和构建产物不复制。具体文件见本文末尾的排除清单。
- 首轮保留现有认证、限流、配额、Origin、组织范围、任务类型和重试机制；不在搬迁中收敛重复JWT或重构Worker。
- 保留原目录下的lib/repositories，不新建业务框架、通用工作流、另一套数据库或服务层。不升级Next/React。

按用户最新要求，执行合并为两阶段：**阶段A合并原第1–3步，全部迁入完成后统一测试；阶段B合并原第4–5步，完成新设计/界面双语和新环境切换，最终验收后释放旧应用环境。** 各内部环节不单独跑测试或构建；失败修复后只复核受影响项。英文路由存在不等于英文界面已完成，不能提前宣称双语交付。

## 第0步：保存基线，准备验收环境

1. 记录两边当前代码版本和未提交变更，在目标建立 `codex/smart-eye-migration` 分支；不覆盖已有修改，不自动提交真实环境文件。
2. 记录原应用实际Node版本、数据库版本、schema_version、存储驱动/目录或OSS bucket、运行Worker和外部爬虫入口。
3. 用已有数据库备份恢复一份隔离验收库；本地存储使用独立目录，OSS使用独立验收bucket。没有现成备份时，经确认后制作备份。验收库数据涉及业务信息，不加入Git。
4. 目标 `.env.local` 配置验收库/存储、JWT与必要供应商配置；生产通过已有部署方式注入。先核验DATABASE_URL和存储目标，再允许启动Worker。
5. 使用满足旧lockfile依赖engine要求的Node22版本；检查实际安装的传递依赖，不只检查直接包。

**完成条件：** 旧代码可作为对照；验收Web/Worker不会消费现有库任务或清理现有文件。

## 阶段A：合并第1–3步，迁移完成后统一测试

### 1. 迁入后端运行底座

以下路径相对于两个项目各自根目录，除特别注明外原路径迁入。

| 来源 | 目标/处理 |
| --- | --- |
| `src/lib/db/**` | 同路径；保留index/client、adapter、schema、migrate runner、SQL/JSON/transform工具，排除测试、queries、seed-logic |
| `src/lib/repositories/**` | 同路径；排除测试和孤立activity-log-repository |
| `src/lib/{api,ai,crawler,document,jobs,storage,alert}/**` | 按已审查闭包迁入，排除冗余清单中的完整文件；当前使用的schema保留 |
| `src/lib/utils.ts`、日期/联系人等可达工具 | 同路径；按import补齐，不复制export-csv和旧seo |
| `src/config/bid-template.json` | 同路径，保留现有中文配置 |
| `src/app/api/**/route.ts` | 同路径，保留48个API；不加zh/en前缀，不复制route.test |
| `src/proxy.ts` | 迁入并核验目标域名/Origin/CORS配置；首轮保留有效检查 |
| `scripts/job-worker.ts`、`load-env.ts`、`db-migrate.ts` | 同路径，保留独立CLI入口 |
| `scripts/pg-baseline.sql`、`pg-migrations/*.sql` | 同路径，保留017–022和基线，确保打包后路径可读 |
| `scripts/generate-bid-default-template.ts` | 保留手动模板维护工具；不加入启动流程 |

这个环节不改官网页面、不迁旧根layout和旧globals.css、不改表结构。

### 依赖与启动命令

保留目标原package和原scripts。把下列旧lockfile中已解析版本合入目标，由npm生成目标lockfile，不覆盖为旧package-lock：

| 依赖 | 版本 |
| --- | --- |
| @base-ui/react、bcryptjs、cheerio | 1.5.0、3.0.3、1.2.0 |
| class-variance-authority、clsx、tailwind-merge | 0.7.1、2.1.1、3.6.0 |
| docx、mammoth、pdf-parse、pizzip、xlsx | 9.7.1、1.12.0、2.4.5、3.2.0、0.18.5 |
| iconv-lite、jose、pg、uuid | 0.7.2、6.2.3、8.22.0、14.0.0 |
| lucide-react、react-day-picker、sonner | 1.17.0、10.0.1、2.0.7 |
| openai | 6.41.0 |
| tw-animate-css、shadcn | 1.4.0、4.10.0；后续业务CSS有实际import |
| tsx | 4.22.4；放在生产可用依赖中，Worker需要 |
| @next/env | 16.2.7，与Next一致；显式声明CLI环境加载所需的直接依赖 |
| @types/pg | 8.20.0；开发类型依赖 |

框架沿用Next16.2.7、React/React DOM19.2.4，Tailwind沿用目标版本。其他类型依赖只在实际类型检查需要时补齐。不添加Vitest、未用Radix、recharts、旧PDF/模板生成依赖；保留pdf-parse实际需要的传递依赖。

package scripts只新增：

```json
{
  "worker:jobs": "tsx scripts/job-worker.ts",
  "db:migrate": "tsx scripts/db-migrate.ts"
}
```

现有 `dev`、`build`、`start`、`typecheck` 不改。环境加载统一为Next现有加载规则：CLI使用 `@next/env` loadEnvConfig；该包已由Next安装，仍显式声明为直接依赖，避免依赖偶然的安装布局。启动时保留外部注入变量优先，核对生产/开发模式；不再维护另一份只识别.env.local的解析器，不新增独立dotenv包。

Next配置只合入实际需要的Proxy上传body限制；不照搬旧局域网开发来源。此次不创建新的通用认证包装框架。

此处只完成代码/依赖/脚本迁入，不单独运行typecheck、build或启动Worker做测试。验证统一放到阶段A全部迁入完成之后。

### 2. 迁入旧页面，仅做接线与必要布局适配

1. 当前 `[lang]/layout.tsx` 保留html/body、合法语言检查及共同基础；将官网Header/Footer/AOS和site-body外壳移到 `[lang]/(website)/layout.tsx`。
2. 把官网 `(home)`、home、products、contact、cases目录移入 `(website)`；内容和已有CSS Modules保持原样，修正受移动影响的相对import。
3. 源 `src/app/(website)/smart-eye/**` 迁入目标 `src/app/[lang]/(workspace)/smart-eye/**`，排除测试和AuthGate。迁入18个page及实际组件，批量更新旧目录import。
4. 迁入13个实际UI文件、可达hooks、ErrorBoundary/业务Provider。Toaster仅挂业务layout，不复制旧根layout/SEO。
5. 旧业务依赖64px顶栏：迁入旧WebsiteHeader中实际顶栏部分，保留原高度和交互，更新官网/业务链接；不迁旧WebsiteChrome/Footer。这是布局适配，首轮不重画页面。
6. 业务CSS放在smart-eye目录，仅提取业务token和组件规则；保留目标globals。业务容器及Dialog/Popover/Select/Toaster等portal挂业务样式范围；不整份复制旧body/:root/全局base。
7. 业务引用的图片复制到 `public/img`，保留原URL，官网 `/image` 不改。
8. 路径用 `/{lang}/smart-eye/login`、`/{lang}/smart-eye/app/*`；保留入口跳到app/quotation。内部链接、侧栏高亮、登录/退出/401的回跳同步适配lang，next仍只允许合法站内业务路径。
9. 原 `src/app/smart-eye` 占位页/layout替换为旧入口兼容跳转，覆盖深层路径，保留query；默认语言用SITE_DEFAULT_LOCALE。旧裸业务路径按实际使用兼容，不抢占官网/products。
10. 官网header/footer及Smart Eye卡片接入带语言入口；语言切换保留业务query。

此处完成页面、路由、UI、图片和样式接线，不逐页测试。文案可暂时保持旧中文，统一测试时验证功能；英文界面在阶段B完成。

### 3. 补齐运行资源，结束代码迁入

1. 迁入Python crawler源码/requirements/说明，准备独立运行环境；保留现有采集/打印，不补自动入库、分页或额外调度，不运行付费/定时采集。
2. 补齐遗漏的import、配置JSON、SQL、图片、CLI与运行说明；核对20个完整文件、测试、旧官网和seed已排除。
3. 完成Web/Worker环境配置和生产打包所需资源。到此原第1–3步的迁入工作全部完成，再开始以下统一测试。

### 阶段A统一测试

先运行 `npm run typecheck`、`npm run build`；在隔离验收库运行 `npm run db:migrate`，确认28表及schema至少22，不运行seed。启动Web和独立Worker，检查health/live、health/ready；ready不代替业务、存储和Worker验证。

在隔离环境按下列顺序验收，优先做完整链路而非逐个点按钮：

1. 登录 → 读取产品/客户/项目 → 编辑保存 → 刷新确认 → 客户/项目CSV导出；不同组织访问拒绝。
2. 创建报价文档任务 → jobs进入queued → Worker执行 → succeeded → 历史列表 → 下载并检查文件。合同/标书/会议依次验收。
3. AI发现/匹配/补全/深度研究与URL提取，确认结果、任务状态、候选情报审核及promote/reject；只使用经确认的验收样本。
4. 上传/转换/录音转写验证实际存储、供应商配置和结果；查看失败状态/错误，不用mock结果宣称服务已可用。
5. 验证会话失效刷新、并发刷新、临时服务失败、任务取消/失败/恢复及cleanup；保留现有行为。
6. 在可用且经确认的外部服务条件下核验Python现有能力；没有条件时明确记为未验证，不把源码迁入说成自动采集/入库已可用。
7. 使用上述生产构建，以 `npm run start` 和独立 `npm run worker:jobs` 验证SQL、JSON、图片及CLI在生产包中可用；同时回归官网zh/en和业务路由。

**完成条件：** 旧可达功能验证完成，形成“旧功能迁移版本”；未验证第三方/Python部分明确列出。重复JWT/Origin/任务列表精简和业务功能删减留作独立变更，迁移阶段不混做。

## 阶段B：合并第4–5步，新环境切换后释放旧环境

### 4. 新设计与界面中英文

1. 以阶段A迁移完成版本为对照，按页面调整样式，优先共享顶栏/侧栏、列表与表单，再处理复杂文档页面；保持原请求、校验和保存/下载逻辑，不逐页测试。同步将当前仅由Smart Eye使用的13个UI组件、业务Provider和ErrorBoundary收进Smart Eye模块，更新引用与Tailwind扫描路径，保留Portal样式范围；页面专属样式随设计更新整理，不在当前运行问题排查中重构。
2. 复用现有I18n Context和 `src/lib/locales.ts` 类型，以URL语言初始化字典；固定文案分zh/en，不新增国际化框架，不通过localStorage覆盖URL语言。
3. 翻译菜单、按钮、字段标签、验证、toast、加载、固定状态和日期数字显示；后端字段名/枚举原值、客户资料、AI正文、文档模板/文件保持原样。
4. 业务API、jobs payload、Worker、AI提示词、数据库结构不因界面语言变化而增加language参数；语言切换不重新生成任务。
5. 准备新环境部署配置，与页面/界面双语一起完成后进入切换和统一验收，不在第4步单独跑构建或页面测试。

### 5. 连接原数据库/存储，切换与释放

1. 按现有部署方式准备目标Web和独立Worker，使用同一现有逻辑数据库与文件存储；不复制第二套业务库，不重建PostgreSQL服务，不更换OSS bucket。
2. 核验真实schema_version/表结构、文件路径与object key、域名/Origin、外部可读签名URL和部署权限。原库已经满足22时不因代码迁移自动跑DDL；确需增量时先备份并确认。
3. 页面/双语及新环境配置全部完成后，统一运行typecheck/build并部署新应用。暂停旧系统新任务提交和独立采集调度，排空或记录运行任务，停止旧Worker，再切换Web入口与新Worker。首次只运行一个Worker，不顺便增加并发。
4. 在新环境进行阶段B最终验收：zh/en首屏、链接/回跳/query、桌面/移动端/portal、官网、原账号/组织/历史数据/文件、一个新任务及下载、健康与Worker日志。双区域Web若启用，明确连接同一逻辑数据源并确认跨区连通。
5. 最终验收通过后释放旧Web/Worker进程、旧应用容器和确认不再使用的应用资源，取消旧启动/调度配置，避免重启后旧Worker再次运行。旧机器只有确认不承载沿用数据库、文件存储或其他仍用服务时才可释放。源代码和必要恢复备份保留；不删除沿用的PostgreSQL、数据卷、OSS bucket或业务文件。
6. 释放运行资源前保存旧应用版本和入口配置用于恢复。若最终验收失败，先停新Worker，再恢复旧应用/Worker与入口，核对运行/排队任务；切换后已有新写入时不直接用旧备份覆盖数据，旧环境此时不释放。

**完成条件：** 新环境页面/界面双语和原业务通过最终验收，原数据/文件可用，旧应用运行资源已释放，仍在使用的数据存储保留；不存在未说明的未验证项。

## 两阶段执行与测试边界

| 阶段 | 内容 | 测试时机 |
| --- | --- | --- |
| A（原1–3） | 后端lib/API、Worker/SQL、依赖/env、旧页面/路由/UI/图片/CSS、Python及运行资源 | 全部迁入完成后统一做类型/构建和业务回归，不在内部环节分别测试 |
| B（原4–5） | 新设计、界面双语、部署新环境、连接原库/存储、切换入口与Worker、释放旧应用环境 | 全部改动完成后统一构建，部署切换后最终验收；通过再释放旧运行资源 |

不按文件、页面或原第1/2/4步分别跑测试。阶段统一验收失败时修复并复核相关项，不无条件重复全套检查。测试源码不迁入。不为迁移新增抽象层、重写工作代码或引入未用依赖。

## 必须保留的能力与已知边界

- 18个页面、48个API、15类任务、28张数据库表；保留认证/刷新、组织隔离、限流/配额、Worker清理/恢复、local/OSS文件、文档历史/下载和现有CSV导出。排除孤立代码不删除数据库表或历史数据。
- db:migrate、基线和增量SQL、Worker/env入口是运行工具，保留。seed及专属seed-logic、测试、旧官网/SEO、缓存和构建产物不迁入；真实环境文件和备份不加入源码。
- Python有独立入口，源码保留。当前仅采集/提取/打印，没有自动提交ingest；分页及部分调度未实现，补功能单独安排。
- 语音转写和文档转换已有实际讯飞实现，旧README的占位描述过时；是否可用通过实际供应商环境验收。
- 源码要求schema至少22，旧部署说明写19；正式操作以前以实际库和源码为准。迁移本身不要求改表或导入seed。
- Worker未发现心跳续锁；任务stale与LFASR默认超时均为30分钟，旧容器停机宽限15分钟。切换前排空或记录运行任务，避免旧/新Worker同时消费或清理原文件。
- Cookie范围为/api与/api/auth；保持API认证，页面布局不假设能读取这些Cookie。业务CSS及portal隔离；上传限制和签名URL在阶段统一验收中验证。
- docxtemplater、pdf-lib、html2canvas、jspdf、recharts、未用Radix和测试依赖不主动迁入；pdf-parse的传递依赖、业务CSS所需包、tsx等真实运行依赖保留。

## 排除清单

以下20个完整文件通过TypeScript引用追踪和全文搜索复核：既不在Smart Eye/API/Worker入口闭包中，也不在包含旧官网、seed及模板维护工具的全部入口闭包中。结论针对当前仓库；迁入前复核引用，旧源码保留，不执行旧项目删除。

### 可整体不迁入的20个文件

以下相对路径都以来源根目录 `D:/T_workspace/saleseye` 为基准。

| 编号 | 文件 | 具体内容/证据 | 保留的真实行为 |
| --- | --- | --- | --- |
| 1 | `src/app/(website)/smart-eye/_components/smart-eye-auth-gate.tsx` | SmartEyeAuthGate（第12行）未被 layout/page 挂载；无生产 import | API Cookie 认证和 authenticated-fetch 的会话刷新/401回跳 |
| 2 | `src/lib/ai/key-store.ts` | getActiveProvider、getApiKey、getApiKeyCached（19/23/29行）无生产引用 | `ai/client.ts` 的 ensureClient 实际从环境读取 Key |
| 3 | `src/lib/db/queries.ts` | 历史 repository 重导出层，无生产 import | 直接使用 repository 与 `@/lib/db` 的调用 |
| 4 | `src/lib/ai/extraction.ts` | extractBidInfo、extractSignalInfo（26/72行）无生产消费者 | 当前 crawler/search、batch-extract-service 及 Worker 链路 |
| 5 | `src/lib/ai/schemas/extraction.ts` | 仅被不可达 extraction.ts 使用 | 当前生产提取链路自己的 schema |
| 6 | `src/lib/ai/fetch-extract.ts` | fetchAndExtract、saveConfirmedSignal（67/158行）无生产消费者 | batchExtractUrl、候选情报审核/确认流程 |
| 7 | `src/lib/ai/reasoning.ts` | inferProjectFromSignals、findAndInferProjects（26/114行）没有外部调用；后者仅在本文件内调用前者 | 当前可达 AI/情报任务；不删除 signals、intelligence 或证据表 |
| 8 | `src/lib/ai/schemas/project-inference.ts` | 仅被不可达 fetch-extract/reasoning 使用 | 当前 deep-research、batch-extract、情报 schema |
| 9 | `src/lib/ai/document-generate.ts` | generateDocument、fillTemplatePlaceholders（28/125行）无生产消费者 | 报价/合同 API 的 fill-form + generate-job，真实文档 Worker |
| 10 | `src/lib/document/template-filler.ts` | fillDocxTemplate、extractPlaceholderKeys（16/121行）无生产消费者；孤立 docxtemplater 实现 | 当前报价/合同/标书生成链路 |
| 11 | `src/lib/document/pdf-builder.ts` | buildPdf（55行）无生产消费者；旧 pdf-lib + 系统字体实现 | 真实 PDF 输入解析、讯飞 OCR/转换及现有下载行为 |
| 12 | `src/lib/activity-log.ts` | logActivity、getRecentLogs（9/24行）无外部生产调用 | Worker 日志、ai_runs 和其他已运行的记录功能 |
| 13 | `src/lib/repositories/activity-log-repository.ts` | 只被不可达 activity-log.ts 引用 | 原 activity_logs 表/历史数据仍保留 |
| 14 | `src/lib/export-csv.ts` | toCsv、downloadCsv、flattenAccountForExport 无消费者 | 客户页299行、项目页151行直接实现的 CSV 导出，继续迁移 |
| 15 | `src/components/ui/confirm-dialog.tsx` | ConfirmDialog 无生产 import | 页面实际使用的 dialog/确认交互 |
| 16 | `src/components/ui/dropdown-menu.tsx` | 无生产 import | 当前实际使用的 UI |
| 17 | `src/components/ui/separator.tsx` | 无生产 import | 当前实际使用的 UI |
| 18 | `src/components/ui/sheet.tsx` | 无生产 import；业务使用自有 MobileShell/Sidebar | 当前移动端导航 |
| 19 | `src/components/ui/table.tsx` | 无生产 import；页面现有表格不是通过此封装渲染 | 当前业务表格 |
| 20 | `src/components/ui/tabs.tsx` | 无生产 import | 当前实际使用的 UI |

UI 文件按当前迁移范围不复制；后续新设计若确实使用它们，再按需要迁入，不为了预留组件整包搬运。

特别区别：旧 `reasoning.ts` 有实际算法实现，但没有可达调用入口，所以不属于当前运行中的功能；旧 roadmap 说“以后处理 reasoning”不能代替代码证据。`export-csv.ts` 无调用也不意味着可以取消用户正在使用的 CSV 导出。

### 只能省略部分函数的文件

| 文件 | 可不迁入的部分 | 证据/必须保留部分 |
| --- | --- | --- |
| `src/lib/api/browser-auth.ts` | resolveBrowserAuthSession（177行）；其专属 BrowserAuthStatus、ResolveBrowserAuthOptions、isAbortError、throwIfAborted、isValidMeUser、fetchMe、fetchRefresh、statusFromMeResponse | 唯一生产引用来自未挂载的 AuthGate。必须保留登录页使用的 resolveSafeSmartEyeNextPath（79行），以及设置页 performBrowserLogout（62行）/其 logoutBrowserSession（40行）；相关常量/类型随真实调用保留 |
| `src/lib/db/index.ts` | 弃用 initDb（8行） | 无生产调用。整个 index 被大量 repository 通过 `@/lib/db` 引用，db/getDatabaseAdapter等真实接口必须保留；不要整文件删掉 |
| `src/lib/ai/client.ts` | getAIClient（74行）、resetClient（104行）、StructuredExtractionResult（121行） | getAIClient 与 ensureClient 初始化重复，但前者未发现调用，resetClient 只用于测试，孤立类型未使用。保留 ensureClient、withRetry、模型选择、错误类型和实际客户端设置；无需为省一个函数新建初始化抽象 |
| `src/lib/ai/schemas/document.ts` | validateGeneratedDocument（85行）、validateTemplateFillResult（102行）、它们专属 GeneratedDocumentSchema/TemplateFillSchema/validateOptionalStringRecord | 消费者只有不可达 document-generate 与测试。保留真实报价/合同 API 使用的 validateQuotationForm（34行）、validateContractForm（63行）及所需类型 |
| `src/lib/storage/file-storage.ts` | resetFileStorageAdapter（291行） | 仅测试调用；完整 local/OSS 适配器及实际读写/签名功能保留 |
| `src/lib/db/adapters/postgres.ts` | resetPostgresAdapterForTests（101行） | 无运行消费者，属于测试重置钩子；adapter、连接、事务、schema校验保留 |
| `src/lib/jobs/worker.ts` | 第215行的 `__testOnly` 导出对象及对象内测试重置闭包 | 消费者只在测试；它引用的 maybeCleanupExpiredStoredFiles、maybeCleanupProviderQuotaLeases、maybeCleanupAuthSessions 等真实运行函数必须保留 |

这里是迁入时的局部剪裁，不要求提前修改旧项目。省掉未使用 AuthGate 的 /me→refresh→/me 初始化，不是取消用户正在使用的自动刷新：`authenticated-fetch.ts` 中并发合并、有限重试、401回跳和临时故障区分仍保留。

### 待业务跑通后处理的重复逻辑

#### 重复JWT验证

- `src/proxy.ts:205` 的受保护 API 分支通过 verifyToken 验证 Access Cookie。
- `src/lib/api/auth.ts` 的 authenticateRequest/getAuthOrg 再验证同一 Cookie。
- 可保留 handler 为认证边界，并省去 Proxy 重复 JWT；但必须先检查全部受保护 handler 的错误处理。
- 反例：`api/ai/discover/route.ts:8` 的 getAuthOrg 在 try 外；`api/alerts/route.ts` 把捕获的认证错误统一返回500。直接删 Proxy 会改变未登录请求的结果。
- 验收后才实施：缺少/伪造/过期 Cookie 返回401；合法请求不重复验 JWT；组织身份只来自可信认证；Origin/上传/组织范围等检查继续有效。

#### 重复任务类型清单

- `api/jobs/route.ts:13` 的 ALLOWED_JOB_TYPES、第30行 CREATABLE_JOB_TYPES，与 `lib/jobs/worker.ts:78` 的 SUPPORTED_JOB_TYPES 经 AST 比较完全相同，都是15项。
- 可以只维护一份当前共同列表，由 API 和 Worker 消费；保留类型定义、15个handler、未知类型拒绝和当前创建策略。
- 这是减少列表重复维护，不是去掉任务队列、Worker或其中任何任务功能。未来可创建与可执行范围分化时再明确区分。

#### 部分重复Origin检查

- Proxy 对带 Access Cookie 的 API 写请求做 Origin 检查；login/register/refresh/logout handler 自身也检查 Origin。
- 只在满足 Proxy 条件时重叠。无 Access Cookie 的登录/注册、只有 Refresh Cookie 的刷新仍依赖 handler 检查，因此不能全删 handler 的 Origin。
- 若收敛，可按明确已覆盖的认证路由划分检查责任；普通业务写请求保持有效检查。迁移初期保留原行为也可，优先级低于功能跑通。
