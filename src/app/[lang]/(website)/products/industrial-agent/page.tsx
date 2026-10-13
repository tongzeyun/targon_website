import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/locales";
import styles from "./industrial-agent.module.css";

type Props = { params: Promise<{ lang: string }> };

const copy = {
  zh: {
    title: "Local Industrial Agent",
    description: "Local Industrial Agent 是面向真空与半导体设备的本地工业 AI Agent，可部署于边缘网关或工业 PC，提供设备理解、故障诊断、操作指导、预测维护与工艺优化能力。",
    products: "产品",
    breadcrumbLabel: "面包屑导航",
    heroTitle: ["让每一台工业设备拥有", "自己的大脑"],
    featuresTitle: "6 项核心能力",
    featuresIntro: "连接设备数据与专业知识，让 AI 从理解设备到辅助执行任务。",
    features: [
      { title: "设备理解", description: "理解设备结构、运行状态与关键参数。" },
      { title: "故障诊断", description: "结合报警、故障代码与历史记录辅助定位异常。" },
      { title: "操作指导", description: "根据设备状态提供现场操作建议。" },
      { title: "预测维护", description: "识别潜在设备风险，辅助维护决策。" },
      { title: "知识继承", description: "沉淀设备手册、维修记录与工程经验。" },
      { title: "工艺优化", description: "结合设备状态与工艺参数辅助优化。" },
    ],
    deploymentTitle: "部署在现场，理解每一台设备",
    deploymentIntro: "设备数据与专业知识可以在本地处理，无需持续依赖互联网，适用于网络隔离和数据安全要求较高的工业环境。",
    interfaceAlt: "Local Industrial Agent 软件界面，展示设备运行状态、数据分析和助手面板",
    workflowLabel: "本地工业 AI 工作流程",
    inputs: [
      { title: "设备数据", description: "运行状态·传感器数据·预警信息" },
      { title: "设备知识", description: "设备手册·故障码·维修记录" },
      { title: "工艺数据", description: "工艺参数·生产节拍·质量数据" },
    ],
    execution: "理解➡️分析➡判断➡执行",
    feedback: [
      { title: "设备工艺数据库", description: "持续沉淀·不断进化" },
      { title: "反馈更新", description: "新的数据·新的经验·持续优化" },
    ],
    deploymentNote: "本地部署：边缘网关、工业PC、本地运行、支持离线",
    applicationsTitle: "面向真实工业设备与生产场景",
    applicationsIntro: "覆盖真空设备、半导体设备、设备运维与工艺优化等工业应用场景。",
    applications: [
      { title: "真空设备", description: "设备状态理解、故障预警、维护辅助", alt: "Local Industrial Agent 真空设备运行状态界面" },
      { title: "半导体设备", description: "设备知识理解、异常分析、操作指导", alt: "操作人员使用半导体设备控制面板" },
      { title: "设备运维", description: "故障处理、维修知识继承、维护辅助", alt: "工业设备的显示屏和维护工作台" },
      { title: "工艺优化", description: "设备参数分析、工艺优化建议", alt: "Local Industrial Agent 工艺参数和数据分析界面" },
    ],
    faqTitle: "常见问题",
    faqs: [
      { question: "Q1｜Local Industrial Agent 是什么？", answer: "Local Industrial Agent 是面向工业设备的本地 AI Agent，为真空、半导体等设备提供理解、诊断、维护和工艺优化能力。" },
      { question: "Q2｜Local Industrial Agent 需要联网吗？", answer: "支持本地运行，可用于无互联网或网络隔离环境。" },
      { question: "Q3｜Local Industrial Agent 可以部署在哪里？", answer: "可部署于边缘网关或工业控制 PC。" },
      { question: "Q4｜Local Industrial Agent 和普通 AI 有什么区别？", answer: "Local Industrial Agent 面向具体工业设备，将设备数据与专业知识结合，为现场任务提供 AI 能力。" },
    ],
    ctaTitle: "让 AI 真正进入你的设备现场",
    ctaDescription: "从一台设备开始，让设备知识、工程经验与 AI 真正连接起来。",
    demo: "预约演示",
    contact: "联系我们",
  },
  en: {
    title: "Local Industrial Agent",
    description: "Local Industrial Agent is a local industrial AI agent for vacuum and semiconductor equipment. It can be deployed on edge gateways or industrial PCs to support equipment understanding, fault diagnosis, operating guidance, predictive maintenance, and process optimization.",
    products: "Products",
    breadcrumbLabel: "Breadcrumb",
    heroTitle: ["Give Every Industrial Machine", "a Brain of Its Own"],
    featuresTitle: "6 Core Capabilities",
    featuresIntro: "Connect equipment data with specialist knowledge, from understanding equipment to assisting with tasks.",
    features: [
      { title: "Equipment Understanding", description: "Understands equipment structure, operating status, and key parameters." },
      { title: "Fault Diagnosis", description: "Uses alarms, fault codes, and historical records to help identify anomalies." },
      { title: "Operating Guidance", description: "Provides on-site operating recommendations based on equipment status." },
      { title: "Predictive Maintenance", description: "Identifies potential equipment risks to support maintenance decisions." },
      { title: "Knowledge Retention", description: "Preserves equipment manuals, maintenance records, and engineering experience." },
      { title: "Process Optimization", description: "Uses equipment status and process parameters to assist with optimization." },
    ],
    deploymentTitle: "Deployed On-site to Understand Every Machine",
    deploymentIntro: "Equipment data and specialist knowledge can be processed locally without continuous reliance on the internet, making it suitable for industrial environments with network isolation or demanding data security requirements.",
    interfaceAlt: "Local Industrial Agent software interface showing equipment operating status, data analysis, and an assistant panel",
    workflowLabel: "Local industrial AI workflow",
    inputs: [
      { title: "Equipment Data", description: "Operating status · Sensor data · Alerts" },
      { title: "Equipment Knowledge", description: "Equipment manuals · Fault codes · Maintenance records" },
      { title: "Process Data", description: "Process parameters · Production cycle times · Quality data" },
    ],
    execution: "Understand → Analyze → Decide → Execute",
    feedback: [
      { title: "Equipment and Process Database", description: "Accumulate knowledge · Continue evolving" },
      { title: "Feedback Updates", description: "New data · New experience · Continuous optimization" },
    ],
    deploymentNote: "Local deployment: edge gateways, industrial PCs, local operation, and offline support",
    applicationsTitle: "For Real Industrial Equipment and Production",
    applicationsIntro: "Covers vacuum equipment, semiconductor equipment, equipment maintenance, and process optimization.",
    applications: [
      { title: "Vacuum Equipment", description: "Equipment status understanding, fault alerts, and maintenance assistance", alt: "Local Industrial Agent vacuum equipment operating status interface" },
      { title: "Semiconductor Equipment", description: "Equipment knowledge, anomaly analysis, and operating guidance", alt: "Operator using a semiconductor equipment control panel" },
      { title: "Equipment Maintenance", description: "Fault handling, maintenance knowledge retention, and maintenance assistance", alt: "Industrial equipment displays and a maintenance workstation" },
      { title: "Process Optimization", description: "Equipment parameter analysis and process optimization recommendations", alt: "Local Industrial Agent process parameter and data analysis interface" },
    ],
    faqTitle: "Frequently Asked Questions",
    faqs: [
      { question: "Q1 | What is Local Industrial Agent?", answer: "Local Industrial Agent is a local AI agent for industrial equipment, providing equipment understanding, diagnosis, maintenance, and process optimization capabilities for vacuum and semiconductor equipment." },
      { question: "Q2 | Does Local Industrial Agent need internet access?", answer: "It supports local operation in environments without internet access or with isolated networks." },
      { question: "Q3 | Where can Local Industrial Agent be deployed?", answer: "It can be deployed on edge gateways or industrial control PCs." },
      { question: "Q4 | How does Local Industrial Agent differ from general-purpose AI?", answer: "Local Industrial Agent focuses on specific industrial equipment, combining equipment data with specialist knowledge to provide AI capabilities for on-site tasks." },
    ],
    ctaTitle: "Bring AI to Your Equipment On-site",
    ctaDescription: "Start with one machine and connect equipment knowledge, engineering experience, and AI.",
    demo: "Book a Demo",
    contact: "Contact Us",
  },
} as const;

const featureIcons = [
  { src: "/image/industrial-agent-understanding-icon.png", width: 40, height: 40 },
  { src: "/image/industrial-agent-diagnosis-icon.png", width: 40, height: 40 },
  { src: "/image/industrial-agent-guidance-icon.png", width: 40, height: 40 },
  { src: "/image/industrial-agent-maintenance-icon.png", width: 40, height: 40 },
  { src: "/image/industrial-agent-knowledge-icon.png", width: 42, height: 40 },
  { src: "/image/industrial-agent-optimization-icon.png", width: 40, height: 36 },
] as const;

const applicationImages = [
  "/image/industrial-agent-vacuum.png",
  "/image/industrial-agent-semiconductor.png",
  "/image/industrial-agent-equipment-maintenance.png",
  "/image/industrial-agent-process.png",
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const content = copy[lang];

  return {
    title: `${content.title} | ${lang === "zh" ? "探氩科技" : "Targon"}`,
    description: content.description,
    robots: { index: false, follow: false },
  };
}

export default async function IndustrialAgentPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const content = copy[lang];

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="industrial-agent-heading">
        <div className="site-container">
          <nav className={styles.breadcrumb} aria-label={content.breadcrumbLabel}>
            <ol>
              <li><Link href={`/${lang}/products`}>{content.products}</Link></li>
              <li aria-hidden="true">&gt;</li>
              <li aria-current="page">{content.title}</li>
            </ol>
          </nav>
          <div className={styles.heroCopy}>
            <h1 id="industrial-agent-heading" data-aos="fade">
              {content.heroTitle.map((line, index) => <span key={line}>{lang === "en" && index > 0 && " "}{line}</span>)}
            </h1>
            <p>{content.description}</p>
          </div>
        </div>
      </section>

      <div className="site-container">
        <section className={styles.features} aria-labelledby="agent-features-heading">
          <div className={styles.featureIntro}>
            <h2 id="agent-features-heading" className={styles.sectionTitle} data-aos="fade">{content.featuresTitle}</h2>
            <p>{content.featuresIntro}</p>
          </div>
          <div className={styles.watermark} aria-hidden="true">LOCAL<br />INDUSTRIAL<br />AGENT</div>
          <div className={styles.featureGrid}>
            {content.features.map((feature, index) => (
              <article className={styles.feature} key={feature.title}>
                <div className={styles.featureIcon}>
                  <img src={featureIcons[index].src} alt="" width={featureIcons[index].width} height={featureIcons[index].height} loading="lazy" />
                </div>
                <h3 data-aos="fade">{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.deployment} aria-labelledby="agent-deployment-heading">
          <div className={styles.deploymentCanvas}>
            <div className={styles.deploymentIntro}>
              <h2 id="agent-deployment-heading" className={styles.sectionTitle} data-aos="fade">{content.deploymentTitle}</h2>
              <p>{content.deploymentIntro}</p>
            </div>
            <div className={styles.interfaceImage}>
              <img src="/image/industrial-agent-interface.png" alt={content.interfaceAlt} width="1594" height="924" loading="lazy" />
            </div>
            <div className={styles.workflow} role="group" aria-label={content.workflowLabel}>
              <img className={styles.orbits} src="/image/industrial-agent-workflow-orbits.png" alt="" width="2561" height="1672" loading="lazy" />
              <img className={styles.feedbackOrbit} src="/image/industrial-agent-workflow-feedback.png" alt="" width="1226" height="613" loading="lazy" />
              <div className={`${styles.workflowStep} ${styles.inputStep}`}>
                <span className={styles.stepNumber}>01</span>
                {content.inputs.map((input) => <div className={styles.workflowItem} key={input.title}><h3>{input.title}</h3><p>{input.description}</p></div>)}
              </div>
              <div className={`${styles.workflowStep} ${styles.executionStep}`}>
                <span className={styles.stepNumber}>02</span>
                <h3>{content.execution}</h3>
              </div>
              <div className={`${styles.workflowStep} ${styles.feedbackStep}`}>
                <span className={styles.stepNumber}>03</span>
                {content.feedback.map((item) => <div className={styles.workflowItem} key={item.title}><h3>{item.title}</h3><p>{item.description}</p></div>)}
              </div>
            </div>
            <p className={styles.deploymentNote}>{content.deploymentNote}</p>
          </div>
        </section>

        <section className={styles.applications} aria-labelledby="agent-applications-heading">
          <h2 id="agent-applications-heading" className={styles.sectionTitle} data-aos="fade">{content.applicationsTitle}</h2>
          <p className={styles.sectionIntro}>{content.applicationsIntro}</p>
          <div className={styles.applicationGrid}>
            {content.applications.map((application, index) => (
              <article className={styles.application} key={application.title}>
                <h3 data-aos="fade">{application.title}</h3>
                <p>{application.description}</p>
                <div className={styles.applicationImage}>
                  <img src={applicationImages[index]} alt={application.alt} width="816" height="508" loading="lazy" />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.faq} aria-labelledby="agent-faq-heading">
          <h2 id="agent-faq-heading" className={styles.sectionTitle} data-aos="fade">{content.faqTitle}</h2>
          <div className={styles.faqList}>
            {content.faqs.map((faq) => <article className={styles.faqItem} key={faq.question}><h3>{faq.question}</h3><p>{faq.answer}</p></article>)}
          </div>
        </section>
      </div>

      <section className={styles.cta} aria-labelledby="agent-cta-heading">
        <div className="site-container">
          <div className={styles.ctaCard}>
            <div>
              <h2 id="agent-cta-heading" data-aos="fade">{content.ctaTitle}</h2>
              <p>{content.ctaDescription}</p>
            </div>
            <div className={styles.ctaActions}>
              <button type="button" className="site-button site-button--primary">{content.demo}</button>
              <button type="button" className="site-button site-button--outline">{content.contact}</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
