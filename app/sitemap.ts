import type { MetadataRoute } from "next";

const SITE_URL = "https://www.veltacapital.net";
const INDEXABLE_PATHS = [
  ["/", "weekly", 1],
  ["/methodology", "monthly", 0.8],
  ["/terms", "yearly", 0.3],
  ["/privacy", "yearly", 0.3],
  ["/refunds", "yearly", 0.3],
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_PATHS.map(([path, changeFrequency, priority]) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  }));
}
