import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/** Makes the site installable on phones and desktops (served at /manifest.webmanifest). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    lang: "en",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f2ea",
    theme_color: "#f6f2ea",
    categories: ["education", "books"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Reading settings", short_name: "Settings", url: "/settings" },
      { name: "About the project", short_name: "About", url: "/about" },
    ],
  };
}
