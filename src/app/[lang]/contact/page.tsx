import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/locales";
import styles from "./contact.module.css";

type Props = { params: Promise<{ lang: string }> };

const topicIcons = [
  "/image/contact-ai.png",
  "/image/contact-industry.png",
  "/image/contact-commerce.png",
  "/image/contact-technology.png",
] as const;

const copy = {
  zh: {
    title: "联系我们 | 探氩科技",
    description: "联系 TARGON，沟通 AI 产品咨询、产业合作、商务合作与技术合作，预约产品演示。",
    heroTitle: "联系我们",
    heroIntro: "与 TARGON 一起，让 AI 真正进入产业现场。",
    products: ["Local Industrial Agent", "Vacuum AI", "Enterprise Brain", "灵眸智售"],
    contactTitle: "联系 TARGON",
    contactIntro: "我们随时为您提供咨询与支持。",
    businessTitle: "商务咨询",
    phone: "电话：+86 18321395819",
    email: "邮箱：Charles.zhang@Targon.cn",
    addressTitle: "公司地址",
    address: "上海市浦东新区龙东大道3000号\n张江集电港1幢A区12楼Z2室",
    topicsTitle: "我们可以聊什么",
    topicsIntro: "无论是产品咨询、项目合作，还是技术交流，我们都乐于与您探讨。",
    topics: [
      {
        title: "AI产品咨询",
        description: "了解 TARGON AI 产品及相关智能化解决方案，沟通产品能力、应用场景与实际业务需求。",
        hover: "Local Industrial Agent｜Enterprise Brain\nVacuum AI｜灵眸智售\n企业 AI 应用｜工业 AI 解决方案",
      },
      {
        title: "产业合作",
        description: "围绕真空、半导体及相关产业场景，探索产品、资源与业务合作机会。",
        hover: "产业资源合作｜产品合作｜联合开发｜渠道合作\n产业场景合作｜上下游资源对接方案",
      },
      {
        title: "商务合作",
        description: "围绕工业硬件、数据资源及商业服务，开展采购、销售、交易与其他商务合作。",
        hover: "工业硬件采购｜真空及半导体设备买卖\n数据交易｜数据采购｜数据销售｜渠道合作\n网站建设及数字化服务",
      },
      {
        title: "技术合作",
        description: "围绕 AI、工业软件及相关技术能力，探索技术研发、产品集成与技术应用合作。",
        hover: "AI 技术合作｜工业 AI｜模型与算法｜软件开发\n系统集成｜技术研发｜产品技术合作",
      },
    ],
    demoTitle: "预约产品演示",
    demoIntro: "了解 TARGON AI 产品如何应用于真实工业与产业场景。",
    formKicker: "预约信息填写",
    interest: "您感兴趣的产品",
    productOptions: ["Local Industrial Agent", "Enterprise Brain", "Vacuum AI", "灵眸智售", "其它"],
    name: "姓名",
    company: "公司",
    contact: "联系方式",
    needs: "需求描述",
    namePlaceholder: "请输入您的姓名",
    companyPlaceholder: "请输入您的姓名",
    contactPlaceholder: "请输入手机号或邮箱",
    needsPlaceholder: "请简单描述您的需求（选填）",
    submit: "提交预约",
  },
  en: {
    title: "Contact | Targon",
    description: "Contact TARGON about AI products, industry partnerships, business cooperation, and technology collaboration, or request a product demonstration.",
    heroTitle: "Contact Us",
    heroIntro: "Together with TARGON, bring AI into real industrial applications.",
    products: ["Local Industrial Agent", "Vacuum AI", "Enterprise Brain", "Smart Eye"],
    contactTitle: "Contact TARGON",
    contactIntro: "We are here to help with your enquiries and support needs.",
    businessTitle: "Business Enquiries",
    phone: "Phone: +86 18321395819",
    email: "Email: Charles.zhang@Targon.cn",
    addressTitle: "Company Address",
    address: "Room Z2, 12F, Block A, Building 1, Zhangjiang IC Port\n3000 Longdong Avenue, Pudong, Shanghai",
    topicsTitle: "What We Can Discuss",
    topicsIntro: "We welcome conversations about products, projects, and technology.",
    topics: [
      {
        title: "AI Product Enquiries",
        description: "Explore TARGON AI products and intelligent solutions, and discuss capabilities, applications, and business needs.",
        hover: "Local Industrial Agent · Enterprise Brain\nVacuum AI · Smart Eye\nEnterprise AI · Industrial AI solutions",
      },
      {
        title: "Industry Partnerships",
        description: "Explore product, resource, and business partnerships across vacuum, semiconductor, and related industries.",
        hover: "Industry resources · Products · Joint development\nChannels · Industrial applications\nUpstream and downstream partnerships",
      },
      {
        title: "Business Cooperation",
        description: "Discuss purchasing, sales, trading, and other cooperation involving industrial hardware, data resources, and business services.",
        hover: "Industrial hardware · Vacuum and semiconductor equipment\nData trading · Data procurement · Data sales · Channels\nWebsites and digital services",
      },
      {
        title: "Technology Collaboration",
        description: "Explore research, product integration, and applications involving AI, industrial software, and related technologies.",
        hover: "AI · Industrial AI · Models and algorithms\nSoftware development · System integration\nTechnology research · Product collaboration",
      },
    ],
    demoTitle: "Request a Product Demo",
    demoIntro: "Discover how TARGON AI products apply to real industrial and industry scenarios.",
    formKicker: "Demo Request Details",
    interest: "Products You Are Interested In",
    productOptions: ["Local Industrial Agent", "Enterprise Brain", "Vacuum AI", "Smart Eye", "Other"],
    name: "Name",
    company: "Company",
    contact: "Contact Details",
    needs: "Your Requirements",
    namePlaceholder: "Enter your name",
    companyPlaceholder: "Enter your name",
    contactPlaceholder: "Enter your phone number or email",
    needsPlaceholder: "Briefly describe your needs (optional)",
    submit: "Request a Demo",
  },
} as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { title: copy[lang].title, description: copy[lang].description, robots: { index: false, follow: false } };
}

export default async function ContactPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const content = copy[lang];

  return (
    <main className={styles.page}>
      <section className={`site-bg-box ${styles.hero}`} aria-labelledby="contact-heading">
        <div className={`site-container ${styles.heroCopy}`}>
          <p data-aos="fade">{content.heroIntro}</p>
          <h1 id="contact-heading" data-aos="fade">{content.heroTitle}</h1>
          <div className={styles.heroArrow} aria-hidden="true"><img src="/image/contact-down-arrow.png" alt="" width="40" height="40" /></div>
        </div>
        <div className={`site-container ${styles.heroProducts}`}>
          {content.products.map((product) => <span key={product}>{product}</span>)}
        </div>
      </section>

      <section className={`site-container ${styles.details}`} aria-labelledby="details-heading">
        <h2 id="details-heading" data-aos="fade">{content.contactTitle}</h2>
        <p className={styles.sectionIntro} data-aos="fade">{content.contactIntro}</p>
        <div className={styles.contactGrid}>
          <div className={styles.contactItem}>
            <img src="/image/contact-business.png" alt="" width="64" height="64" />
            <div><h3>{content.businessTitle}</h3><p>{content.phone}<br />{content.email}</p></div>
          </div>
          <div className={styles.contactItem}>
            <img src="/image/contact-address.png" alt="" width="64" height="64" />
            <div><h3>{content.addressTitle}</h3><p>{content.address}</p></div>
          </div>
        </div>
      </section>

      <section className={`site-container ${styles.topics}`} aria-labelledby="topics-heading">
        <h2 id="topics-heading" data-aos="fade">{content.topicsTitle}</h2>
        <p className={styles.sectionIntro} data-aos="fade">{content.topicsIntro}</p>
        <div className={styles.topicGrid}>
          {content.topics.map((topic, index) => (
            <article className={styles.topicCard} tabIndex={0} key={topic.title} aria-labelledby={`contact-topic-${index}`}>
              <div className={styles.topicHeader}>
                <div className={styles.topicIcon}><img src={topicIcons[index]} alt="" width="50" height="50" /></div>
                <p className={styles.topicHover}>{topic.hover}</p>
              </div>
              <div className={styles.topicCopy}><h3 id={`contact-topic-${index}`}>{topic.title}</h3><p>{topic.description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className={`site-container ${styles.demo}`} aria-labelledby="demo-heading">
        <h2 id="demo-heading" data-aos="fade">{content.demoTitle}</h2>
        <p className={styles.sectionIntro} data-aos="fade">{content.demoIntro}</p>
        <div className={`site-bg-box ${styles.demoPanel}`}>
          <div className={styles.demoCopy}>
            <p className={styles.formKicker}>{content.formKicker}</p>
            <h3 id="demo-form-heading">{content.demoTitle}</h3>
            <p>{content.demoIntro}</p>
          </div>
          <div className={styles.form} role="form" aria-labelledby="demo-form-heading">
            <fieldset className={styles.products}>
              <legend>{content.interest}</legend>
              <div className={styles.productOptions}>
                {content.productOptions.map((product, index) => <label key={product}><input type="radio" name="productInterest" value={index} /><span>{product}</span></label>)}
              </div>
            </fieldset>
            <div className={styles.fields}>
              <div className={styles.field}><label htmlFor="demo-name">{content.name}*</label><input id="demo-name" name="name" autoComplete="name" placeholder={content.namePlaceholder} required /></div>
              <div className={styles.field}><label htmlFor="demo-company">{content.company}*</label><input id="demo-company" name="company" autoComplete="organization" placeholder={content.companyPlaceholder} required /></div>
              <div className={styles.field}><label htmlFor="demo-needs">{content.needs}</label><textarea id="demo-needs" name="requirements" placeholder={content.needsPlaceholder} rows={4} /></div>
              <div className={styles.field}><label htmlFor="demo-contact">{content.contact}*</label><input id="demo-contact" name="contact" placeholder={content.contactPlaceholder} required /></div>
              <button className={`site-button site-button--primary ${styles.submit}`} type="button">{content.submit}</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
