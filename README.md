# Targon Website

Targon官网与Smart Eye业务应用。阶段A已迁入原业务代码与运行资源，尚未运行类型检查、构建或业务测试；按用户要求由用户手动验收。执行记录见 [阶段A迁入记录](docs/SMARTSALE_MIGRATION_STAGE_A.md)，迁移范围见 [迁移方案](docs/SMARTSALE_MIGRATION_PLAN.md)。

## Shared website UI

官网公共样式位于 `src/app/globals.css`，Header/Footer位于 `src/components/`。官网页面移入 `[lang]/(website)`，Smart Eye位于 `[lang]/(workspace)/smart-eye`；URL不包含路由分组名。业务保留原64px顶栏、页面和交互，CSS及Portal使用业务样式范围。语言切换保留当前路径和query；业务界面完整翻译在阶段B完成。

The design names Inter and Source Han Sans SC. The CSS uses system fallbacks until font assets and licensing are confirmed. The Figma frame is desktop-first; the shared components have basic narrow-screen behavior, while page-specific responsive designs remain to be implemented.

The global scrollbar matches the previous website. `site-fade-in` and `site-fade-out` are optional pure CSS classes for text and images. They animate when the class is applied, with a 600 ms default duration; set `--site-fade-duration` to override it. No animation package or page-level effect has been added. Scroll-triggered effects still need a trigger when specific pages are built.

## Local development

```bash
npm install
npm run dev
```

Open `/zh`, `/en`, `/zh/smart-eye/login`, or `/en/smart-eye/login`. 根URL和旧 `/smart-eye/*` 入口依据 `SITE_DEFAULT_LOCALE`（默认zh）跳转，旧业务深层路径保留query。

Smart Eye运行前，配置数据库、JWT、文件存储和所需供应商Key；变量见 `.env.example`。按用户要求，旧项目业务配置现已复制到根目录 `.env`，并保留官网默认语言；本地认证Origin适配为3000端口。Web与Worker需要连接同一数据库和存储。不要将真实env或业务文件加入Git。

Web与Worker独立运行，原有 `dev`/`build`/`start`/`typecheck` 命令不变：

```bash
npm run dev
# 在另一终端，确认数据库和存储目标后启动
npm run worker:jobs
```

生产环境使用 `NODE_ENV=production`，构建后运行 `npm run start` 和独立 `npm run worker:jobs`。CLI使用 `@next/env` 加载Next环境规则，外部注入变量优先。SQL迁移工具为 `npm run db:migrate`；已满足schema 22的原库不因代码迁入自动执行DDL，不运行seed。

新增Dockerfile保持SQL/JSON/CLI与tsx可用，镜像默认只启动Web；Worker可由独立容器覆盖命令为 `npm run worker:jobs`。本轮没有构建镜像、部署容器或修改原PostgreSQL/存储服务。Python环境与运行边界见 [crawler说明](crawler/README.md)。

## Regional deployment

Deploy the same build to both servers. Set `SITE_DEFAULT_LOCALE=zh` on the China server and `SITE_DEFAULT_LOCALE=en` on the Singapore server. The Aliyun DNS regional records select the server; every server serves both language paths. Keep `/zh` and `/en` directly accessible from either region.

官网正式发布的SEO与区域部署在后续阶段处理；Smart Eye业务路由继续保持 `noindex`。
