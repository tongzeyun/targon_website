import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/locales";
import { BrainCarousel } from "./brain-carousel";
import styles from "./enterprise-brain.module.css";

type Props = { params: Promise<{ lang: string }> };

const copy = {
  zh: {
    title: "Enterprise Brain",
    description: "Enterprise Brain 是面向企业业务的 AI 中枢，通过理解企业文件、数据、知识与业务流程，为企业提供信息提取、数据分析、业务判断、任务执行与流程协作能力。",
    products: "产品",
    breadcrumbLabel: "面包屑导航",
    heroTitle: ["让 AI 真正理解企业", "并参与业务执行"],
    challengesTitle: ["企业 AI 落地，真正难的不是 AI，", "而是数据与业务"],
    challengesIntro: [
      "企业文件、业务数据与知识分散在不同系统和业务环节中。",
      "Enterprise Brain 通过本地部署、数据隔离与企业知识理解，让 AI 在企业可控环境中处理信息、分析业务并辅助任务执行。",
    ],
    painLabel: "痛点：",
    explore: "了解解决方式",
    challenges: [
      { title: "数据安全与传输", question: "企业核心数据，如何安全地交给 AI？", pain: "企业合同、客户资料、经营数据、产品资料等信息具有较高敏感性。传统云端 AI 需要将数据传输至外部服务，企业需要面对数据流转、访问权限与信息安全等问题。", solution: "通过数据隔离与本地数据处理，减少敏感企业数据向外部环境传输，让文件、业务数据与企业知识在可控环境中被 AI 使用。" },
      { title: "部署与成本", question: "企业 AI，如何真正部署到自己的环境？", pain: "企业内部往往存在内网、私有数据环境及复杂的业务系统。大量数据依赖外部 AI 服务处理，也可能增加数据传输、云端调用与持续使用成本。", solution: "支持企业服务器本地部署，让 AI 在企业自己的环境中运行和处理数据，减少不必要的数据传输与外部调用，帮助企业控制 AI 应用成本。" },
      { title: "企业知识与业务理解", question: "AI 有通用知识，却不一定真正懂你的企业", pain: "企业的文件、制度、产品资料、业务数据和经验分散在不同系统与业务环节中。通用 AI 难以直接理解企业自身的业务规则、数据关系与业务上下文。", solution: "将企业文件、业务数据、企业知识与业务经验连接起来，让 AI 从信息理解进一步走向分析、判断与任务执行。" },
    ],
    capabilitiesTitle: "一个 AI 中枢，连接企业知识与业务",
    capabilitiesIntro: "Enterprise Brain 连接企业知识、业务数据与 AI 任务，让 AI 真正进入企业业务流程。",
    previous: "上一项能力",
    next: "下一项能力",
    slides: [
      { title: "企业知识理解", description: "让 AI 理解企业文件、产品资料与业务知识。", alt: "Enterprise Brain 文件中心与企业资料列表" },
      { title: "企业数据分析", description: "让 AI 连接业务数据，辅助分析与判断。", alt: "Enterprise Brain 知识库与业务数据界面" },
      { title: "权限与数据管理", description: "让 AI 在企业权限体系下安全运行。", alt: "Enterprise Brain 设置中的权限与数据管理界面" },
      { title: "AI 任务执行", description: "让 AI 从理解信息，进一步参与业务任务。", alt: "Enterprise Brain AI 助手与业务任务界面" },
    ],
    applicationsTitle: "面向真实企业业务场景",
    applicationsIntro: "Enterprise Brain 将企业知识、业务数据与 AI 能力融入日常工作，覆盖企业办公、销售、仓储与技术支持等业务场景。",
    applications: [
      { title: "企业 AI 助手", description: ["连接企业知识，", "辅助员工处理日常业务。"], caption: "企业知识库 · AI 办公", alt: "蓝色光点背景前的机器人手指" },
      { title: "AI 销售助理", description: ["连接客户、产品与销售数据，", "辅助销售推进业务。"], caption: "客户分析 · 销售管理", alt: "代表人工智能的数字人形头部" },
      { title: "AI 仓库管理", description: ["连接库存、产品与仓储数据，", "辅助企业库存管理。"], caption: "智能仓储 · 库存管理", alt: "机架整齐排列的数据中心" },
      { title: "AI 技术支持", description: ["连接企业技术知识，", "让专业经验随时可调用。"], caption: "技术知识库 · 智能技术支持", alt: "电路板上的芯片和蓝色信号光点" },
    ],
    faqTitle: "常见问题",
    faqs: [
      { question: "Q1｜Enterprise Brain 是什么？", answer: "Enterprise Brain 是面向企业业务的 AI 中枢，能够理解企业文件、数据与知识，并辅助完成分析、判断和业务任务执行。" },
      { question: "Q2｜Enterprise Brain可以处理哪些内容？", answer: "可以处理企业文件、业务数据、产品资料、制度文档、报告及其他企业知识内容。" },
      { question: "Q3｜Enterprise Brain可以私有化部署吗？", answer: "Enterprise Brain 支持部署在企业自己的服务器环境中，根据企业的数据安全和业务需求进行部署。" },
      { question: "Q4｜Enterprise Brain和普通 AI 助手有什么区别？", answer: "普通 AI 助手主要基于通用知识与用户输入进行问答和内容生成，而 Enterprise Brain 面向企业真实业务环境，将企业文件、业务数据、企业知识与权限体系连接起来，让 AI 不仅能够回答问题，还能够理解企业业务并参与具体任务。" },
    ],
    ctaTitle: "让企业拥有真正懂业务的 AI 中枢",
    ctaDescription: "从企业知识开始，让 AI 理解信息、辅助决策，并推动业务执行。",
    demo: "预约演示",
    contact: "联系我们",
  },
  en: {
    title: "Enterprise Brain",
    description: "Enterprise Brain is an AI hub for enterprise operations. By understanding company documents, data, knowledge, and workflows, it supports information extraction, data analysis, business decisions, task execution, and workflow collaboration.",
    products: "Products",
    breadcrumbLabel: "Breadcrumb",
    heroTitle: ["AI That Understands Your Business", "and Helps Execute Its Tasks"],
    challengesTitle: ["Putting Enterprise AI to Work:", "The Challenge Is Data and Business"],
    challengesIntro: [
      "Company documents, business data, and knowledge are spread across different systems and stages of operations.",
      "Enterprise Brain combines local deployment, data isolation, and enterprise knowledge understanding so AI can process information, analyze business operations, and assist with tasks in an environment the company controls.",
    ],
    painLabel: "Challenge: ",
    explore: "Explore the Solution",
    challenges: [
      { title: "Data Security and Transfer", question: "How can core business data be shared safely with AI?", pain: "Contracts, customer information, operating data, and product information can be sensitive. Traditional cloud AI requires transferring data to external services, raising questions about data flows, access permissions, and information security.", solution: "uses data isolation and local data processing to reduce the transfer of sensitive company data to external environments, keeping documents, business data, and company knowledge available to AI in a controlled environment." },
      { title: "Deployment and Cost", question: "How can enterprise AI run in your own environment?", pain: "Companies often have internal networks, private data environments, and complex business systems. Reliance on external AI services for large amounts of data can increase data transfer, cloud usage, and ongoing costs.", solution: "supports deployment on company servers so AI can run and process data in the company's own environment, reducing unnecessary data transfers and external calls to help control AI application costs." },
      { title: "Enterprise Knowledge and Business Understanding", question: "General knowledge does not mean understanding your company.", pain: "Documents, policies, product information, business data, and experience are spread across different systems and operations. General-purpose AI may struggle to understand the company's own business rules, data relationships, and context.", solution: "connects company documents, business data, enterprise knowledge, and business experience, taking AI from understanding information to analysis, decisions, and task execution." },
    ],
    capabilitiesTitle: "An AI Hub Connecting Enterprise Knowledge and Business",
    capabilitiesIntro: "Enterprise Brain connects company knowledge, business data, and AI tasks to bring AI into enterprise workflows.",
    previous: "Previous Capability",
    next: "Next Capability",
    slides: [
      { title: "Enterprise Knowledge Understanding", description: "Help AI understand company documents, product information, and business knowledge.", alt: "Enterprise Brain document center and company document list" },
      { title: "Enterprise Data Analysis", description: "Connect AI with business data to support analysis and decisions.", alt: "Enterprise Brain knowledge base and business data interface" },
      { title: "Permissions and Data Management", description: "Run AI safely within the company's permission system.", alt: "Enterprise Brain settings for permissions and data management" },
      { title: "AI Task Execution", description: "Take AI from understanding information to participating in business tasks.", alt: "Enterprise Brain AI assistant and business task interface" },
    ],
    applicationsTitle: "For Real Enterprise Operations",
    applicationsIntro: "Enterprise Brain brings enterprise knowledge, business data, and AI into daily work across office tasks, sales, warehousing, and technical support.",
    applications: [
      { title: "Enterprise AI Assistant", description: ["Connect enterprise knowledge", "to help staff with daily business tasks."], caption: "Enterprise Knowledge · AI Office", alt: "Robot fingers against a background of blue lights" },
      { title: "AI Sales Assistant", description: ["Connect customer, product, and sales data", "to help sales teams advance business."], caption: "Customer Analysis · Sales Management", alt: "Digital human head representing artificial intelligence" },
      { title: "AI Warehouse Management", description: ["Connect inventory, product, and warehouse data", "to support inventory management."], caption: "Smart Warehousing · Inventory Management", alt: "Rows of racks in a data center" },
      { title: "AI Technical Support", description: ["Connect company technical knowledge", "to make specialist experience available on demand."], caption: "Technical Knowledge · AI Support", alt: "Chip and blue signal lights on a circuit board" },
    ],
    faqTitle: "Frequently Asked Questions",
    faqs: [
      { question: "Q1 | What is Enterprise Brain?", answer: "Enterprise Brain is an AI hub for enterprise operations. It understands company documents, data, and knowledge and helps with analysis, decisions, and business task execution." },
      { question: "Q2 | What can Enterprise Brain process?", answer: "It can process company documents, business data, product information, policies, reports, and other enterprise knowledge." },
      { question: "Q3 | Can Enterprise Brain be privately deployed?", answer: "Enterprise Brain supports deployment on the company's own servers according to its data security and business requirements." },
      { question: "Q4 | How does Enterprise Brain differ from a general AI assistant?", answer: "General AI assistants primarily answer questions and generate content using general knowledge and user input. Enterprise Brain focuses on real business environments, connecting company documents, business data, knowledge, and permissions so AI can understand the business and participate in specific tasks." },
    ],
    ctaTitle: "Give Your Company an AI Hub That Understands Its Business",
    ctaDescription: "Start with company knowledge. Let AI understand information, support decisions, and move business tasks forward.",
    demo: "Book a Demo",
    contact: "Contact Us",
  },
} as const;

const slideImages = ["knowledge", "analysis", "permissions", "tasks"] as const;
const applicationImages = ["office", "sales", "warehouse", "support"] as const;

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

export default async function EnterpriseBrainPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const content = copy[lang];

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="enterprise-brain-heading">
        <div className="site-container">
          <nav className={styles.breadcrumb} aria-label={content.breadcrumbLabel}>
            <ol>
              <li><Link href={`/${lang}/products`}>{content.products}</Link></li>
              <li aria-hidden="true">&gt;</li>
              <li aria-current="page">{content.title}</li>
            </ol>
          </nav>
          <div className={styles.heroCopy}>
            <h1 id="enterprise-brain-heading" data-aos="fade">
              {content.heroTitle.map((line, index) => <span key={line}>{lang === "en" && index > 0 && " "}{line}</span>)}
            </h1>
            <p>{content.description}</p>
          </div>
        </div>
      </section>

      <div className="site-container">
        <section className={styles.challenges} aria-labelledby="brain-challenges-heading">
          <h2 id="brain-challenges-heading" className={styles.sectionTitle} data-aos="fade">{content.challengesTitle.map((line) => <span key={line}>{line}</span>)}</h2>
          <p className={styles.sectionIntro}>{content.challengesIntro.map((line) => <span key={line}>{line}</span>)}</p>
          <div className={styles.challengeGrid}>
            {content.challenges.map((challenge, index) => (
              <article className={styles.challengeCard} key={challenge.title}>
                <h3>{challenge.title}</h3>
                <p className={styles.challengeQuestion}>{challenge.question}</p>
                <div className={styles.challengeBody}>
                  <p className={styles.painCopy}><strong>{content.painLabel}</strong>{challenge.pain}</p>
                  <p className={styles.solutionPanel} id={`brain-solution-${index}`}><strong>Enterprise Brain </strong>{challenge.solution}</p>
                </div>
                <button className={styles.challengeArrow} type="button" aria-label={`${content.explore}: ${challenge.title}`} aria-describedby={`brain-solution-${index}`}>
                  <img src="/image/enterprise-brain-card-arrow.png" alt="" width="28" height="28" />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.capabilities} aria-labelledby="brain-capabilities-heading">
          <h2 id="brain-capabilities-heading" className={styles.sectionTitle} data-aos="fade">{content.capabilitiesTitle}</h2>
          <p className={styles.sectionIntro}>{content.capabilitiesIntro}</p>
          <BrainCarousel
            label={content.capabilitiesTitle}
            previousLabel={content.previous}
            nextLabel={content.next}
            slides={content.slides.map((slide, index) => ({ ...slide, image: `/image/enterprise-brain-${slideImages[index]}.png`, topAligned: index === 1 }))}
          />
        </section>

        <section className={styles.applications} aria-labelledby="brain-applications-heading">
          <h2 id="brain-applications-heading" className={styles.sectionTitle} data-aos="fade">{content.applicationsTitle}</h2>
          <p className={styles.sectionIntro}>{content.applicationsIntro}</p>
          <div className={styles.applicationGrid}>
            {content.applications.map((application, index) => (
              <article className={styles.application} key={application.title}>
                <h3 data-aos="fade">{application.title}</h3>
                <p>{application.description.map((line) => <span key={line}>{line}</span>)}</p>
                <figure className={styles.applicationPhoto} data-image={applicationImages[index]}>
                  <img src={`/image/enterprise-brain-${applicationImages[index]}.png`} alt={application.alt} width={index === 0 ? 500 : index === 1 ? 1332 : index === 2 ? 1470 : 870} height={index === 0 ? 750 : index === 1 ? 749 : index === 2 ? 980 : 580} loading="lazy" />
                  <figcaption>{application.caption}</figcaption>
                </figure>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.faq} aria-labelledby="brain-faq-heading">
          <h2 id="brain-faq-heading" className={styles.sectionTitle} data-aos="fade">{content.faqTitle}</h2>
          <div className={styles.faqList}>
            {content.faqs.map((faq) => <article className={styles.faqItem} key={faq.question}><h3>{faq.question}</h3><p>{faq.answer}</p></article>)}
          </div>
        </section>
      </div>

      <section className={styles.cta} aria-labelledby="brain-cta-heading">
        <div className="site-container">
          <div className={styles.ctaCard}>
            <div><h2 id="brain-cta-heading" data-aos="fade">{content.ctaTitle}</h2><p>{content.ctaDescription}</p></div>
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
