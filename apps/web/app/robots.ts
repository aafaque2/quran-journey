import type { MetadataRoute } from "next";
import { getVisibility } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

/**
 * A drafts build still lets crawlers in: every page carries a noindex tag (app/layout.tsx), and a
 * crawler that is blocked here would never see it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/internal-review", "/api/", "/welcome", "/settings", "/offline"] },
    ...(SITE_URL && getVisibility() !== "drafts" ? { sitemap: `${SITE_URL}/sitemap.xml` } : {}),
  };
}
