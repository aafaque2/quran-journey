import type { Metadata, Viewport } from "next";
import { Amiri_Quran, Instrument_Sans, Literata } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { OctagramIcon } from "@/components/icons";
import { getContent } from "@/lib/content";
import { SITE } from "@/lib/site";
import "./globals.css";

const quranFace = Amiri_Quran({ weight: "400", subsets: ["arabic"], variable: "--font-quran-face", display: "swap" });
const readingFace = Literata({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-read", display: "swap" });
const uiFace = Instrument_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f2ea" },
    { media: "(prefers-color-scheme: dark)", color: "#12110e" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const { manifest } = getContent();
  const attributions = manifest.datasets.filter((d) => d.kind !== "quran_metadata");

  return (
    <html lang="en" className={`${quranFace.variable} ${readingFace.variable} ${uiFace.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only rounded-full bg-accent px-4 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-serif text-lg font-semibold tracking-tight">
              <OctagramIcon className="h-5 w-5 text-gold" />
              {SITE.name}
            </Link>
            <nav className="flex items-center gap-5 text-sm text-ink-2">
              <Link href="/" className="hover:text-ink">
                Journey
              </Link>
              <Link href="/about" className="hover:text-ink">
                How it works
              </Link>
            </nav>
          </div>
        </header>

        <main id="main">{children}</main>

        <footer className="mt-16 border-t border-line">
          <div className="mx-auto max-w-5xl space-y-3 px-4 py-10 text-xs leading-relaxed text-ink-3 sm:px-6">
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
              .
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
