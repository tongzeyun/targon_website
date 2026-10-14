# Targon Website

Targon官网与Smart Eye业务应用。代码迁入、结构整理及17个界面的样式/双语适配已完成，用户反馈页面检查没有太大问题；未自动运行测试、typecheck或build。

项目文档统一为两份：

- [迁移文档](docs/SMARTSALE_MIGRATION_PLAN.md)：迁入范围、运行修复、当前目录、冗余清理、Figma映射、双语及验收记录。
- [部署文档](docs/TARGON_FRESH_DEPLOYMENT_PLAN.md)：旧项目独立清理、AWS EC2官网选型、`https://targon.cn`配置模板、启动步骤及SEO/GEO。AWS只运行官网Web，不启用Smart Eye、Worker、数据库或OSS，服务器操作由用户手动执行。

## Shared website UI

官网公共样式位于 `src/app/globals.css`，Header/Footer位于 `src/components/`。官网页面位于 `[lang]/(website)`，Smart Eye位于 `[lang]/(workspace)/smart-eye`；URL不包含路由分组名。业务复用116px公共顶栏，专属UI、CSS及Portal归模块管理。语言共用[lang]和LocaleSwitch，切换保留当前路径及query。

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

CLI使用 `@next/env` 加载Next环境规则，外部注入变量优先。生产空库初始化、镜像构建与Web/Worker启动顺序统一见部署文档。Python环境与运行边界见 [crawler说明](crawler/README.md)。
