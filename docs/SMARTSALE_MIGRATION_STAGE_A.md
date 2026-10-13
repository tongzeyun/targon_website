# Smart Eye阶段A迁入记录

日期：2026-10-12。状态：**代码及运行资源迁入完成，待用户手动验收**。本文是执行记录，迁移方案仍以 `SMARTSALE_MIGRATION_PLAN.md` 为准。

## 执行边界

用户要求阶段A完成后不运行测试，由用户手动测试。本轮未运行typecheck、build、Web/Worker、db:migrate、seed、业务回归、Docker镜像构建、第三方API或Python采集/调度。静态文件、引用与依赖元数据核对不代表功能已验收。英文路由可访问的代码已接入，完整英文界面属于阶段B。

没有复制源项目真实env、备份或业务文件，没有连接或修改原PostgreSQL/OSS，没有修改旧项目代码或旧Docker配置。目标 `.env` 中原有官网默认语言配置保留；实际业务配置待手动配置到 `.env.local` 或通过部署环境注入，变量模板见 `.env.example`。

后续配置更新（2026-10-12）：经用户授权，旧 `.env.local` 的36项业务配置已整份复制到目标 `.env`，保留官网默认语言，且.env已取消Git跟踪。排查当前localhost:3000的401/刷新403时，发现旧AUTH_TRUSTED_ORIGIN仍限定3876；已将目标认证Origin及NEXT_PUBLIC_APP_URL适配为3000，认证代码不变。当前DATABASE_URL指向127.0.0.1:5432，本机该端口未监听，Docker服务未运行；数据库实际版本与schema仍未连接核验。未启动数据库、Web或Worker，未运行测试。

## 基线

| 项目 | 迁入前状态 |
| --- | --- |
| 来源 | `D:/T_workspace/saleseye`，master，`16c839861b5e15a2d36d54c943f5ccc90b494e12` |
| 来源未提交变更 | 旧官网 `src/app/(website)/page.tsx` 修改；8个历史部署压缩包/校验文件删除；均未改动 |
| 目标 | `D:/T_workspace/TargonWebsite`，main，`6d1686a7d361c411c40e2952ffed411fb9c70df0` |
| 目标未提交变更 | `docs/SMARTSALE_MIGRATION_PLAN.md` 和 `next-env.d.ts`；原有修改保留，方案仅更新当前状态并追加本轮执行约定 |
| 工作分支 | `codex/smart-eye-migration`；本轮未自动提交或推送 |
| 本地Node | 22.21.1，npm 10.9.4；当前目标lockfile所有声明Node engine均满足 |
| 旧部署声明 | Dockerfile为Node 22 bookworm-slim，Compose数据库镜像为PostgreSQL 16 bookworm；未核验实际服务器版本或schema |
| 数据/Worker边界 | 源env声明OSS存储；真实bucket、schema、任务状态和外部调度入口未连接核验 |

## 迁入内容

| 内容 | 本轮处理 |
| --- | --- |
| 后端 | 原路径迁入db、repositories、API认证/客户端、AI、crawler、document、jobs、storage、alert及可达工具 |
| API | 48个 `src/app/api/**/route.ts`，保留原路径和实现，不加语言前缀 |
| 页面 | 18个Smart Eye页面及实际组件迁入 `src/app/[lang]/(workspace)/smart-eye` |
| UI | 13个实际UI文件、use-api hook、ErrorBoundary、业务Provider和Toaster |
| 运行资源 | Worker、Next环境加载入口、db:migrate、模板维护CLI、基线SQL及017–022增量SQL、bid-template.json |
| 图片 | 54个业务实际引用图片迁入 `public/img`；官网 `public/image` 未变 |
| Python | 原采集/提取源码、requirements与说明，独立 `crawler/.venv`；Python 3.13.9、requirements依赖和Chromium已安装在本地独立目录；不扩展分页、调度或入库 |
| 打包 | Dockerfile和.dockerignore，保留SQL/JSON/源CLI及tsx；默认Web命令，Worker独立启动 |

排除方案所列20个完整无调用文件、测试、seed/seed-logic、旧官网/SEO、构建产物和缓存。7个允许局部剪裁的文件只移除方案列出的不可达函数、类型或测试导出；Worker真实清理、刷新重试、认证、配额、任务handler及存储适配器保留。

依赖采用方案指定的旧lockfile解析版本；新增tsx为生产可用依赖，显式声明@next/env和@types/pg。Next保持16.2.7，React/React DOM保持19.2.4，目标原有解析版本没有升级；没有添加Vitest、未用Radix、recharts或孤立PDF/模板依赖。

## 必要接线改动及取舍

- `[lang]/layout.tsx` 保留语言校验和html/body，官网Header/Footer/AOS移到 `(website)/layout.tsx`，官网URL及原页面内容保持；首页Smart Eye按钮改为实际业务入口。
- 原64px业务顶栏、侧栏和移动导航保留；内部链接、高亮、登录/退出/401回跳使用当前URL语言，安全next路径仅接受站内业务app路径。
- 旧 `/smart-eye/*` 通过兼容路由按SITE_DEFAULT_LOCALE跳转并保留query；源Next配置中旧裸业务路径通过Proxy兼容，不占用官网 `/products`。
- 原Proxy认证、CSRF/Origin和精确CORS检查保留；本地默认CORS来源增加目标3000端口。部署时用AUTH_TRUSTED_ORIGIN/CORS_ORIGINS明确配置实际域名，不把原局域网来源当作生产域名。
- 业务CSS只引入业务token、组件规则和必要Tailwind配置；容器及Dialog/Popover/Select/Toaster使用smart-eye-scope，目标globals.css保持。
- I18n Context用URL语言初始化，避免旧localStorage语言覆盖URL；只接入现有字典，未承诺完整业务翻译。
- CLI改用Next的loadEnvConfig，外部环境优先；生产运行时显式设置NODE_ENV=production，与Web环境加载一致。
- Docker沿用整项目运行目录的方式保留CLI/SQL资源，换取较大的运行镜像；本轮不引入standalone打包重构或新数据库服务。

## 静态核对

- 本地import路径未发现缺失；迁入数量为18页面、48 API、13 UI、54图片、7 SQL。
- 48个API文件及017–022增量SQL内容与源文件一致；排除文件、测试和seed没有迁入。
- 目标原有依赖解析版本未变化，新增指定依赖与旧lockfile解析版本一致，传递依赖Node engine满足本地22.21.1。
- 官网迁移文件除layout接线及Smart Eye首页卡片外，与目标基线内容一致；next-env.d.ts原有未提交内容未被覆盖。
- 以上只核对迁入完整性，不替代类型检查、构建、页面或业务测试。

## 手动运行入口与待验收项

1. 当前业务配置已按用户要求放入根目录 `.env`；部署可通过环境注入，变量模板见 `.env.example`。Web、Worker共用DATABASE_URL、JWT、local目录或OSS目标；沿用原数据时确认schema至少22，不因代码搬迁自动跑DDL。
2. 保持原官网命令：`npm run dev`；Worker单独执行 `npm run worker:jobs`。`dev`不会自动启动Worker。生产构建后分别使用 `npm run start` 和 `NODE_ENV=production` 下的Worker命令。
3. 页面入口为 `/zh/smart-eye/login`、`/en/smart-eye/login`；业务入口 `/{lang}/smart-eye` 跳至quotation。旧 `/smart-eye/login`、旧深层路径和query兼容也待验收。
4. 用户自行执行typecheck/build，按迁移方案阶段A统一测试清单检查登录刷新、组织隔离、CRUD/CSV、文档任务及下载、AI任务、上传/转换/转写、取消恢复/cleanup、官网和移动端Portal。
5. Python当前只采集、提取、打印。自动ingest、完整分页、中低频调度不属于已迁入可用能力；实际采集与付费API均未验证。环境准备与命令见 `crawler/README.md`。

在用户完成手动验收前，不将本版本标记为旧业务“已经跑通”，也不切换或释放旧环境。
