import type { Metadata } from "next";
import "./globals.css";
import {ResearchArchiveProvider} from "./ResearchArchiveBoundary";

export async function generateMetadata(): Promise<Metadata> {
  const origin = "http://localhost:3000";
  return {
    title: "市场图谱｜金融市场分析框架",
    description: "连接全球资产、行业、产业链、公司与股权关系的研究工作台。",
    openGraph: { title: "市场图谱", description: "金融市场分析框架", images: [`${origin}/og.png`] },
    twitter: { card: "summary_large_image", title: "市场图谱", description: "金融市场分析框架", images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><ResearchArchiveProvider>{children}</ResearchArchiveProvider></body></html>;
}
