import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/locales";
import styles from "./edge-collector.module.css";

type Props = { params: Promise<{ lang: string }> };

const copy = {
  zh: {
    title: "TARGON 边缘采集器",
    description: "TARGON 边缘采集器是面向半导体机台、真空设备及工业现场，连接传感器、PLC与上位机，实现设备数据采集与边缘连接。",
    products: "产品",
    breadcrumbLabel: "面包屑导航",
    heroTitle: ["工业设备数据采集", "与边缘连接设备"],
    featuresTitle: "连接工业设备，让现场数据可感知",
    diagramAlt: "TARGON 边缘采集器连接工业设备、采集数据并支持 AI 软件应用的示意图",
    features: [
      { title: "多设备连接", description: "支持工业设备、传感器、PLC等数据接入。" },
      { title: "实时数据采集", description: "采集设备状态、报警及关键工艺数据。" },
      { title: "智能应用基础", description: "为设备监控、工业 AI 和智能运维提供数据基础。" },
    ],
    applicationsTitle: "应用场景",
    applications: [
      { title: "半导体设备", description: "设备状态与工艺数据采集", alt: "半导体设备中的管路与阀门" },
      { title: "真空设备", description: "运行状态与关键参数监测", alt: "工业真空设备与管路" },
      { title: "工业现场", description: "设备数据接入与智能化升级", alt: "工业现场中的生产设备" },
    ],
    parametersTitle: "核心参数",
    parameters: [
      ["数据接入", "传感器、PLC 等工业设备"],
      ["应用场景", "半导体设备、真空设备等工业现场"],
      ["核心能力", "设备数据采集与边缘连接"],
      ["数据用途", "设备监控、状态分析、智能应用"],
    ],
  },
  en: {
    title: "TARGON Edge Data Collector",
    description: "TARGON Edge Data Collector connects sensors, PLCs, and host computers in semiconductor equipment, vacuum equipment, and industrial settings to collect equipment data and provide edge connectivity.",
    products: "Products",
    breadcrumbLabel: "Breadcrumb",
    heroTitle: ["Industrial Data Acquisition", "and Edge Connectivity"],
    featuresTitle: "Connect Industrial Equipment and Access On-site Data",
    diagramAlt: "Diagram showing TARGON Edge Data Collector connecting industrial equipment, collecting data, and supporting AI software applications",
    features: [
      { title: "Multi-device Connectivity", description: "Connects industrial equipment, sensors, PLCs, and other data sources." },
      { title: "Real-time Data Acquisition", description: "Collects equipment status, alarms, and key process data." },
      { title: "A Foundation for Intelligent Applications", description: "Provides data for equipment monitoring, industrial AI, and intelligent maintenance." },
    ],
    applicationsTitle: "Applications",
    applications: [
      { title: "Semiconductor Equipment", description: "Equipment status and process data acquisition", alt: "Pipes and valves in semiconductor equipment" },
      { title: "Vacuum Equipment", description: "Operating status and key parameter monitoring", alt: "Industrial vacuum equipment and pipework" },
      { title: "Industrial Settings", description: "Equipment data connectivity and intelligent upgrades", alt: "Production equipment in an industrial setting" },
    ],
    parametersTitle: "Key Parameters",
    parameters: [
      ["Data Sources", "Sensors, PLCs, and other industrial equipment"],
      ["Applications", "Semiconductor equipment, vacuum equipment, and other industrial settings"],
      ["Core Capabilities", "Equipment data acquisition and edge connectivity"],
      ["Data Uses", "Equipment monitoring, status analysis, and intelligent applications"],
    ],
  },
} as const;

const featureIcons = [
  "/image/edge-collector-devices-icon.png",
  "/image/edge-collector-data-icon.png",
  "/image/edge-collector-ai-icon.png",
] as const;

const applicationImages = [
  "/image/edge-collector-semiconductor.png",
  "/image/edge-collector-vacuum.png",
  "/image/edge-collector-industrial.png",
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

export default async function EdgeCollectorPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const content = copy[lang];

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="edge-collector-heading">
        <div className="site-container">
          <nav className={styles.breadcrumb} aria-label={content.breadcrumbLabel}>
            <ol>
              <li><Link href={`/${lang}/products`}>{content.products}</Link></li>
              <li aria-hidden="true">&gt;</li>
              <li aria-current="page">{content.title}</li>
            </ol>
          </nav>
          <div className={styles.heroCopy}>
            <h1 id="edge-collector-heading" data-aos="fade">
              {content.heroTitle.map((line) => <span key={line}>{line}</span>)}
            </h1>
            <p data-aos="fade">{content.description}</p>
          </div>
        </div>
      </section>

      <div className="site-container">
        <section className={styles.features} aria-labelledby="edge-features-heading">
          <h2 id="edge-features-heading" className={styles.sectionTitle} data-aos="fade">{content.featuresTitle}</h2>
          <div className={styles.featuresBody}>
            <div className={styles.connectivityImage}>
              <img src="/image/edge-collector-connectivity.png" alt={content.diagramAlt} width="1488" height="1008" />
            </div>
            <div className={styles.featureGrid}>
              {content.features.map((feature, index) => (
                <article className={styles.feature} key={feature.title}>
                  <div className={styles.featureIcon}><img src={featureIcons[index]} alt="" width="40" height="40" /></div>
                  <h3 data-aos="fade">{feature.title}</h3>
                  <p data-aos="fade">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.applications} aria-labelledby="edge-applications-heading">
          <h2 id="edge-applications-heading" className={styles.sectionTitle} data-aos="fade">{content.applicationsTitle}</h2>
          <div className={styles.applicationGrid}>
            {content.applications.map((application, index) => (
              <article className={styles.application} key={application.title}>
                <h3 data-aos="fade">{application.title}</h3>
                <p data-aos="fade">{application.description}</p>
                <div className={styles.applicationImage}>
                  <img src={applicationImages[index]} alt={application.alt} width="952" height="598" loading="lazy" />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.parameters} aria-labelledby="edge-parameters-heading">
          <h2 id="edge-parameters-heading" className={styles.sectionTitle} data-aos="fade">{content.parametersTitle}</h2>
          <table className={styles.parameterTable} aria-labelledby="edge-parameters-heading">
            <tbody>
              {content.parameters.map(([label, value]) => (
                <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
