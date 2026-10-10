import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/locales";
import { SoftwareCarousel } from "./software-carousel";
import styles from "./products.module.css";

type Props = { params: Promise<{ lang: string }> };

const hardwareProducts = [
  { slug: "outgassing-platform", image: "/image/products-outgassing-platform.png" },
  { slug: "edge-collector", image: "/image/products-edge-collector.png" },
  { slug: "pump-gauge-controller", image: "/image/products-pump-gauge-controller.png" },
] as const;

const copy = {
  zh: {
    title: "产品 | 探氩科技",
    description: "了解探氩科技面向真空与半导体产业的 AI 软件产品和工业硬件产品。",
    heroIntro: "TARGON 面向真空与半导体产业，提供工业硬件与 AI 软件产品，覆盖设备智能化、企业智能化、真空模拟计算与产业应用等真实场景。",
    heroTitle: "工业硬件与 AI 软件产品",
    softwareTitle: "AI 软件产品",
    hardwareTitle: "工业硬件产品",
    viewProduct: "查看产品",
    moreHardware: "更多硬件产品，敬请期待……",
    software: {
      vacuum: "提供 AI 智能助手、真空模型计算、真空设备与元件交易等能力，支持真空系统计算、设备选型与产业服务。",
      agent: "面向真空与半导体设备，提供设备理解、故障诊断、操作指导、预测维护与工艺优化能力，支持边缘网关与工业 PC 本地部署。",
      brain: "理解企业文件、数据与知识，为企业提供信息提取、数据分析、业务判断与任务执行能力，支持企业私有化部署。",
    },
    hardware: [
      { title: "材料与零部件释气智能研究平台", description: "集成真空测试、多模式测量与数据采集，支持材料释气与零部件验证，并可结合 Vacuum AI 模型与设备端 Agent，实现测试数据智能化应用。" },
      { title: "TARGON边缘采集器", description: "面向半导体机台、产线与真空设备，支持传感器、PLC等数据采集与设备连接，为工业AI、设备监控和智能运维提供数据基础。" },
      { title: "涡轮分子泵&真空规显示控制器", description: "集涡轮分子泵控制、真空规监测与显示于一体，支持多系列真空泵及多种真空规接口，适用于台面、手持及移动真空应用。" },
    ],
  },
  en: {
    title: "Products | Targon",
    description: "Explore Targon's AI software and industrial hardware products for the vacuum and semiconductor industries.",
    heroIntro: "TARGON provides industrial hardware and AI software for the vacuum and semiconductor industries, spanning equipment intelligence, enterprise intelligence, vacuum simulation and industrial applications.",
    heroTitle: "Industrial Hardware and AI Software",
    softwareTitle: "AI Software Products",
    hardwareTitle: "Industrial Hardware Products",
    viewProduct: "View Product",
    moreHardware: "More hardware products are coming soon…",
    software: {
      vacuum: "AI assistants, vacuum model calculations, and a marketplace for vacuum equipment and components support vacuum system calculations, equipment selection, and industry services.",
      agent: "For vacuum and semiconductor equipment, it supports equipment understanding, fault diagnosis, operating guidance, predictive maintenance, and process optimization, with local deployment on edge gateways and industrial PCs.",
      brain: "It interprets enterprise files, data, and knowledge to support information extraction, data analysis, business decisions, and task execution, with private enterprise deployment.",
    },
    hardware: [
      { title: "Intelligent Outgassing Research Platform for Materials and Components", description: "Combines vacuum testing, multiple measurement modes, and data collection for material outgassing and component validation. It can work with Vacuum AI models and device agents to make use of test data." },
      { title: "TARGON Edge Data Collector", description: "Connects sensors, PLCs, semiconductor tools, production lines, and vacuum equipment to provide data for industrial AI, equipment monitoring, and intelligent maintenance." },
      { title: "Turbomolecular Pump and Vacuum Gauge Display Controller", description: "Combines turbomolecular pump control with vacuum gauge monitoring and display. It supports multiple pump series and vacuum gauge interfaces for benchtop, handheld, and mobile vacuum applications." },
    ],
  },
} as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { title: copy[lang].title, description: copy[lang].description, robots: { index: false, follow: false } };
}

export default async function ProductsPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const content = copy[lang];

  return (
    <main className={styles.page}>
      <section className={`site-bg-box ${styles.hero}`} aria-labelledby="products-heading">
        <img className={styles.heroOrb} src="/image/products-hero-orb.png" alt="" aria-hidden="true" width="710" height="710" />
        <div className={`site-container ${styles.heroInner}`}>
          <div className={styles.heroCopy}>
            <p data-aos="fade">{content.heroIntro}</p>
            <h1 data-aos="fade" id="products-heading">{content.heroTitle}</h1>
          </div>
          <div className={styles.heroProducts} aria-label={content.softwareTitle}>
            <span data-aos="fade">Local Industrial Agent</span><span data-aos="fade">Vacuum AI</span><span data-aos="fade">Enterprise Brain</span>
          </div>
        </div>
      </section>

      <section className={styles.software} aria-labelledby="software-heading">
        <h2 id="software-heading" className="site-section-title" data-aos="fade">{content.softwareTitle}</h2>
        <SoftwareCarousel
          lang={lang}
          viewProduct={content.viewProduct}
          items={[
            { slug: "enterprise-brain", title: "Enterprise Brain", description: content.software.brain, image: "/image/products-enterprise-brain.png" },
            { slug: "vacuum-ai", title: "Vacuum AI", description: content.software.vacuum, image: "/image/products-vacuum-ai.png" },
            { slug: "industrial-agent", title: "Local Industrial Agent", description: content.software.agent, image: "/image/products-industrial-agent.png" },
          ]}
        />
      </section>

      <section className={`site-container ${styles.hardware}`} aria-labelledby="hardware-heading">
        <h2 id="hardware-heading" className="site-section-title" data-aos="fade">{content.hardwareTitle}</h2>
        <div className={styles.hardwareCards}>
          {content.hardware.map((product, index) => (
            <article className={styles.hardwareCard} key={product.title}>
              <div className={styles.hardwareVisual}><img src={hardwareProducts[index].image} alt={product.title} width="396" height="416" /></div>
              <div className={styles.hardwareBody}>
                <h3 data-aos="fade">{product.title}</h3><p data-aos="fade">{product.description}</p>
                <Link className={styles.arrowButton} href={`/${lang}/products/${hardwareProducts[index].slug}`} aria-label={`${content.viewProduct}: ${product.title}`}><span aria-hidden="true">›</span></Link>
              </div>
            </article>
          ))}
        </div>
        <p className={styles.moreHardware} data-aos="fade">{content.moreHardware}</p>
      </section>
    </main>
  );
}
