type Props = { params: Promise<{ lang: string }> };

export default async function ContactPage({ params }: Props) {
  const { lang } = await params;
  return <main><h1>{lang === "zh" ? "联系页面待更新" : "Contact page pending"}</h1></main>;
}
