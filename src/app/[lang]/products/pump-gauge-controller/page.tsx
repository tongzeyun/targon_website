import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/locales";
import styles from "./pump-gauge-controller.module.css";

type Props = { params: Promise<{ lang: string }> };

const copy = {
  zh: {
    title: "涡轮分子泵&真空规显示控制器",
    description: "集成涡轮分子泵控制、真空规数据显示与运行状态监测，支持台面、手持及移动平台操作，兼容多系列真空泵，适用于实验室及多种真空应用。",
    products: "产品",
    breadcrumbLabel: "面包屑导航",
    heroTitle: ["手持式微型涡轮分子泵控制", "与真空测量设备"],
    featuresTitle: "泵控、测量与状态监测，一体化完成",
    deviceAlt: "TARGON 涡轮分子泵与真空规显示控制器，配有彩色触摸屏及侧面接口",
    features: [
      { title: "涡轮分子泵控制", description: "支持 50%～100% 转速设置及 50～120W 功率控制，满足不同真空应用下的泵运行控制需求。" },
      { title: "多类型真空计兼容", description: "通过 RJ45 真空计接口连接皮拉尼、冷阴极、热阴极等真空计，实现真空数据采集与显示。" },
      { title: "实时运行状态显示", description: "实时显示转速、电机温度、控制器温度、转子温度及驱动电流、电压、功率等运行状态。" },
    ],
    applicationsTitle: "应用场景",
    applications: [
      { title: "实验室真空系统", description: "用于涡轮分子泵控制、真空测量与运行状态监测。", alt: "实验室真空系统的管路、控制面板与设备" },
      { title: "移动真空设备", description: "支持手持及移动平台操作，满足便携式真空应用需求。", alt: "研究人员操作真空实验设备" },
      { title: "真空测试与研发", description: "集成泵控、真空计显示与运行数据监测，适用于多种真空测试与研发场景。", alt: "用于真空测试与研发的设备、线缆和控制元件" },
    ],
    parametersTitle: "规格参数",
    parameters: [
      ["电源", "220V"],
      ["输出电压", "+24V DC"],
      ["分子泵控制接口", "DB15"],
      ["真空计控制接口", "RJ45"],
      ["分子泵功率设置", "50～120W"],
      ["分子泵转速设置", "50%～100%"],
      ["兼容真空计", "皮拉尼、冷阴极、热阴极等"],
      ["操作方式", "台面 / 手持 / 移动平台"],
      ["显示方式", "高分辨率彩色触摸屏"],
    ],
  },
  en: {
    title: "Turbomolecular Pump and Vacuum Gauge Display Controller",
    description: "Integrates turbomolecular pump control, vacuum gauge data display, and operating status monitoring. Supports benchtop, handheld, and mobile platform operation, is compatible with multiple vacuum pump series, and is suitable for laboratories and a range of vacuum applications.",
    products: "Products",
    breadcrumbLabel: "Breadcrumb",
    heroTitle: ["Handheld Miniature", "Turbomolecular Pump Control", "and Vacuum Measurement"],
    featuresTitle: "Integrated Pump Control, Measurement, and Status Monitoring",
    deviceAlt: "TARGON turbomolecular pump and vacuum gauge display controller with a color touchscreen and side connectors",
    features: [
      { title: "Turbomolecular Pump Control", description: "Supports speed settings from 50% to 100% and power control from 50 to 120W to meet pump operation requirements across different vacuum applications." },
      { title: "Multiple Vacuum Gauge Types", description: "Connects Pirani, cold cathode, hot cathode, and other vacuum gauges through an RJ45 interface for vacuum data acquisition and display." },
      { title: "Real-time Operating Status", description: "Displays speed, motor temperature, controller temperature, rotor temperature, and drive current, voltage, and power in real time." },
    ],
    applicationsTitle: "Applications",
    applications: [
      { title: "Laboratory Vacuum Systems", description: "For turbomolecular pump control, vacuum measurement, and operating status monitoring.", alt: "Pipework, control panels, and equipment in a laboratory vacuum system" },
      { title: "Mobile Vacuum Equipment", description: "Supports handheld and mobile platform operation for portable vacuum applications.", alt: "Researcher operating vacuum laboratory equipment" },
      { title: "Vacuum Testing and R&D", description: "Integrates pump control, vacuum gauge display, and operating data monitoring for a range of vacuum testing and research applications.", alt: "Equipment, cables, and control components for vacuum testing and research" },
    ],
    parametersTitle: "Specifications",
    parameters: [
      ["Power Supply", "220V"],
      ["Output Voltage", "+24V DC"],
      ["Pump Control Interface", "DB15"],
      ["Vacuum Gauge Interface", "RJ45"],
      ["Pump Power Setting", "50–120W"],
      ["Pump Speed Setting", "50%–100%"],
      ["Compatible Vacuum Gauges", "Pirani, cold cathode, hot cathode, and others"],
      ["Operation", "Benchtop / Handheld / Mobile platform"],
      ["Display", "High-resolution color touchscreen"],
    ],
  },
} as const;

const featureIcons = [
  "/image/pump-controller-control-icon.png",
  "/image/pump-controller-gauge-icon.png",
  "/image/pump-controller-status-icon.png",
] as const;

const applicationImages = [
  "/image/pump-controller-laboratory.png",
  "/image/pump-controller-mobile-vacuum.png",
  "/image/pump-controller-research.png",
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

export default async function PumpGaugeControllerPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const content = copy[lang];

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="pump-controller-heading">
        <div className="site-container">
          <nav className={styles.breadcrumb} aria-label={content.breadcrumbLabel}>
            <ol>
              <li><Link href={`/${lang}/products`}>{content.products}</Link></li>
              <li aria-hidden="true">&gt;</li>
              <li aria-current="page">{content.title}</li>
            </ol>
          </nav>
          <div className={styles.heroCopy}>
            <h1 id="pump-controller-heading" data-aos="fade">
              {content.heroTitle.map((line, index) => <span key={line}>{lang === "en" && index > 0 && " "}{line}</span>)}
            </h1>
            <p>{content.description}</p>
          </div>
        </div>
      </section>

      <div className="site-container">
        <section className={styles.features} aria-labelledby="pump-features-heading">
          <h2 id="pump-features-heading" className={styles.sectionTitle} data-aos="fade">{content.featuresTitle}</h2>
          <div className={styles.featuresBody}>
            <div className={styles.deviceImage}>
              <img src="/image/pump-controller-device.png" alt={content.deviceAlt} width="1488" height="1008" />
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

        <section className={styles.applications} aria-labelledby="pump-applications-heading">
          <h2 id="pump-applications-heading" className={styles.sectionTitle} data-aos="fade">{content.applicationsTitle}</h2>
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

        <section className={styles.parameters} aria-labelledby="pump-parameters-heading">
          <h2 id="pump-parameters-heading" className={styles.sectionTitle} data-aos="fade">{content.parametersTitle}</h2>
          <table className={styles.parameterTable} aria-labelledby="pump-parameters-heading">
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
