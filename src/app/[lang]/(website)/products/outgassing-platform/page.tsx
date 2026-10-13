import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/locales";
import styles from "./outgassing-platform.module.css";

type Props = { params: Promise<{ lang: string }> };

const copy = {
  zh: {
    title: "材料与零部件释气智能研究平台",
    description: "材料与零部件释气智能研究平台集成真空测试、多模式测量、测试数据采集与分析能力，用于评估材料及零部件在真空环境下的释气性能，并可结合 Vacuum AI 模型与设备端 Agent，进一步实现测试数据的智能化应用。",
    products: "产品",
    breadcrumbLabel: "面包屑导航",
    heroTitle: ["材料与零部件释气智能", "研究平台"],
    featuresTitle: "真空释气测试与多模式测量",
    platformAlt: "TARGON 材料与零部件释气测试平台，包括真空腔体、管路和控制设备",
    features: [
      { title: "材料释气测试", description: "针对真空材料开展释气性能测试，采集材料在真空环境下产生的气体相关测试数据，为材料筛选、性能验证及真空应用研究提供数据支持。" },
      { title: "多模式真空测量", description: "集成真空测试与多模式测量能力，对测试过程中的关键数据进行采集，为材料与零部件的真空性能研究提供测试基础。" },
      { title: "零部件释气验证", description: "面向真空阀门、管路、腔体及其他真空零部件开展释气性能验证，辅助评估零部件对真空环境及系统性能的影响。" },
      { title: "测试数据智能应用", description: "测试数据可进一步连接 Vacuum AI 模型与设备端 Agent，支持测试数据分析、结果研究及智能化应用。" },
    ],
    applicationsTitle: "应用场景",
    applications: [
      { title: "真空材料研究", description: "用于材料释气性能测试与验证，辅助材料筛选、性能评估及真空应用研究。", alt: "研究人员在洁净实验室中进行材料测试" },
      { title: "真空零部件验证", description: "用于真空零部件的释气性能测试，支持产品研发、质量验证及真空系统应用评估。", alt: "用于真空应用的金属零部件" },
      { title: "半导体制造", description: "面向半导体设备材料与零部件，支持真空性能、释气测试与性能验证，为洁净真空环境提供测试数据。", alt: "半导体制造设备中的元件与管路" },
    ],
    parametersTitle: "关键参数",
    parameters: [
      ["测试对象", "真空材料、真空零部件"],
      ["应用场景", "材料释气测试、零部件释气验证"],
      ["核心能力", "真空环境"],
      ["数据用途", "真空测试、多模式测量"],
      ["数据用途", "测试数据采集、数据分析"],
      ["数据用途", "Vacuum AI 模型、设备端Agent"],
    ],
  },
  en: {
    title: "Intelligent Outgassing Research Platform for Materials and Components",
    description: "The Intelligent Outgassing Research Platform for Materials and Components integrates vacuum testing, multiple measurement modes, and test data acquisition and analysis to evaluate outgassing performance in vacuum environments. It can connect with Vacuum AI models and device agents for intelligent use of test data.",
    products: "Products",
    breadcrumbLabel: "Breadcrumb",
    heroTitle: ["Intelligent Outgassing", "Research Platform", "for Materials and Components"],
    featuresTitle: "Vacuum Outgassing Testing and Multi-mode Measurement",
    platformAlt: "TARGON materials and components outgassing test platform with vacuum chambers, pipework, and control equipment",
    features: [
      { title: "Material Outgassing Testing", description: "Tests the outgassing performance of vacuum materials and collects gas-related test data in vacuum environments to support material selection, performance validation, and vacuum application research." },
      { title: "Multi-mode Vacuum Measurement", description: "Integrates vacuum testing and multiple measurement modes to collect key test data, providing a testing foundation for research into the vacuum performance of materials and components." },
      { title: "Component Outgassing Validation", description: "Validates the outgassing performance of vacuum valves, pipes, chambers, and other components to help assess their impact on vacuum environments and system performance." },
      { title: "Intelligent Use of Test Data", description: "Test data can connect with Vacuum AI models and device agents to support data analysis, investigation of test results, and intelligent applications." },
    ],
    applicationsTitle: "Applications",
    applications: [
      { title: "Vacuum Materials Research", description: "Tests and validates material outgassing performance to support material selection, performance evaluation, and vacuum application research.", alt: "Researchers testing materials in a clean laboratory" },
      { title: "Vacuum Component Validation", description: "Tests vacuum component outgassing performance to support product development, quality validation, and vacuum system application evaluation.", alt: "Metal components for vacuum applications" },
      { title: "Semiconductor Manufacturing", description: "Tests vacuum and outgassing performance of semiconductor equipment materials and components, providing test data for clean vacuum environments.", alt: "Components and pipework in semiconductor manufacturing equipment" },
    ],
    parametersTitle: "Key Parameters",
    parameters: [
      ["Test Objects", "Vacuum materials and vacuum components"],
      ["Applications", "Material outgassing testing and component outgassing validation"],
      ["Core Capabilities", "Vacuum environment"],
      ["Data Uses", "Vacuum testing and multi-mode measurement"],
      ["Data Uses", "Test data acquisition and analysis"],
      ["Data Uses", "Vacuum AI models and device agents"],
    ],
  },
} as const;

const featureIcons = [
  "/image/outgassing-material-icon.png",
  "/image/outgassing-measurement-icon.png",
  "/image/outgassing-component-icon.png",
  "/image/outgassing-data-icon.png",
] as const;

const applicationImages = [
  "/image/outgassing-material-research.png",
  "/image/outgassing-component-validation.png",
  "/image/outgassing-semiconductor.png",
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

export default async function OutgassingPlatformPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const content = copy[lang];

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="outgassing-heading">
        <div className="site-container">
          <nav className={styles.breadcrumb} aria-label={content.breadcrumbLabel}>
            <ol>
              <li><Link href={`/${lang}/products`}>{content.products}</Link></li>
              <li aria-hidden="true">&gt;</li>
              <li aria-current="page">{content.title}</li>
            </ol>
          </nav>
          <div className={styles.heroCopy}>
            <h1 id="outgassing-heading" data-aos="fade">
              {content.heroTitle.map((line, index) => <span key={line}>{lang === "en" && index > 0 && " "}{line}</span>)}
            </h1>
            <p>{content.description}</p>
          </div>
        </div>
      </section>

      <div className="site-container">
        <section className={styles.features} aria-labelledby="outgassing-features-heading">
          <h2 id="outgassing-features-heading" className={styles.sectionTitle} data-aos="fade">{content.featuresTitle}</h2>
          <div className={styles.featuresBody}>
            <div className={styles.platformImage}>
              <img src="/image/outgassing-test-platform.png" alt={content.platformAlt} width="1488" height="1008" />
            </div>
            <div className={styles.featureGrid}>
              {content.features.map((feature, index) => (
                <article className={styles.feature} key={feature.title}>
                  <div className={styles.featureIcon}><img src={featureIcons[index]} alt="" width="40" height="40" loading="lazy" /></div>
                  <h3 data-aos="fade">{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.applications} aria-labelledby="outgassing-applications-heading">
          <h2 id="outgassing-applications-heading" className={styles.sectionTitle} data-aos="fade">{content.applicationsTitle}</h2>
          <div className={styles.applicationGrid}>
            {content.applications.map((application, index) => (
              <article className={styles.application} key={application.title}>
                <h3 data-aos="fade">{application.title}</h3>
                <p>{application.description}</p>
                <div className={styles.applicationImage}>
                  <img src={applicationImages[index]} alt={application.alt} width="952" height="598" loading="lazy" />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.parameters} aria-labelledby="outgassing-parameters-heading">
          <h2 id="outgassing-parameters-heading" className={styles.sectionTitle} data-aos="fade">{content.parametersTitle}</h2>
          <table className={styles.parameterTable} aria-labelledby="outgassing-parameters-heading">
            <tbody>
              {content.parameters.map(([label, value]) => (
                <tr key={value}><th scope="row">{label}</th><td>{value}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
