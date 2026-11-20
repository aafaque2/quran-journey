import type { MetadataRoute } from "next";
import { visibleParts } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

/** Public pages only. Needs NEXT_PUBLIC_SITE_URL so the URLs are absolute. */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!SITE_URL) return [];
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    ...visibleParts().map((p) => ({ url: `${SITE_URL}/parts/${p.partNumber}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
