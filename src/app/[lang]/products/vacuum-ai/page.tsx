import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/locales";
import styles from "./vacuum-ai.module.css";

type Props = { params: Promise<{ lang: string }> };

const copy = {
  zh: {
    title: "Vacuum AI",
    description: "让真空计算、设备选型与产业服务，更简单。连接AI智能助手、真空建模计算、元件交易与专业服务，覆盖真空产业从需求到服务的核心流程。",
    products: "产品",
    breadcrumbLabel: "面包屑导航",
    heroTitle: ["Vacuum AI", "AI驱动的真空产业智能化平台"],
    assistantTitle: "一个真正懂真空的AI智能助手",
    assistantDescription: "Vacuum AI 内置 AI 智能助手，帮助用户理解真空相关问题、查找设备与元件信息，并进入对应的计算、选型与交易流程。",
    assistantAlt: "Vacuum AI 智能助手对话界面",
    modelingTitle: "从设备选型，到模型计算",
    modelingDescription: "选择真空腔体、真空泵或自定义泵模型，输入工况参数，Vacuum AI基于所选模型进行计算分析。",
    workflowLabel: "真空模型计算流程",
    steps: ["腔体选择", "泵选择", "参数输入", "模型计算", "计算结果"],
    editorAlt: "Vacuum AI 真空腔体和泵模型编辑界面及计算曲线",
    resultsAlt: "Vacuum AI 真空模型计算结果图表",
    selectionTitle: "从一次计算，到真实的设备选型",
    selectionDescription: [
      "用户根据实际需求选择对应的真空腔体、真空泵，或自定义泵模型，并输入相关工况参数。",
      "Vacuum AI 基于所选模型进行计算分析，帮助用户验证不同组合下的真空性能，为真空泵的选型与方案判断提供依据。",
    ],
    caseLabel: "案例描述",
    caseTitle: "真实应用｜真空系统计算与选型",
    caseDescription: "某半导体企业需要为新建产线选择合适的真空系统，目标达到 10⁻⁴ Pa 的极限压力，同时兼顾系统稳定性与能耗。用户通过 Vacuum AI 选择真空腔体与不同真空泵模型，输入实际工况参数进行计算，对比不同方案的真空性能，为最终的设备选型与方案判断提供依据。",
    caseAlt: "真空系统计算与选型案例中的压力和抽气时间计算曲线",
    caseFeatures: [
      { title: "模型计算", description: "基于模型与工况进行计算，验证真空性能。" },
      { title: "方案验证", description: "比较不同设备组合下的计算结果。" },
      { title: "选型辅助", description: "为真空泵选型与方案判断提供依据。" },
    ],
    servicesTitle: "从设备选型，到产业服务",
    servicesDescription: "连接真空产业元件资源，从计算与选型延伸至实际采购。",
    services: [
      { title: "新件商城", description: "真空泵、真空元件及相关设备与配件交易。", alt: "Vacuum AI 新件商城的真空泵和元件列表" },
      { title: "二手商城", description: "面向真空设备与元件的二手交易与流通。", alt: "Vacuum AI 二手商城导航", overlayAlt: "Vacuum AI 商城中的低温制冷机商品详情示例" },
      { title: "维修保养", description: "连接专业维修服务资源，为真空设备提供维修与保养支持。", alt: "Vacuum AI 维修保养服务界面" },
      { title: "认证服务", description: "提供相关设备与服务认证支持，帮助设备进入后续使用环节。", alt: "Vacuum AI 认证服务界面" },
    ],
    categoriesTitle: "热门元件分类",
    categories: ["真空泵", "测量与控制", "真空配件", "真空腔体", "真空阀门", "耗材", "高低温控制", "半导体测试与表征", "其它"],
    valueTitle: "让计算产生价值",
    valueDescription: [
      "从模型计算，到真实的设备决策。",
      "Vacuum AI 将真空计算、设备选型、产业交易与设备服务连接起来，让专业计算真正进入产业应用。",
    ],
    values: [
      { title: "算得清", description: "基于真空模型与实际工况进行计算，辅助验证方案。" },
      { title: "选得准", description: "结合真空泵、真空腔体及相关元件，为设备选型提供依据。" },
      { title: "用得久", description: "从设备交易延伸至维修保养与认证服务，覆盖设备后续生命周期。" },
    ],
    faqTitle: "常见问题",
    faqs: [
      { question: "Q1｜Vacuum AI 是什么？", answer: "Vacuum AI 是面向真空产业的智能平台，提供 AI 智能助手、真空建模计算、设备与元件交易、维修保养及认证服务。" },
      { question: "Q2｜Vacuum AI 可以进行真空泵选型吗？", answer: "可以。用户可以选择真空腔体、真空泵或自定义泵模型，并输入实际工况参数，通过模型计算辅助验证方案与设备选型。" },
      { question: "Q3｜Vacuum AI 如何进行真空模型计算？", answer: "用户选择对应的模型并输入工况参数，平台根据模型进行计算分析，并输出相应计算结果。" },
      { question: "Q4｜Vacuum AI 支持哪些真空设备和元件？", answer: "平台覆盖真空泵、测量与控制、真空配件、真空腔体、真空阀门、耗材及其他相关产品。" },
    ],
    ctaTitle: "从一次计算开始，进入Vacuum AI",
    ctaDescription: "用模型验证方案，用数据辅助选型，连接真实的真空产业服务。",
    demo: "预约演示",
    contact: "联系我们",
  },
  en: {
    title: "Vacuum AI",
    description: "Make vacuum calculations, equipment selection, and industry services simpler. Vacuum AI connects an AI assistant, vacuum modeling, component trading, and specialist services across the core vacuum industry workflow, from requirements to services.",
    products: "Products",
    breadcrumbLabel: "Breadcrumb",
    heroTitle: ["Vacuum AI", "An AI-powered Platform", "for the Vacuum Industry"],
    assistantTitle: "An AI Assistant That Understands Vacuum",
    assistantDescription: "Vacuum AI includes an AI assistant to help users understand vacuum-related questions, find equipment and component information, and enter the relevant calculation, selection, and trading workflows.",
    assistantAlt: "Vacuum AI assistant conversation interface",
    modelingTitle: "From Equipment Selection to Model Calculation",
    modelingDescription: "Select a vacuum chamber, vacuum pump, or custom pump model and enter operating parameters. Vacuum AI calculates and analyzes the selected model.",
    workflowLabel: "Vacuum model calculation workflow",
    steps: ["Chamber Selection", "Pump Selection", "Parameter Input", "Model Calculation", "Calculation Results"],
    editorAlt: "Vacuum AI chamber and pump model editor with calculation curves",
    resultsAlt: "Vacuum AI model calculation results chart",
    selectionTitle: "From a Calculation to Real Equipment Selection",
    selectionDescription: [
      "Users select a vacuum chamber, vacuum pump, or custom pump model based on their requirements and enter the relevant operating parameters.",
      "Vacuum AI analyzes the selected model to help validate vacuum performance across different combinations, supporting pump selection and evaluation of proposed solutions.",
    ],
    caseLabel: "Case Description",
    caseTitle: "Real Application | Vacuum System Calculation and Selection",
    caseDescription: "A semiconductor company needed a vacuum system for a new production line, targeting an ultimate pressure of 10⁻⁴ Pa while considering system stability and energy consumption. Using Vacuum AI, the user selected a vacuum chamber and different pump models, entered actual operating parameters, and compared vacuum performance across solutions to support final equipment selection and evaluation.",
    caseAlt: "Pressure and pump-down time curves for the vacuum system calculation and selection case",
    caseFeatures: [
      { title: "Model Calculation", description: "Calculate using models and operating conditions to validate vacuum performance." },
      { title: "Solution Validation", description: "Compare calculated results across different equipment combinations." },
      { title: "Selection Assistance", description: "Support vacuum pump selection and evaluation of proposed solutions." },
    ],
    servicesTitle: "From Equipment Selection to Industry Services",
    servicesDescription: "Connect with vacuum industry component resources, extending calculations and selection to actual procurement.",
    services: [
      { title: "New Equipment Marketplace", description: "Trading in vacuum pumps, vacuum components, and related equipment and accessories.", alt: "Vacuum AI new equipment marketplace with vacuum pumps and components" },
      { title: "Used Equipment Marketplace", description: "Second-hand trading and circulation of vacuum equipment and components.", alt: "Vacuum AI used equipment marketplace navigation", overlayAlt: "Example cryogenic refrigerator product details in the Vacuum AI marketplace" },
      { title: "Maintenance Services", description: "Connect with specialist service resources for vacuum equipment repair and maintenance.", alt: "Vacuum AI repair and maintenance services interface" },
      { title: "Certification Services", description: "Certification support for equipment and services to help equipment enter subsequent use.", alt: "Vacuum AI certification services interface" },
    ],
    categoriesTitle: "Popular Component Categories",
    categories: ["Vacuum Pumps", "Measurement & Control", "Vacuum Accessories", "Vacuum Chambers", "Vacuum Valves", "Consumables", "Temperature Control", "Semiconductor Testing & Characterization", "Other"],
    valueTitle: "Turn Calculations into Value",
    valueDescription: [
      "From model calculations to real equipment decisions.",
      "Vacuum AI connects vacuum calculations, equipment selection, industry trading, and equipment services to bring specialist calculations into industrial applications.",
    ],
    values: [
      { title: "Calculate Clearly", description: "Calculate using vacuum models and actual operating conditions to help validate solutions." },
      { title: "Select Precisely", description: "Use vacuum pumps, vacuum chambers, and related components to support equipment selection." },
      { title: "Support Long-term Use", description: "Extend equipment trading to maintenance and certification services across the subsequent equipment lifecycle." },
    ],
    faqTitle: "Frequently Asked Questions",
    faqs: [
      { question: "Q1 | What is Vacuum AI?", answer: "Vacuum AI is an intelligent platform for the vacuum industry, offering an AI assistant, vacuum modeling, equipment and component trading, maintenance, and certification services." },
      { question: "Q2 | Can Vacuum AI help select vacuum pumps?", answer: "Yes. Users can select a vacuum chamber, vacuum pump, or custom pump model and enter actual operating parameters to help validate solutions and select equipment through model calculations." },
      { question: "Q3 | How does Vacuum AI calculate vacuum models?", answer: "Users select a model and enter operating parameters. The platform then calculates and analyzes the model and provides the corresponding results." },
      { question: "Q4 | Which vacuum equipment and components does Vacuum AI support?", answer: "The platform covers vacuum pumps, measurement and control, vacuum accessories, vacuum chambers, vacuum valves, consumables, and other related products." },
    ],
    ctaTitle: "Start with a Calculation. Explore Vacuum AI.",
    ctaDescription: "Validate solutions with models, support selection with data, and connect with real vacuum industry services.",
    demo: "Book a Demo",
    contact: "Contact Us",
  },
} as const;

const stepIcons = ["chamber", "pump", "parameters", "calculation", "results"] as const;
const caseIcons = ["model", "validation", "selection"] as const;
const serviceImages = ["new-equipment", "used-equipment", "maintenance", "certification"] as const;
const categoryIcons = ["pump", "control", "accessories", "chamber", "valves", "consumables", "temperature", "semiconductor", "other"] as const;
const valueIcons = ["calculation", "selection", "lifecycle"] as const;

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

export default async function VacuumAiPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const content = copy[lang];

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="vacuum-ai-heading">
        <div className="site-container">
          <nav className={styles.breadcrumb} aria-label={content.breadcrumbLabel}>
            <ol>
              <li><Link href={`/${lang}/products`}>{content.products}</Link></li>
              <li aria-hidden="true">&gt;</li>
              <li aria-current="page">{content.title}</li>
            </ol>
          </nav>
          <div className={styles.heroCopy}>
            <h1 id="vacuum-ai-heading" data-aos="fade">
              {content.heroTitle.map((line, index) => <span key={line}>{index > 0 && " "}{line}</span>)}
            </h1>
            <p>{content.description}</p>
          </div>
        </div>
      </section>

      <div className="site-container">
        <section className={styles.assistant} aria-labelledby="vacuum-assistant-heading">
          <div className={styles.assistantCopy}>
            <h2 id="vacuum-assistant-heading" className={styles.sectionTitle} data-aos="fade">{content.assistantTitle}</h2>
            <p className={styles.sectionIntro}>{content.assistantDescription}</p>
          </div>
          <div className={styles.assistantImage}>
            <img src="/image/vacuum-ai-assistant.png" alt={content.assistantAlt} width="1864" height="1076" />
          </div>
        </section>

        <section className={styles.modeling} aria-labelledby="vacuum-modeling-heading">
          <h2 id="vacuum-modeling-heading" className={styles.sectionTitle} data-aos="fade">{content.modelingTitle}</h2>
          <p className={styles.sectionIntro}>{content.modelingDescription}</p>
          <ol className={styles.workflow} aria-label={content.workflowLabel}>
            {content.steps.map((step, index) => (
              <li key={step}>
                <div className={styles.workflowStep}><img src={`/image/vacuum-ai-${stepIcons[index]}-icon.png`} alt="" width="32" height="32" loading="lazy" /><span>{step}</span></div>
                {index < content.steps.length - 1 && <img className={styles.workflowArrow} src={`/image/vacuum-ai-flow-arrow-${index + 1}.png`} alt="" width="28" height="16" loading="lazy" />}
              </li>
            ))}
          </ol>
          <div className={styles.modelImages}>
            <div className={styles.modelEditor}><img src="/image/vacuum-ai-model-editor.png" alt={content.editorAlt} width="1984" height="1144" loading="lazy" /></div>
            <div className={styles.modelResults}><img src="/image/vacuum-ai-model-results.png" alt={content.resultsAlt} width="1470" height="1144" loading="lazy" /></div>
          </div>
        </section>

        <section className={styles.selection} aria-labelledby="vacuum-selection-heading">
          <h2 id="vacuum-selection-heading" className={styles.sectionTitle} data-aos="fade">{content.selectionTitle}</h2>
          <p className={styles.sectionIntro}>{content.selectionDescription.map((line) => <span key={line}>{line}</span>)}</p>
          <article className={styles.caseCard} aria-labelledby="vacuum-case-heading">
            <div className={styles.caseCopy}>
              <p className={styles.caseLabel}>{content.caseLabel}</p>
              <h3 id="vacuum-case-heading" data-aos="fade">{content.caseTitle}</h3>
              <p className={styles.caseDescription}>{content.caseDescription}</p>
              <div className={styles.caseFeatures}>
                {content.caseFeatures.map((feature, index) => (
                  <div key={feature.title}>
                    <img src={`/image/vacuum-ai-case-${caseIcons[index]}-icon.png`} alt="" width="48" height="48" loading="lazy" />
                    <h4>{feature.title}</h4><p>{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <img className={styles.caseImage} src="/image/vacuum-ai-case-results.png" alt={content.caseAlt} width="1720" height="968" loading="lazy" />
          </article>
        </section>

        <section className={styles.services} aria-labelledby="vacuum-services-heading">
          <h2 id="vacuum-services-heading" className={styles.sectionTitle} data-aos="fade">{content.servicesTitle}</h2>
          <p className={styles.sectionIntro}>{content.servicesDescription}</p>
          <div className={styles.serviceGrid}>
            {content.services.map((service, index) => (
              <article className={styles.serviceCard} key={service.title}>
                <div className={styles.serviceImage}>
                  <img src={`/image/vacuum-ai-${serviceImages[index]}.png`} alt={service.alt} width="828" height="508" loading="lazy" />
                  {"overlayAlt" in service && <img className={styles.usedOverlay} src="/image/vacuum-ai-used-equipment-overlay.png" alt={service.overlayAlt} width="812" height="412" loading="lazy" />}
                </div>
                <div className={styles.serviceBody}><h3 data-aos="fade">{service.title}</h3><p>{service.description}</p></div>
              </article>
            ))}
          </div>
          <div className={styles.categories}>
            <h3>{content.categoriesTitle}</h3>
            <ul className={styles.categoryList}>
              {content.categories.map((category, index) => <li key={category}><img src={`/image/vacuum-ai-category-${categoryIcons[index]}.png`} alt="" width="64" height="64" loading="lazy" /><span>{category}</span></li>)}
            </ul>
          </div>
        </section>

        <section className={styles.value} aria-labelledby="vacuum-value-heading">
          <h2 id="vacuum-value-heading" className={styles.sectionTitle} data-aos="fade">{content.valueTitle}</h2>
          <p className={styles.sectionIntro}>{content.valueDescription.map((line) => <span key={line}>{line}</span>)}</p>
          <div className={styles.valueGrid}>
            {content.values.map((value, index) => (
              <article key={value.title}>
                <img src={`/image/vacuum-ai-value-${valueIcons[index]}-icon.png`} alt="" width="72" height="72" loading="lazy" />
                <h3 data-aos="fade">{value.title}</h3><p>{value.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.faq} aria-labelledby="vacuum-faq-heading">
          <h2 id="vacuum-faq-heading" className={styles.sectionTitle} data-aos="fade">{content.faqTitle}</h2>
          <div className={styles.faqList}>
            {content.faqs.map((faq) => <article className={styles.faqItem} key={faq.question}><h3>{faq.question}</h3><p>{faq.answer}</p></article>)}
          </div>
        </section>
      </div>

      <section className={styles.cta} aria-labelledby="vacuum-cta-heading">
        <div className="site-container">
          <div className={styles.ctaCard}>
            <div><h2 id="vacuum-cta-heading" data-aos="fade">{content.ctaTitle}</h2><p>{content.ctaDescription}</p></div>
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
