# Targon官网AWS部署、SEO与GEO方案

更新日期：2026-10-14。状态：方案与手动配置参考，未连接服务器、删除资源、构建或部署。官网专用发布版本和SEO/GEO代码调整尚待实施。

本文统一管理AWS官网选型、服务器配置、旧资源清理和SEO/GEO；Smart Eye代码迁入、设计与双语记录见 [迁移文档](SMARTSALE_MIGRATION_PLAN.md)。

## 已确认目标

- 正式域名`https://targon.cn`，AWS新建EC2只运行公开官网，支持zh/en。
- AWS不启用Smart Eye、Worker、PostgreSQL、业务注册/登录、爬虫或第三方AI服务，不配置阿里云OSS等业务存储。
- 按约50个并发官网访问用户选择起步规格，不扩展多机架构。以下是容量估算，未进行压力测试。
- 服务器配置、构建、上线及搜索平台配置由用户手动完成。
- 旧官网/Smart Eye专属资源清理作为独立事项，仍限于原确认范围，不涉及其他项目；不将旧库或文件导入AWS官网。
- GEO在本文指生成式AI搜索优化。公开介绍Smart Eye产品可以保留，其业务使用入口需在官网版本中移除或调整。

## AWS EC2起步选型

| 配置 | 建议 |
| --- | --- |
| 实例 | `t3a.medium`：2 vCPU、4 GiB、x86_64；Region无T3a时选`t3.medium` |
| 系统 | Canonical Ubuntu Server 24.04 LTS x86_64 |
| 磁盘 | 加密gp3，40 GiB起步，默认3000 IOPS和125 MiB/s |
| 购买方式 | On-Demand按需 |
| 公网地址 | 一个Elastic IP用于域名解析，单独计费 |
| 进程 | 宿主机Nginx＋一个官网Web容器 |
| 入站 | 80/443对外，22仅允许管理者IP；Node容器仅绑定本机地址 |
| 文件 | 官网图片及资源随发布镜像提供，没有业务上传文件或数据库目录 |

4 GiB用于官网运行并留出部署构建余量；资源更紧的实例可在外部构建镜像后运行，但初期优先4 GiB。构建峰值仍需实际观察，不能把运行占用当作构建内存上限。

[AWS T3/T3a规格](https://aws.amazon.com/ec2/instance-types/t3/)、[gp3规格](https://aws.amazon.com/ebs/volume-types/)、[公网IPv4价格](https://aws.amazon.com/vpc/pricing/)。T系列使用CPU积分，持续高CPU在Unlimited模式可能额外计费；上线后观察实际利用率再决定是否调整。

Region尚未确定；可比较新加坡和香港，按用户所在地与实际线路选择。报价应以最终Region、Linux按需及运行小时数为准，另计磁盘、公网IPv4、流量、快照和税费。

2026-10-14核对AWS官方价格表：新加坡Linux/Shared/On-Demand下，t3a.medium为0.0472美元/小时，每月730小时约34.46美元；备选t3.medium为0.0528美元/小时，约38.54美元。t3a.medium加40 GiB gp3和一个公网IPv4，基础预算约40–50美元/月，另计流量、快照、CPU积分超额和税费；最终以所选Region账单为准。[AWS新加坡价格表](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/ap-southeast-1/index.json)、[EBS价格](https://aws.amazon.com/ebs/pricing/)。

## 当前代码与发布边界

| 项目 | 现状 | 官网版本要求 |
| --- | --- | --- |
| Dockerfile | Node 22.21.1，Next 16.2.7；默认`npm run start`，包含当前完整项目 | 发布官网专用版本，只启动Web；本次不升级依赖 |
| Smart Eye | 仓库仍包含页面/API及兼容跳转 | 不能只靠不启动Worker屏蔽业务；发布时应排除或禁用业务路由/API及兼容入口，调整官网上的业务链接 |
| 官网依赖 | 当前官网页面没有发现数据库/业务API调用 | 不设置DATABASE_URL、JWT、OSS、讯飞或DeepSeek配置 |
| 健康检查 | `/api/health/live`不访问数据库；ready需要数据库 | 官网使用live检查，不使用ready |
| 网站SEO | 当前[lang]根布局noindex/nofollow；缺sitemap/robots等 | 按下方SEO步骤补齐，公开官网准备好后开放收录 |

当前没有已实现的“设置某个环境变量就切换官网专用构建”功能。官网发布边界需要明确落实后再使用以下部署模板；不删除本地Smart Eye迁移成果，也不将其未启用误认为已从镜像移除。

先沿用Next服务部署。静态导出可以后续评估，但当前Proxy、重定向、业务API和动态路由使整仓库不能直接切换`output: export`；需要先形成官网专用范围并核对功能。[Next静态导出说明](https://nextjs.org/docs/app/guides/static-exports)

## 一、旧项目清理清单

先准备当前项目的可部署版本和配置，再进入维护窗口清理旧项目。不要先删旧数据，再发现新镜像无法构建。用户此前要求不自动运行测试；正式发布前的类型检查、构建与验收由用户手动完成。

### 1. 读取实际资源，填写删除清单

服务器上先只读核验：

```bash
docker compose ls
docker ps -a --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}'
docker volume ls
docker network ls
ss -lntp
# 将容器ID替换为实际旧项目容器；仅查看归属及挂载，不输出环境变量。
docker inspect --format '{{json .Config.Labels}}' <旧容器ID>
docker inspect --format '{{json .Mounts}}' <旧容器ID>
```

| 对象 | 已知参考/应填写内容 | 删除原则 |
| --- | --- | --- |
| 旧Compose项目、Web/Worker容器 | 源项目Compose声明`name: saleseye`；服务器实际名称待核验 | 停止旧入口、任务触发和Worker，再删除确属旧项目的容器 |
| 旧项目代码、镜像和部署包 | 填写绝对路径、发布目录和镜像标签 | 删除指定旧目录/标签，不扫掉其他项目或当前项目源码 |
| 旧PostgreSQL数据 | 源Compose挂载`/var/lib/saleseye/postgres` | 此路径只是源码参考；若实际为专用库/专用容器才删除整个数据目录；共享实例只清理旧库及专用角色 |
| 旧备份 | 源Compose挂载`/var/backups/saleseye/postgres`；云盘快照另列 | 核实归属、保留要求后逐项决定；未列明的备份不自动删除 |
| 旧本地文件/OSS | 填写挂载目录，或bucket及对象范围 | OSS不在服务器磁盘上，需另外处理；共享bucket只删确认的旧对象，启用版本控制时还要核对历史版本 |
| 旧启动/定时配置 | cron、systemd、Compose重启配置、外部HTTP Worker触发、crawler调度 | 取消后再删除程序，避免旧任务重启或继续付费调用 |
| 旧Nginx/CDN配置 | 只列旧官网/Smart Eye的虚拟主机、upstream和缓存 | 保留其他站点、Nginx服务及仍有效的targon.cn证书，替换本项目配置 |

停止/删除Compose容器不会自动删掉宿主机bind mount数据目录。不要用全局`docker system prune --volumes`或删除整个`/var/lib/docker`来实现项目清理。[Docker Compose down文档](https://docs.docker.com/reference/cli/docker/compose/down/)

本文不提供未经服务器核验的批量删除脚本。用户实际删除前，清单应包含具体对象、绝对路径、共享关系和备份处理决定。

### 2. 维护窗口顺序

1. 旧官网/业务入口进入维护状态，停止新任务提交和旧采集/HTTP触发调度。
2. 优雅停止旧Worker，确认不再写库或上传文件；本次不迁移旧排队任务。
3. 停止旧Web及属于旧项目的数据库容器/服务，确认没有其他项目连接同一数据库。
4. 按已核验清单删除旧项目代码、容器、镜像、专用数据库数据、本地文件和确定删除的云端文件/备份。
5. 清除旧项目自动启动配置，检查其他业务服务仍正常。

如果不保留旧备份，删除后不能按旧迁移方案恢复历史业务。本项目新版本的故障恢复是重新部署新镜像/恢复新项目备份，不再回到已删除旧项目。

## 二、AWS官网生产配置

建议Compose项目名`targon-website`，镜像`targon-website:<版本>`。以下路径和端口为建议值，由用户手动创建、核实。

```text
/opt/targon/app/                  官网发布源码、Dockerfile、compose.production.yml
/opt/targon/env/compose.env       非密钥版本配置，不进入镜像构建上下文
```

官网运行配置只需要：

| 变量 | 值/处理 |
| --- | --- |
| NODE_ENV | `production`，现有Dockerfile已设置 |
| SITE_DEFAULT_LOCALE | `zh`，`/zh`和`/en`均可访问 |
| NEXT_TELEMETRY_DISABLED | `1` |
| SITE_URL | 仅在SEO代码实现读取它后使用`https://targon.cn`；当前无该开关 |

不要把本地包含Smart Eye密钥的.env复制到AWS官网。没有数据库初始化、账号/组织创建或存储bucket配置步骤。`NEXT_PUBLIC_*`变量在构建时固化，后续新增相关配置时需同步考虑构建环境。[Next环境变量说明](https://nextjs.org/docs/app/guides/self-hosting#environment-variables)

compose.env：

```dotenv
TARGON_VERSION=2026-10-14-v1
```

### Compose参考

保存为`/opt/targon/app/compose.production.yml`；3300端口需核实未被其他服务占用。模板供完成官网发布边界后的版本使用，不启动业务服务。

```yaml
name: targon-website
services:
  web:
    build: {context: ., dockerfile: Dockerfile}
    image: targon-website:${TARGON_VERSION:?Set TARGON_VERSION}
    restart: unless-stopped
    init: true
    environment:
      NODE_ENV: production
      SITE_DEFAULT_LOCALE: zh
      NEXT_TELEMETRY_DISABLED: '1'
    ports: ['127.0.0.1:3300:3000']
    healthcheck:
      test: [CMD, node, -e, "fetch('http://127.0.0.1:3000/api/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    stop_grace_period: 30s
    logging:
      driver: local
      options: {max-size: 10m, max-file: '3'}
```

### 手动构建与启动

先完成官网专用版本、SEO/GEO代码及真实内容，再由用户手动进行构建和必要验收。以下不是已执行记录。

```bash
cd /opt/targon/app
docker compose --env-file ../env/compose.env -f compose.production.yml config --quiet
docker compose --env-file ../env/compose.env -f compose.production.yml build web
docker compose --env-file ../env/compose.env -f compose.production.yml up -d web
docker compose --env-file ../env/compose.env -f compose.production.yml ps
docker compose --env-file ../env/compose.env -f compose.production.yml logs --tail=100 web
```

不运行db:migrate、Worker或crawler。live只证明Web可响应，官网各页面及SEO仍需用户手动核对。

### HTTPS与访问范围

宿主机Nginx反向代理至`127.0.0.1:3300`，80跳HTTPS，使用实际有效的targon.cn证书。转发Host、X-Real-IP、X-Forwarded-For、X-Forwarded-Proto，并保留请求ID；Nginx配置通过`nginx -t`后reload。[Next自托管指南](https://nextjs.org/docs/app/guides/self-hosting#reverse-proxy)

只开放官网、其静态资源及需要的健康检查入口。发布范围应覆盖`/zh`、`/en`和实际公开页面；业务/API及旧业务兼容跳转不可通过直接请求绕过。业务路由隔离须在官网版本落实，Nginx可增加防护，但不能把隐藏导航链接当作禁用。

将targon.cn DNS解析指向EC2 Elastic IP；如使用www，额外配置DNS和TLS后统一跳主域名。健康检查不连接任何数据库。官网资源缓存按实际响应及版本区分，不缓存错误响应；保留发布镜像/配置用于回滚。

## 三、SEO重新建设

### 代码层需要修改的文件与行为

1. `[lang]/(website)/layout.tsx`增加公开官网的metadata覆盖，设置index/follow，避免继承根布局noindex。Smart Eye布局继续noindex；业务URL不进入sitemap。
2. 各公开页面设置独立zh/en title、description、canonical、Open Graph和分享图片。metadataBase使用正式HTTPS域名，避免生成localhost或相对canonical。
3. 对应中文/英文页面互相声明hreflang，并设置合理x-default入口；英文页不能canonical到中文页。[Google多语言页面指南](https://developers.google.com/search/docs/specialty/international/localized-versions)
4. 新增`src/app/sitemap.ts`：只列当前实际公开路由；lastModified使用真实内容变更时间，不把每次请求时间当作更新时间。
5. 新增`src/app/robots.ts`：允许公开官网抓取，声明sitemap；登录/业务依靠noindex和认证控制，不把robots当成权限或去索引措施。需要搜索引擎读取noindex的页面不能同时被robots禁止抓取。[Google robots说明](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
6. 增加与可见内容一致的Organization、适用的产品/服务及Breadcrumb结构化数据；不生成虚构评分、评价、证书或客户案例。
7. 检查关键介绍、规格、联系方式在初始HTML中可读取；检查标题层级、图片替代文字、图片尺寸、移动端及页面加载表现。

公开路由现有10种，每种有zh/en版本，初始sitemap预计20个页面：

```text
/{lang}
/{lang}/products
/{lang}/products/vacuum-ai
/{lang}/products/pump-gauge-controller
/{lang}/products/enterprise-brain
/{lang}/products/edge-collector
/{lang}/products/industrial-agent
/{lang}/products/outgassing-platform
/{lang}/cases
/{lang}/contact
```

### 发布后的手动操作

- 核对生产页面的robots、canonical、hreflang、JSON-LD及分享图片；确认`/robots.txt`和`/sitemap.xml`可访问。
- 在Google Search Console验证targon.cn并提交sitemap；其他搜索平台按实际投放地区配置。
- 已收录旧网址有对应新内容时逐条301/308；无对应内容返回404/410，不全部跳首页。[Google网址迁移指南](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- 清理本项目CDN中的旧页面缓存，保留新版本静态资源正确缓存。
- 清理服务器不会清空搜索引擎索引或域名历史；索引更新取决于后续抓取和处理。

## 四、GEO内容与可引用性

GEO基于可抓取的公开内容和事实建设。Google明确说明AI Overviews/AI Mode没有额外专属技术要求，也不要求特殊AI文本文件或专属schema；不能把llms.txt当成排名保证。[Google AI搜索说明](https://developers.google.com/search/docs/appearance/ai-features)

优先完善现有产品、案例、联系页面：

- 公司/品牌名称、产品名称和中英文对应一致；补全真实业务范围、联系方式及可验证资质。
- 每个产品明确说明是什么、适用场景、能力/参数、使用限制、集成方式和常见问题，使用可引用的正文、列表及参数表。
- 案例写真实背景、实施方式、结果和证据；没有证据的客户名称、量化效果不作为已验证事实发布。
- 内容需要时注明真实作者/审核人、来源和真实更新时间，不虚构专业身份。[Google可靠内容指南](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- zh/en含义一致，英文不能只是关键词堆砌；通过相关页面链接形成清楚的产品与应用关系。
- AI搜索抓取与模型训练抓取策略分别决定；公开官网和登录后的业务数据边界保持清楚。
- 观察收录、品牌/产品相关查询、搜索转化以及可识别的AI来源访问，按结果迭代，不承诺引用或排名。

## 五、执行顺序与完成条件

1. 创建AWS EC2，配置安全组、Elastic IP、Docker/Compose和Nginx。
2. 在当前项目形成官网专用发布版本，禁用业务入口/API，补齐SEO/GEO代码和真实内容。
3. 用户构建并启动一个Web容器，检查官网zh/en、页面资源、健康响应和业务路由隔离；不启动数据库、Worker或存储服务。
4. 配置HTTPS、切换targon.cn解析并确认实际页面可访问；检查SEO标签、robots、sitemap及分享图。
5. 公开内容准备好后开放index并提交搜索平台；记录版本、观察CPU/内存/磁盘和访问表现。
6. 原服务器旧项目按确认范围单独手动清理，其他项目保留；AWS不恢复旧库或文件。

如果内容尚未准备好，先保持公开官网noindex，内容和代码完成后再开放收录。当前工作区含未提交及新文件，构建/打包应包含实际发布文件，不只使用远端旧版本。

完成条件：targon.cn的公开zh/en官网独立运行，Smart Eye及业务API未启用，不依赖数据库/Worker/OSS，公开SEO入口正常。代码及服务器操作仍待实际实施；本文不是已上线或SEO/GEO已完成的声明。
