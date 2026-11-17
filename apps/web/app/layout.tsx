import type { Metadata, Viewport } from "next";
import { Amiri_Quran, Instrument_Sans, Literata, Noto_Nastaliq_Urdu, Noto_Serif_Devanagari } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { DepthSwitch, PrefsSync, ThemeToggle } from "@/components/header-controls";
import { OctagramIcon, SlidersIcon } from "@/components/icons";
import { getContent } from "@/lib/content";
import { bootConfig, bootScript, DEFAULT_DEPTH } from "@/lib/reading-prefs";
import { SITE } from "@/lib/site";
import "./globals.css";
import "./personalise.css";

const quranFace = Amiri_Quran({ weight: "400", subsets: ["arabic"], variable: "--font-quran-face", display: "swap" });
const readingFace = Literata({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-read", display: "swap" });
const uiFace = Instrument_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
// Only downloaded when an Urdu or Hindi translation is actually on screen.
const urduFace = Noto_Nastaliq_Urdu({ weight: "400", subsets: ["arabic"], variable: "--font-urdu", display: "swap", preload: false });
const devanagariFace = Noto_Serif_Devanagari({ weight: "400", subsets: ["devanagari"], variable: "--font-deva", display: "swap", preload: false });

const THEME_COLORS = { light: "#f6f2ea", dark: "#12110e" };

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

const SAFE_ID = /^[a-z0-9-]+$/;

export default function RootLayout({ children }: { children: ReactNode }) {
  const { manifest, journey } = getContent();
  const attributions = manifest.datasets.filter((d) => d.kind !== "quran_metadata");
  const scripts = journey.scripts.map((s) => s.dataset).filter((id) => SAFE_ID.test(id));
  const translations = journey.translations.map((t) => t.dataset).filter((id) => SAFE_ID.test(id));
  const cfg = bootConfig(scripts, translations, THEME_COLORS);

  // Show only the reader's script and translations (the boot script sets data-script / data-tr on <html>).
  const choiceCss = [
    ...scripts.map((id) => `:root[data-script="${id}"] [data-ar-script]:not([data-ar-script="${id}"]){display:none!important}`),
    ...translations.map((id) => `:root:not([data-tr~="${id}"]) [data-tr-key="${id}"]{display:none!important}`),
  ].join("\n");

  return (
    <html
      lang="en"
      className={`${quranFace.variable} ${readingFace.variable} ${uiFace.variable} ${urduFace.variable} ${devanagariFace.variable}`}
      // Defaults for the first paint; the boot script replaces them with the reader's preferences.
      data-depth={DEFAULT_DEPTH}
      data-script={scripts[0]}
      data-tr={translations[0]}
      data-tr-count="1"
      data-mode="both"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript(cfg) }} />
        <style dangerouslySetInnerHTML={{ __html: choiceCss }} />
      </head>
      <body className="min-h-dvh antialiased">
        <PrefsSync />
        <a
          href="#main"
          className="sr-only rounded-full bg-accent px-4 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50"
        >
          Skip to content
        </a>
        <header className="site-header sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
            <Link href="/" className="flex shrink-0 items-center gap-2 font-serif text-lg font-semibold tracking-tight" aria-label={`${SITE.name}: the journey`}>
              <OctagramIcon className="h-5 w-5 text-gold" />
              <span className="hidden sm:inline">{SITE.name}</span>
            </Link>
            <nav className="hidden items-center gap-5 ps-4 text-sm text-ink-2 lg:flex">
              <Link href="/" className="hover:text-ink">
                Journey
              </Link>
              <Link href="/about" className="hover:text-ink">
                How it works
              </Link>
            </nav>
            <div className="ms-auto flex items-center gap-1 sm:gap-1.5">
              <DepthSwitch />
              <ThemeToggle />
              <Link href="/settings" className="icon-btn" aria-label="Settings" title="Settings">
                <SlidersIcon className="h-[1.1rem] w-[1.1rem]" />
              </Link>
            </div>
          </div>
        </header>

        <main id="main">{children}</main>

        <footer className="site-footer mt-16 border-t border-line">
          <div className="mx-auto max-w-6xl space-y-3 px-4 py-10 text-xs leading-relaxed text-ink-3 sm:px-6">
            <p className="font-medium text-ink-2">Pilot. Content is under review. If something looks wrong, please use &ldquo;Report an issue&rdquo; on any Part.</p>
            <ul className="space-y-1">
              {attributions.map((d) => (
                <li key={d.id}>
                  {d.attribution} ·{" "}
                  <a href={d.attributionUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
                    {new URL(d.attributionUrl).hostname}
                  </a>
                </li>
              ))}
            </ul>
            <p>
              Tafsir is cited from named works; see{" "}
              <Link href="/about#sources" className="underline underline-offset-2 hover:text-ink">
                sources &amp; method
              </Link>
              . Your settings and progress stay on this device.{" "}
              <Link href="/settings" className="underline underline-offset-2 hover:text-ink">
                Settings
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
