import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/locales";
import { HomeCarousel } from "./home-carousel";
import styles from "./home.module.css";

type Props = { params: Promise<{ lang: string }> };

const chainStepIcons = [
  "/image/home-chain-needs.png", // 527:943
  "/image/home-chain-ai-assistant.png", // 527:946
  "/image/home-chain-model-calculation.png", // 527:951
  "/image/home-chain-component-matching.png", // 527:954
  "/image/home-chain-certification.png", // 527:932
  "/image/home-chain-maintenance.png", // 527:966
  "/image/home-chain-secondhand.png", // 527:958
  "/image/home-chain-new-equipment.png", // 527:963
] as const;

const ecosystemImages = [
  "/image/home-ecosystem-hardware.png", // 564:359
  "/image/home-ecosystem-data.png", // 564:360
  "/image/home-ecosystem-ai.png", // 565:382
  "/image/home-ecosystem-model.png", // 565:368
  "/image/home-ecosystem-services.png", // 565:379
] as const;

const copy = {
  zh: {
    title: "首页 | 探氩科技",
    description: "探氩科技面向真空与半导体产业，连接工业硬件、AI 软件、专业模型计算与产业服务。",
    heroTitle: "让工业产品，更智能",
    heroIntro: "TARGON 聚焦真空与半导体产业，将工业硬件、AI 软件与产业服务连接起来，让设备数据真正进入智能应用。",
    philosophyTitle: "AI不只是回答问题",
    philosophyIntro: "TARGON，让 AI 从“会回答”走向“能工作”",
    pillars: [
      ["理解行业", "理解设备、文件、数据、客户与业务。"],
      ["辅助决策", "基于行业知识和业务数据进行分析与判断。"],
      ["推动执行", "从信息获取进一步进入任务、流程与实际业务。"],
    ],
    offeringTitle: "AI 软件与真空、半导体工业硬件",
    offeringIntro: "TARGON 面向真空与半导体产业，提供 AI 软件产品与工业硬件产品，将人工智能能力与真实设备及产业场景连接起来。",
    softwareTitle: "AI 软件产品",
    software: [
      { name: "Vacuum AI", description: "真空产业智能化平台，模型计算、元件交易、二手流通、维修保养、认证服务。", type: "产业平台", action: "查看案例", image: "vacuum" },
      { name: "Local Industrial Agent", description: "让每一台设备拥有自己的 AI Agent——设备理解、故障诊断、预测维护、工艺优化、多设备协作。", type: "工业AI", action: "了解产品", image: "agent" },
      { name: "Enterprise Brain", description: "让企业拥有真正能执行任务的 AI 中枢——文件理解、数据核对、知识管理、任务执行、流程协作。", type: "企业AI", action: "了解产品", image: "brain" },
      { name: "灵眸智售", description: "专为B2B销售打造的 AI 销售赋能平台\n市场情报 → 目标客户 → 采购决策链 → 项目跟进 → 报价 → 成交。", type: "销售AI", action: "进入灵眸智售", image: "smartEye" },
    ],
    hardwareTitle: "真空与半导体工业硬件",
    hardwareHeadline: "面向真空与半导体产业的\n工业设备与硬件产品",
    hardwareIntro: "TARGON 聚焦真空与半导体产业，提供设备数据采集、真空测试与真空控制等工业硬件，连接设备、测试与智能应用。",
    hardwareAction: "查看硬件产品",
    hardwareTags: ["真空测量", "泵控制", "数据采集", "真空研究"],
    collector: "TARGON边缘采集器",
    outgassing: "材料与零部件释气智能研究平台",
    chainTitle: "从一次计算\n到整个真空产业链",
    chainIntro: "Vacuum AI 正在把真空行业分散的技术、产品与服务连接起来。",
    chainAction: "查看Vacuum AI",
    chainSteps: ["需求", "AI智能助手", "模型计算", "元件匹配", "认证服务", "维修保养", "二手交易", "新件交易"],
    scenes: [
      { name: "Vacuum AI", headline: "AI，正在真实场景中发生", description: "Vacuum AI——从真空计算到产业服务的平台实践", image: "/image/home-scene-vacuum-ai.png", imageAlt: "Vacuum AI 平台界面" },
      { name: "Local Industrial Agent", headline: "AI，正在工业现场发生", description: "Local Industrial Agent——面向真空与半导体设备的本地化工业 AI Agent", image: "/image/home-scene-industrial-agent.png", imageAlt: "Local Industrial Agent 平台界面" },
      { name: "Enterprise Brain", headline: "AI，正在企业业务中发生", description: "Enterprise Brain——从企业知识到业务执行的 AI 智能中枢", image: "/image/home-scene-enterprise-brain.png", imageAlt: "Enterprise Brain 知识库界面" },
      { name: "灵眸智售", headline: "AI，正在销售现场发生", description: "灵眸智售——从市场洞察到客户成交的 AI 销售智能平台", image: "/image/home-scene-smart-eye.png", imageAlt: "灵眸智售报价单界面" },
    ],
    reasonsTitle: "为什么选择Targon？",
    reasons: [
      ["行业知识", "深入真空与半导体产业场景"],
      ["AI 技术", "将大模型与实际业务任务结合"],
      ["工业计算", "以模型计算等技术能力支撑产业应用"],
      ["场景落地", "从 AI 对话进一步进入设备、企业和销售流程"],
    ],
    reasonsIcons: [
      "/image/home-targon-1.png",
      "/image/home-targon-2.png",
      "/image/home-targon-3.png",
      "/image/home-targon-4.png",
    ],
    ecosystemTitle: "从工业产品，到产业智能",
    ecosystemIntro: "TARGON 面向真空与半导体产业，连接工业硬件、边缘数据采集、AI 软件、专业模型计算与产业服务，形成覆盖设备、数据、计算与应用的产品与服务体系。",
    ecosystem: [
      ["工业硬件", "真空设备·真空泵·真空元件"],
      ["边缘数据采集", "设备数据·运行状态·工艺参数"],
      ["AI软件", "智能助手·产业应用·业务系统"],
      ["专业模型计算", "模拟计算·选型分析·预测优化"],
      ["产业服务", "设备交易·维修服务·认证服务"],
    ],
  },
  en: {
    title: "Home | Targon",
    description: "Targon connects industrial hardware, AI software, model computation, and industry services for the vacuum and semiconductor industries.",
    heroTitle: "Smarter Industrial Products",
    heroIntro: "TARGON focuses on the vacuum and semiconductor industries, connecting industrial hardware, AI software, and industry services so equipment data can support intelligent applications.",
    philosophyTitle: "AI Does More Than Answer Questions",
    philosophyIntro: "TARGON takes AI from answering questions to getting work done.",
    pillars: [
      ["Understand the Industry", "Understand equipment, documents, data, customers, and operations."],
      ["Support Decisions", "Analyze and assess using industry knowledge and business data."],
      ["Drive Execution", "Move from information to tasks, workflows, and real operations."],
    ],
    offeringTitle: "AI Software and Industrial Hardware",
    offeringIntro: "TARGON provides AI software and industrial hardware for the vacuum and semiconductor industries, connecting AI capabilities with real equipment and industrial applications.",
    softwareTitle: "AI Software Products",
    software: [
      { name: "Vacuum AI", description: "An intelligent platform for the vacuum industry: model calculations, component trading, secondhand equipment, maintenance, and certification services.", type: "Industry Platform", action: "View Cases", image: "vacuum" },
      { name: "Local Industrial Agent", description: "An AI Agent for equipment understanding, fault diagnosis, predictive maintenance, process optimization, and coordination across devices.", type: "Industrial AI", action: "Explore Product", image: "agent" },
      { name: "Enterprise Brain", description: "An AI hub for enterprise tasks: document understanding, data checking, knowledge management, task execution, and workflow collaboration.", type: "Enterprise AI", action: "Explore Product", image: "brain" },
      { name: "Smart Eye", description: "An AI sales platform for B2B teams, from market intelligence to customer deals.", type: "Sales AI", action: "Explore Smart Eye", image: "smartEye" },
    ],
    hardwareTitle: "Vacuum and Semiconductor Hardware",
    hardwareHeadline: "Industrial Equipment and Hardware for Vacuum and Semiconductor Applications",
    hardwareIntro: "TARGON provides hardware for equipment data acquisition, vacuum testing, and vacuum control, connecting equipment, testing, and intelligent applications.",
    hardwareAction: "Explore Hardware",
    hardwareTags: ["Vacuum Measurement", "Pump Control", "Data Acquisition", "Vacuum Research"],
    collector: "TARGON Edge Collector",
    outgassing: "Intelligent Outgassing Research Platform",
    chainTitle: "From One Calculation\nto the Vacuum Industry Chain",
    chainIntro: "Vacuum AI connects the technologies, products, and services of the vacuum industry.",
    chainAction: "Explore Vacuum AI",
    chainSteps: ["Needs", "AI Assistant", "Model Calculation", "Component Matching", "Certification", "Maintenance", "Secondhand", "New Equipment"],
    scenes: [
      { name: "Vacuum AI", headline: "AI at Work in Real Applications", description: "Vacuum AI brings real calculations and industry services together on one platform.", image: "/image/home-scene-vacuum-ai.png", imageAlt: "Vacuum AI platform interface" },
      { name: "Local Industrial Agent", headline: "AI at Work on the Factory Floor", description: "A local Industrial AI Agent for vacuum and semiconductor equipment.", image: "/image/home-scene-industrial-agent.png", imageAlt: "Local Industrial Agent platform interface" },
      { name: "Enterprise Brain", headline: "AI at Work in Enterprise Operations", description: "An AI hub from enterprise knowledge to business execution.", image: "/image/home-scene-enterprise-brain.png", imageAlt: "Enterprise Brain knowledge base interface" },
      { name: "Smart Eye", headline: "AI at Work in Sales", description: "An AI sales platform from market insight to customer deals.", image: "/image/home-scene-smart-eye.png", imageAlt: "Smart Eye quotation interface" },
    ],
    reasonsTitle: "Why Targon?",
    reasonsIcons: [
      "/image/home-targon-1.png",
      "/image/home-targon-2.png",
      "/image/home-targon-3.png",
      "/image/home-targon-4.png",
    ],
    reasons: [
      ["Industry Knowledge", "Deep experience with vacuum and semiconductor applications"],
      ["AI Technology", "Connecting large models with real business tasks"],
      ["Industrial Computing", "Model based capabilities that support industrial applications"],
      ["Real Applications", "Moving AI from conversation into equipment, operations, and sales"],
    ],
    ecosystemTitle: "From Industrial Products to Industry Intelligence",
    ecosystemIntro: "TARGON connects industrial hardware, edge data acquisition, AI software, specialized model computation, and industry services across the vacuum and semiconductor industries.",
    ecosystem: [
      ["Industrial Hardware", "Equipment · Vacuum Pumps · Components"],
      ["Edge Data Acquisition", "Equipment Data · Status · Process Parameters"],
      ["AI Software", "Assistants · Applications · Business Systems"],
      ["Model Computation", "Simulation · Selection · Prediction"],
      ["Industry Services", "Trading · Maintenance · Certification"],
    ],
  },
} as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { title: copy[lang].title, description: copy[lang].description, robots: { index: false, follow: false } };
}

export default async function HomePage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const content = copy[lang];

  return (
    <main className={styles.page}>
      <section className={`site-bg-box ${styles.hero}`} aria-labelledby="home-heading">
        <div className={`site-container ${styles.heroContent}`}>
          <p data-aos="fade">{content.heroIntro}</p>
          <h1 id="home-heading" data-aos="fade">{content.heroTitle}</h1>
        </div>
      </section>

      <section className={`site-container ${styles.philosophy}`} aria-labelledby="philosophy-heading">
        <h2 id="philosophy-heading" data-aos="fade">{content.philosophyTitle}</h2>
        <p className={styles.philosophyIntro} data-aos="fade">{content.philosophyIntro}</p>
        <div className={styles.pillars}>{content.pillars.map(([title, description]) => <div key={title} data-aos="fade"><h3>{title}</h3><p>{description}</p></div>)}</div>
      </section>

      <section className={`site-container ${styles.offerings}`} aria-labelledby="offering-heading">
        <div className={styles.offeringIntro}><h2 id="offering-heading" data-aos="fade">{content.offeringTitle}</h2><p data-aos="fade">{content.offeringIntro}</p></div>
        <h3 className={styles.sectionTitle} data-aos="fade">{content.softwareTitle}</h3>
        <div className={styles.softwareGrid}>
          {content.software.map((product) => <article className={styles.softwareCard} data-product={product.image} key={product.name}>
            <div className={`site-bg-box ${styles.softwareImage}`} role="img" aria-label={product.name} />
            <div className={styles.softwareCopy}><h4>{product.name}</h4><p>{product.description}</p><div className={styles.cardActions}><span className={styles.pill}>{product.type}</span><button type="button">{product.action}<span aria-hidden="true">→</span></button></div></div>
          </article>)}
        </div>
      </section>

      <section className={`site-container ${styles.hardware}`} aria-labelledby="hardware-heading">
        <h2 id="hardware-heading" className={styles.sectionTitle} data-aos="fade">{content.hardwareTitle}</h2>
        <div className={styles.hardwarePanel}>
          <div className={styles.hardwareCopy}><h3 data-aos="fade">{content.hardwareHeadline}</h3><p data-aos="fade">{content.hardwareIntro}</p><button className={styles.textButton} type="button">{content.hardwareAction}<span aria-hidden="true">→</span></button><div className={styles.tags}>{content.hardwareTags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
          <div className={`site-bg-box ${styles.hardwareImage} ${styles.collectorImage}`} role="img" aria-label={content.collector}><span>{content.collector}</span></div>
          <div className={`site-bg-box ${styles.hardwareImage} ${styles.outgassingImage}`} role="img" aria-label={content.outgassing}><span>{content.outgassing}</span></div>
        </div>
      </section>

      <section className={`site-container ${styles.chain}`} aria-labelledby="chain-heading">
        <div className={styles.chainCopy}><h2 id="chain-heading" data-aos="fade">{content.chainTitle}</h2><p data-aos="fade">{content.chainIntro}</p><button className={styles.textButton} type="button">{content.chainAction}<img src="/image/home-chain-link-arrow.png" alt="" width="40" height="40" /></button></div>
        <ol className={styles.chainSteps}>
          {content.chainSteps.map((step, index) => (
            <li key={step}>
              <div className={styles.chainStepContent}>
                <img className={styles.stepIcon} src={chainStepIcons[index]} alt="" width="72" height="72" />
                <span>{step}</span>
              </div>
              {index % 4 !== 3 && <img className={styles.chainArrow} src={index < 4 ? "/image/home-chain-arrow-right.png" : "/image/home-chain-arrow-left.png"} alt="" width="64" height="64" />}
            </li>
          ))}
        </ol>
      </section>

      <HomeCarousel slides={content.scenes} lang={lang} />

      <section className={`site-container ${styles.reasons}`} aria-labelledby="reasons-heading">
        <h2 id="reasons-heading" data-aos="fade">{content.reasonsTitle}</h2>
        <div className={styles.reasonGrid}>{content.reasons.map(([title, description], index) => 
          <div key={title} data-aos="fade">
            <img className={styles.reasonIcon} src={content.reasonsIcons[index]} alt="" width="72" height="72" />
            <h3>{title}</h3>
            <p>{description}</p>
          </div>)}
        </div>
      </section>

      <section className={`site-container ${styles.ecosystem}`} aria-labelledby="ecosystem-heading">
        <div className={styles.ecosystemIntro}><p data-aos="fade">TARGON</p><h2 id="ecosystem-heading" data-aos="fade">{content.ecosystemTitle}</h2><p data-aos="fade">{content.ecosystemIntro}</p></div>
        <div className={styles.ecosystemPanel}>
          <img className={styles.ecosystemGlow} src="/image/home-ecosystem-glow.png" alt="" width="1063" height="672" />
          <img className={styles.ecosystemOrbit} src="/image/home-ecosystem-orbit.png" alt="" width="1570" height="789" />
          <div className={styles.ecosystemCenter}><img src="/image/logo.svg" alt="" width="68" height="68" /><strong>TARGON</strong></div>
          <div className={styles.ecosystemItems}>{content.ecosystem.map(([title, description], index) => <div className={styles.ecosystemItem} data-position={index} key={title}><span className={styles.ecosystemVisual} aria-hidden="true"><img src={ecosystemImages[index]} alt="" width="118" height="118" /></span><div><h3>{title}</h3><p>{description}</p></div></div>)}</div>
        </div>
      </section>
    </main>
  );
}
