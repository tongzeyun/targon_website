type Props = { params: Promise<{ lang: string }> };

export default async function CasesPage({ params }: Props) {
  const { lang } = await params;
  return <main><h1>{lang === "zh" ? "案例页面待更新" : "Cases page pending"}</h1></main>;
}
