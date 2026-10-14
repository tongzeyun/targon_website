# Smart Eye迁移与界面整理记录

更新日期：2026-10-14。本文件统一记录代码迁入、目录整理、冗余清理、设计与双语适配；生产部署、旧服务器数据清理及SEO/GEO只见 [部署方案](TARGON_FRESH_DEPLOYMENT_PLAN.md)。

## 当前状态与执行约定

| 内容 | 状态 |
| --- | --- |
| 阶段A：业务代码、依赖及运行资源迁入 | 完成 |
| 结构整理和旧语言机制清理 | 完成 |
| 阶段B：17个界面的样式与双语代码适配 | 完成，另保留1个重定向入口；用户反馈页面检查没有太大问题 |
| 自动测试、typecheck、build及完整业务回归 | 未执行；用户要求手动验收，不自动运行 |
| 服务器部署与SEO/GEO | 未执行，归部署文档管理 |

只做必要接线和已确认的无用代码清理，保留业务契约、认证/组织范围、任务类型和重试机制。静态检查及用户对页面的反馈不等于完整业务、类型或生产验收。

用户于2026-10-14确认：域名为`https://targon.cn`，服务器操作由用户手动完成；最新更正为AWS新建EC2只部署官网版本，暂不启用Smart Eye、Worker、数据库或OSS。旧官网/Smart Eye专属资源清理作为原服务器上的独立事项。Smart Eye迁移成果继续保留在本地项目，原“沿用生产数据、切换并释放旧应用”的路线已取消，不再列作迁移待办。

## 迁移基线与范围

| 项目 | 记录 |
| --- | --- |
| 来源 | `D:/T_workspace/saleseye`，master，`16c839861b5e15a2d36d54c943f5ccc90b494e12` |
| 目标迁入前 | `D:/T_workspace/TargonWebsite`，main，`6d1686a7d361c411c40e2952ffed411fb9c70df0` |
| 工作分支 | `codex/smart-eye-migration`；2026-10-12从目标HEAD创建，未自动提交或推送 |
| 框架/运行时 | Next 16.2.7、React/React DOM 19.2.4；本地Node 22.21.1、npm 10.9.4 |
| 原有修改 | 来源旧官网与历史部署包的改动、目标方案与next-env.d.ts修改均保留 |

本地来源源码保留作对照；服务器删除范围由部署文档单独管理。

| 内容 | 迁入结果 |
| --- | --- |
| 后端 | 原路径迁入`lib/db`、repositories、api、ai、crawler、document、jobs、storage、alert及可达工具 |
| API | 48个`src/app/api/**/route.ts`，保留原路径，不加zh/en前缀 |
| 页面 | 18个page入口：17个界面和1个重定向入口 |
| 数据结构 | 28张表、预期schema 22；基线SQL及017–022增量SQL，共7个SQL文件 |
| 异步任务 | 15类任务及真实handler、领取、恢复、清理逻辑；Web和Worker独立运行 |
| 运行工具 | `scripts/job-worker.ts`、`scripts/load-env.ts`、`scripts/db-migrate.ts`及模板维护CLI |
| 模板 | `src/config/bid-template.json`及实际文档生成/下载链路 |
| Python | 独立crawler源码、requirements、说明和本地虚拟环境/Chromium |
| 打包 | Dockerfile、.dockerignore；SQL、JSON、CLI与tsx保留，镜像默认只启动Web |

依赖按旧lockfile解析版本迁入。保留实际需要的Base UI、日期控件、Sonner、Lucide、文档/AI/数据库/存储依赖；tsx为生产依赖，显式声明@next/env及@types/pg。不升级Next/React，不添加测试框架或未使用组件包；实际版本以package.json和package-lock.json为准。

新增命令为`worker:jobs`和`db:migrate`，原dev/build/start/typecheck命令保持。CLI使用Next的loadEnvConfig，外部注入配置优先，生产使用NODE_ENV=production；crawler读取根目录.env且不覆盖外部环境变量。

## 接线及运行问题处理

- `[lang]/layout.tsx`负责语言校验及html/body；官网Header/Footer/AOS位于`(website)`，业务位于`(workspace)/smart-eye`。路由分组名不进入URL，API位置保持。
- 业务内部链接、语言切换、登录/退出、401回跳沿用URL语言；安全next只接受站内业务路径。旧`/smart-eye/*`兼容入口依据SITE_DEFAULT_LOCALE跳转并保留query，不占用官网`/products`。
- 认证Cookie、会话刷新并发合并、有限重试、401与临时刷新故障区分、限流/配额、Origin/CORS和组织隔离保留。
- 本地401/刷新403：复制配置后的认证Origin仍指向旧3876端口，已适配为localhost:3000，认证逻辑不变。
- 数据库启动后的500：初始化Promise在连接失败后一直被缓存；已在失败时关闭连接池并清除缓存，允许后续重试。2026-10-13只读确认本地28表/schema 22，health/ready恢复200。
- 报价任务持续轮询：核查为queued、attempts=0且无独立Worker；处理用户实际任务时启动一个Worker，该报价任务领取后succeeded。未创建额外测试任务；启动伴随正常会话/配额维护，没有删除过期存储文件。

这些是处理用户实际运行问题的记录，不代表全套测试已执行。2026-10-12授权复制旧项目业务配置至目标根.env并取消Git跟踪；仅保留配置事实，不记录任何密钥。生产全新库及密钥配置见部署文档，不能直接复用本地旧业务数据目标。

## 当前模块结构与责任

```text
src/app/[lang]/(workspace)/smart-eye/
├── layout.tsx                        ErrorBoundary、Toaster、模块样式
├── page.tsx                          重定向入口
├── _components/
│   ├── layout/                       sidebar、workspace-shell、workspace.module.css
│   ├── ui/                           12个实际使用的UI文件
│   ├── jobs/job-status.tsx            任务轮询与错误显示
│   └── error-boundary.tsx
├── _hooks/                           use-api、use-locale、use-ui-text
├── _lib/                             copy、ui-copy.en/zh、ui-text
├── _styles/                          smart-eye.css、pages.module.css
├── login/                            页面与login.module.css
└── app/
    ├── layout.tsx                    业务顶栏与WorkspaceShell
    ├── dashboard/                    页面与dashboard.module.css
    ├── accounts/[id]/                客户详情、联系人保存及影响力评分
    ├── projects/[id]/                项目详情
    └── 其他现有业务页面
```

- 首轮移动21个模块专用文件，更新所有消费者及Tailwind扫描路径；旧位置不保留重复重导出。
- 共用官网SiteHeader、LocaleSwitch、公共Locale类型。业务实例使用116px顶栏、244px侧栏；官网Header默认行为保持。
- `_hooks/use-locale.ts`只读[lang]；固定文案字典只做显示查找与数字格式化，不维护Context、默认语言或localStorage。旧i18n、Provider包装已删除。
- API客户端、后端lib/repositories、Worker及scripts继续保留原位置；不另建业务服务层或国际化框架。
- CSS和Dialog/Popover/Select/Toaster的Portal均保留smart-eye-scope；模块Tailwind扫描入口为`@source ".."`。页面专属样式使用CSS Modules。

## 已完成的冗余清理

| 范围 | 处理与保留边界 |
| --- | --- |
| 迁入排除 | 20个完整不可达源文件及7个文件中的不可达函数/类型，清单见附录；测试、seed、旧官网/SEO、缓存和构建产物不迁入 |
| 无消费者模块文件 | 删除5个document封装：document-download、file-upload、form-field、generated-document-history、requirement-input；另删除未启用Header |
| UI子组件 | 删除17个无内部/外部消费者的定义；6个仍有内部调用的helper只取消公共导出 |
| 后续无用包装 | 删除旧WebsiteHeader、Avatar、I18n Context和只剩包装职责的Provider |
| 样式 | 删除旧深色token、neon效果、dark类、未启用布局分支和无消费者规则；保留移动导航、Portal和有效交互 |
| 图片 | 54个被替换且无引用的旧PNG已删除；另移除2个无引用SVG导出，最终保留59个Figma本地SVG |

文件删除依据是引用归零或分支未启用。页面正在使用的CSV、历史、上传、下载、候选审核、任务及数据库表没有随孤立代码删除。

## 新设计与界面双语

通过Figma MCP Go读取“官网 (Copy)”的新高保真组`527:225`，对应页面和编辑状态读取完整节点及截图；资产直接导出SVG，保留原几何尺寸，截图不用作页面背景。

保留邮箱＋密码登录和独立注册；不新增手机登录或自动注册。没有独立画板的审核页和看板，经用户确认沿用现有布局/业务，统一新共享风格及双语。设计未画出的有效功能继续保留，包括投标模板、章节导航、表格编辑及账户退出。

菜单、按钮、字段、提示、固定状态、日期数字及任务进度适配zh/en。API参数/枚举值、组织身份、jobs payload、Worker提示词、客户数据和AI正文保持；报价、合同、投标预览、模板及下载继续保留中文。

| 页面/范围 | Figma节点 | 实现 |
| --- | --- | --- |
| 登录 | 577:2269（遮罩577:2270） | 640×577浅蓝卡片、56px字段及按钮；登录/注册切换、密码显示及认证提示双语 |
| 总览 | 531:1637 | 白色内容区、浅蓝KPI；标题、计数与金额双语，保留原汇总算法 |
| 产品库 | 577:2 | 三列500px卡片、搜索、标签和操作；保留新增/编辑、删除、AI匹配 |
| 目标客户 | 577:2768 | 500px搜索、表格、列筛选及匹配状态；保留创建、批量匹配和导出 |
| 客户详情 | 586:137、566、851 | 总览、策略卡和联系人；编辑状态参考586:1170、1634、2101、2320、2856、3463，保留保存及AI完善 |
| 项目跟进 | 577:3092 | 两列项目卡片、选择/创建/删除/导出及详情入口 |
| 项目详情 | 586:3831 | 左1000px/右530px信息区、时间节点、情报及招标详情、加入销售管线 |
| 深度情报 | 577:3740 | 产品选择及分析结果区、白色决策链卡片；保留行业/区域条件、结果标签页及批量加入客户 |
| 销售管线 | 577:3930 | 145px统计卡片及机会列表；保留筛选、编辑、阶段和金额计算 |
| 报价单 | 531:1794 | 左574px表单、右918px预览，独立滚动；保留AI填充、明细/税额计算和下载 |
| 合同 | 580:4148 | 同类表单/预览布局，保留合同金额及中文大写、AI填充和下载 |
| 投标文件 | 580:4465 | 上传与空预览按新稿；分析后保留模板、章节、缺失信息及表格编辑、下载 |
| 沟通梳理 | 580:4613 | 900px模式与输入卡片；保留音频转写、会议纪要/分析两模式及下载 |
| 格式转换 | 580:4761 | 900px上传与目标格式卡片；保留原文件格式值、转换及下载 |
| 系统设置 | 580:4898（画板误名“格式转换”，实际内容为设置） | 574px公司信息卡片，保留账户退出；字段、保存与退出提示双语 |
| 候选情报审核 | 用户确认使用共享风格 | 保留采集、批量URL提取、候选审核及promote/reject |
| 管线看板 | 用户确认使用共享风格 | 保留阶段列、机会卡片和阶段切换按钮，统计金额按语言显示 |
| 公共顶栏/导航 | 531:1791、1774、1666；559:194–252及选中状态 | 复用官网SiteHeader，116px顶栏、244px侧栏、普通/选中图标；保留公共语言切换和移动导航 |

英文允许必要换行，小屏保留原交互并自适应。没有独立移动画板；桌面设计尺寸及静态解析通过不等于浏览器像素验收。

## 验证记录及剩余事项

界面适配结束时的静态核对：18个页面入口、48个API保留；671个本地import及模块命名导出可解析，CSS Modules类名、CSS及TS/TSX语法正常。共享字典60个中英同名键，固定UI英文字典545个键，原英文界面中文字典47个键。

对照修改前快照，API调用、FormData字段、状态setter、useApi/effect/memo等核心调用一致；报价、合同和投标预览文本/数据表达式保持。196个未纳入调整的原文件哈希一致，含后端、Worker、CLI和依赖；数量变化来自明确删除的旧PNG，不表示后端文件减少。

剩余事项：用户手动核对业务保存、登录刷新、任务完成、文件读写/下载、移动端和Portal，并进行正式发布需要的类型/构建检查。官网home原有scenesInner类引用问题未在本轮处理。部署、空库初始化、SEO/GEO代码与搜索平台配置见部署文档。

Python当前仍只有采集、提取、打印，没有自动ingest、完整分页及中低频调度。供应商环境、签名URL、上传限额和付费功能需用户按实际使用验收，不把源码迁入当作功能验收。

以下重复逻辑未在本轮重构：Proxy与handler的JWT验证、API/Worker的任务类型清单、部分Origin检查。收敛前必须核实全部handler的401/500行为、组织边界及无Access Cookie的认证请求；不能为减少重复直接删除认证或真实任务handler。

## 附录：迁入排除依据

以下清单以当时来源版本为准，原行号仅作历史定位，不能当作当前目标文件行号。20个文件不在页面/API/Worker及相关维护工具的可达闭包中；本地来源代码保留。部分文件只剪裁明确不可达内容，运行功能、数据库表及历史行为没有因此删除。

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
