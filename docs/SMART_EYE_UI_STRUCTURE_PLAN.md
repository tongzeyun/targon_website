# Smart Eye项目结构规整与冗余清理方案

日期：2026-10-13。状态：待确认。按用户最新要求，本轮只整理Smart Eye前端目录、移动现有文件、删除有明确证据的无用代码；页面重画、主题切换和完整双语留到后续。尚未移动、删除业务源码或修改页面样式。

## 依据与范围

通过Figma MCP Go读取当前文件“官网 (Copy)”的“官网高保真”组 `527:225`。依据该组新画板确定结构；同文件较远位置的旧版画板不混入新主题。

- 用户提供的 `577:2270` 是登录画板内的背景遮罩Rectangle，不是完整登录页；完整画板为其父节点 `577:2269`。
- 总览为 `531:1637`，1920×1080；节点明细与截图显示白色业务区域、浅蓝卡片、深色116px公共顶栏。
- 已读取完整登录、总览、目标客户、报价、系统设置截图，及同组页面目录。后续两次节点明细请求出现连接超时；结构判断依据已成功读取的节点树和完整画板截图。正式按像素实现其他页面前重新读取其节点明细及素材，不以截图替代页面资产。
- 当前代码保留18个page入口、48个API和15类任务；本次只清理前端归属和有引用证据的冗余。保持当前64px顶栏、登录布局、深色页面、移动导航和Portal效果；不在目录整理中切换为新设计。不改变认证、业务请求、保存/生成/下载、Worker、数据库或env。
- 用户此前要求不自动运行测试；本轮规划不运行typecheck/build、业务测试或付费API。

## 画板与现有路由映射

以下业务路由均位于 `/{lang}/smart-eye` 下。

| 功能 | 新画板节点 | 现有路径 |
| --- | --- | --- |
| 登录 | 577:2269（遮罩577:2270） | /login |
| 总览 | 531:1637 | /app/dashboard |
| 产品库 | 577:2 | /app/products |
| 目标客户 | 577:2768 | /app/accounts |
| 客户公司概览 | 586:137；编辑586:1170 | /app/accounts/[id] 的公司概览 |
| 客户销售策略卡 | 586:566；编辑/添加/AI完善586:1634、586:2101、586:2320 | 同一详情路由内的tab及编辑状态 |
| 客户联系人 | 586:851；编辑/添加586:2856、586:3463 | 同一详情路由内的tab及编辑状态 |
| 项目跟进 | 577:3092 | /app/projects |
| 项目概览 | 586:3831 | /app/projects/[id] |
| 深度情报 | 577:3740 | /app/deep-research |
| 销售管线 | 577:3930 | /app/pipeline |
| 报价单制作 | 531:1794（画板名“报单价”） | /app/quotation |
| 合同制作 | 580:4148 | /app/contract |
| 标书制作 | 580:4465 | /app/bid |
| 沟通梳理 | 580:4613 | /app/meeting |
| 格式转换 | 580:4761 | /app/convert |
| 系统设置 | 580:4898 | /app/settings |

`580:4898` 的画板名称仍写“格式转换”，但完整截图的标题和内容是系统设置，映射按实际内容确定。本轮不改Figma文件。

现有 `/app/intelligence` 包含候选情报promote/reject功能，`/app/pipeline/board` 包含管线看板。这两条页面尚未找到新设计对应画板；它们是可访问业务路由，不能以缺少画板为依据删除。入口兼容跳转同样保留。

## 本轮目标目录

沿用现有App Router路由目录与私有文件夹，避免额外建立一套业务框架。

```text
src/app/[lang]/(workspace)/smart-eye/
├── layout.tsx                   # 保留当前Provider、顶栏、主题与Toaster挂载行为
├── page.tsx                     # 保留业务入口及query兼容
├── _components/
│   ├── layout/
│   │   ├── website-header.tsx    # 现有64px顶栏，只移动文件
│   │   ├── workspace-shell.tsx   # 由mobile-shell迁入，保留现有启用布局
│   │   └── sidebar.tsx           # 删除未启用分支，保留移动开关/关闭交互
│   ├── ui/                      # 迁入并剪裁当前13个实际UI文件
│   ├── jobs/job-status.tsx       # 保留任务轮询及认证错误处理
│   ├── providers.tsx
│   └── error-boundary.tsx
├── _hooks/
│   └── use-api.ts               # 只有Smart Eye页面使用的React hook
├── _lib/
│   └── i18n.tsx                 # URL语言Context；本轮保持有效契约
├── _styles/
│   └── smart-eye.css            # 现有有效主题移动到此，修正扫描路径
├── login/
│   └── page.tsx                 # 保持当前表单与登录/注册逻辑
└── app/
    ├── layout.tsx               # WorkspaceShell，现有挂载语义不变
    ├── dashboard/page.tsx
    ├── accounts/…
    ├── projects/…
    └── 其他现有业务路由           # 当前页面结构和URL不变
```

### 明确的文件移动表

以下路径均相对于仓库根目录；目标Smart Eye根目录为 `src/app/[lang]/(workspace)/smart-eye`。

| 当前位置 | 目标位置 | 理由 |
| --- | --- | --- |
| src/components/ui/*.tsx（13个） | Smart Eye/_components/ui/*.tsx | 所有消费者均在业务模块或其Provider内 |
| src/components/client-providers.tsx | Smart Eye/_components/providers.tsx | 仅业务layout挂载 |
| src/components/error-boundary.tsx | Smart Eye/_components/error-boundary.tsx | 仅业务Provider使用 |
| src/lib/i18n.tsx | Smart Eye/_lib/i18n.tsx | 当前只有业务消费者 |
| src/lib/hooks/use-api.ts | Smart Eye/_hooks/use-api.ts | 当前只有业务页面调用；本轮只改路径 |
| Smart Eye/_components/mobile-shell.tsx | Smart Eye/_components/layout/workspace-shell.tsx | 布局文件集中归属，保留移动交互 |
| Smart Eye/_components/sidebar.tsx | Smart Eye/_components/layout/sidebar.tsx | 布局文件集中归属 |
| Smart Eye/_components/website-header.tsx | Smart Eye/_components/layout/website-header.tsx | 保留正在使用的顶栏，重画时再统一 |
| Smart Eye/smart-eye.css | Smart Eye/_styles/smart-eye.css | 模块级样式归属明确，保留有效规则 |

移动完成后更新所有静态import、组件名引用、CSS import和@source路径；不保留旧目录下的兼容重导出，否则会形成另一层冗余。_components/document目录在五个无调用文件删除后移除；其他旧空目录随迁移清理。

### 保留位置与责任

- `src/components/site-header`、site-footer、LocaleSwitch、AosInit是官网或跨模块公共组件，保留公共目录，本轮不改官网布局。
- `src/lib/locales.ts`、smart-eye-paths、date-values、contact-influence、utils同时承担跨前后端或公共职责，保留原路径。
- API客户端、认证/刷新、document-job-client、lib/repositories、数据库、AI、storage、jobs与scripts保持原迁移布局，本轮不重组后端。
- JobStatus保留当前任务轮询及401/临时错误处理；客户联系人保存/影响力评分代码保留在客户详情目录。
- 现有有效样式移动到模块_styles，页面专属CSS Modules在后续设计开发时逐页补齐，本轮不新增空样式文件或拆出无使用价值的组件。
- 第三方包仍集中在根package.json；目前Base UI、日期选择、Sonner、Lucide、CVA、clsx、tailwind-merge及shadcn CSS都存在真实消费者，不因目录调整整体卸载。

## 可审阅的删除清单

### 1. 已确认无调用的完整文件

对src/scripts做TypeScript静态import追踪，并以Smart Eye全部page/layout为入口追踪可达闭包；以下五个文件既无import消费者，也不可从页面入口到达。

| 文件（相对Smart Eye根目录） | 删除依据 |
| --- | --- |
| _components/document/document-download.tsx | 0个消费者；实际下载走lib/document/document-job-client |
| _components/document/file-upload.tsx | 0个消费者；页面保留自身正在运行的上传交互 |
| _components/document/form-field.tsx | 0个消费者；当前字段由页面和实际UI直接实现 |
| _components/document/generated-document-history.tsx | 0个消费者；不能同时删除页面/API中的实际历史功能 |
| _components/document/requirement-input.tsx | 0个消费者；当前需求输入由各业务页面实现 |

确认执行时先复核引用，再删除文件及由它们独占、没有其他调用的类型/样式。

### 2. 已确认零消费的UI子组件

13个UI文件本身都有实际用途；其48个命名导出中，23个没有模块外消费者。进一步核对内部调用，以下17个组件可以剪裁：

| UI文件 | 零外部且零内部调用的组件 |
| --- | --- |
| avatar.tsx | AvatarImage、AvatarGroup、AvatarGroupCount、AvatarBadge |
| card.tsx | CardFooter、CardAction、CardDescription |
| dialog.tsx | DialogClose、DialogDescription、DialogFooter、DialogTrigger |
| popover.tsx | PopoverDescription、PopoverHeader、PopoverTitle |
| select.tsx | SelectGroup、SelectLabel、SelectSeparator |

对应组件的专属样式/类型/import随定义删除。其余6个零外部消费者导出：buttonVariants、badgeVariants、DialogPortal、DialogOverlay、SelectScrollUpButton、SelectScrollDownButton仍被各文件内部使用，保留实现，只收为私有成员。

### 3. 本轮可删除的布局分支与主题定义

- `_components/header.tsx` 只被MobileShell的 `!offsetTop` 分支引用；唯一挂载处app/layout始终传 `offsetTop=true`。保留当前true分支的渲染结果，删除旧Header及未启用的独立布局分支，移除无用途的offsetTop/smartEyeMode多模式切换。UserFooter当前启用的dark行为保持。
- `smart-eye.css` 中chart-1…5、sidebar系列token及其Tailwind映射没有页面消费者，删除这些无用定义；其余有效样式保留。
- CSS中的 scrollbar重复值与公共globals一致，执行时核对继承效果后清理重复声明，不改公共滚动条。
- 随17个无调用UI子组件删除其专属工具类及CardHeader/Card中只针对已删除子组件的状态选择器；正常focus、disabled、invalid等交互样式保留。
- 旧64px WebsiteHeader、深色卡片、btn-bg、smart-eye-dialog仍有实际调用，本轮只移动、保留。后续设计替换完成后，依引用归零再删除。
- 本轮只更新CSS import与@source路径。Tailwind入口重构、主题切换、公共顶栏复用放到设计开发阶段，避免目录整理影响渲染结果。

当前public/img的54个图片，即使排除上述五个孤立组件，仍能找到代码引用，因此本次没有可直接删除的整图片清单。页面替换为已导出的Figma资产后再依据全项目引用复核旧资产；设计截图不作为页面背景图使用。

## 本轮实施顺序与完成条件

1. 确认本方案及删除边界。保留已有迁移与运行修复，按现有分支继续，不覆盖用户已暂存改动。
2. 按移动表整理21个文件（13 UI、Provider、ErrorBoundary、I18n、hook、3布局、1 CSS），原子更新消费者和CSS扫描路径；移除旧空目录和重复重导出。
3. 删除五个孤立文档文件、未启用的Header、17个无调用UI子组件及无用途token；保留6个内部helper实现，取消它们不必要的公共导出。
4. 简化Shell/Sidebar未启用分支，保留现有桌面/移动渲染、64px偏移、登录/注册及应用布局挂载位置。
5. 静态复核18个page入口、48个API、15类任务仍在；所有本地import及CSS扫描路径可解析；JobStatus、历史/下载等实际功能的调用链保留；每个删除项都有引用归零或未启用分支证据。
6. 按用户此前要求，自动工作只做引用与文件完整性核对，不运行typecheck/build、业务测试或付费调用；最终由用户手动验收，不能把静态核对标记为视觉或功能已验收。

本轮主要风险是跨目录import遗漏、CSS扫描相对路径错误、Portal主题丢失及把内部helper误当成无用代码。通过一次性更新全部引用、保留Portal类名与有效样式、区分外部消费和内部调用控制这些风险。只完成静态核对不能替代用户的运行验收。

## 后续设计开发，不属于本轮目录整理

按前述Figma映射开发登录、总览和其他页面；接入116px公共顶栏、分开登录/应用视觉布局，逐页补充CSS Modules、固定文案zh/en，并在替换后清理仍在使用的旧深色规则、旧顶栏和旧资产。不会在本轮预先删除这些有效实现。

登录画板的“邮箱/电话号码”和“新用户可直接登录”不代表后端已有手机登录或自动注册能力；当前认证契约保持email/password及原注册机制，功能变更需独立确认。
