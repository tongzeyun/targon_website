import type { MetadataRoute } from "next";
import { locales } from "@/lib/locales";

const paths = [
  "",
  "/products",
  "/products/vacuum-ai",
  "/products/industrial-agent",
  "/products/enterprise-brain",
  "/products/edge-collector",
  "/products/outgassing-platform",
  "/products/pump-gauge-controller",
  "/contact",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((lang) =>
    paths.map((path) => ({
      url: `https://targon.cn/${lang}${path}`,
    })),
  );
}