import "server-only";
import { cache } from "react";
import { allClaims, type Citation, type Claim, type JourneyPart, type RawVerse, type Work } from "@quran-journey/schema";
import { isVisible, loadContent, resolveVisibility, type LoadedContent } from "@quran-journey/content";
import type { ScriptView, TranslationView } from "@/components/verses";
import { DEFAULT_DEPTH, DEPTHS, inDepth, SECTION_IDS, SECTIONS, sectionOrderValues, type DepthId, type SectionId } from "./reading-prefs";

let memo: LoadedContent | undefined;

/** content/ is re-read on every request in development, so editing a Part shows up on refresh. */
export const getContent = cache((): LoadedContent => {
  if (process.env.NODE_ENV !== "production") return loadContent();
  memo ??= loadContent();
  return memo;
});

export function getVisibility() {
  return resolveVisibility(process.env.CONTENT_VISIBILITY, process.env.NODE_ENV);
}

export function visibleParts(): JourneyPart[] {
  const visibility = getVisibility();
  return getContent().parts.filter((p) => isVisible(p.status, visibility));
}

export function citationsIn(part: JourneyPart): Citation[] {
  const out: Citation[] = [];
  for (const claim of allClaims(part)) {
    out.push(...claim.sources);
    claim.views?.forEach((v) => out.push(...v.sources));
  }
  part.commonMisunderstandings.forEach((m) => out.push(...m.addressedBy));
  out.push(...part.segmentationRationale.sources);
  return out;
}

/** Works cited in a Part, in order of first use (the Qur'an itself excluded). */
export function worksUsed(part: JourneyPart, works: Map<string, Work>): Work[] {
  const seen = new Set<string>();
  const out: Work[] = [];
  for (const c of citationsIn(part)) {
    if (seen.has(c.work)) continue;
    seen.add(c.work);
    const work = works.get(c.work);
    if (work && work.kind !== "quran") out.push(work);
  }
  return out;
}

export function getPartView(partNumber: number) {
  const content = getContent();
  const parts = visibleParts();
  const index = parts.findIndex((p) => p.partNumber === partNumber);
  const part = parts[index];
  if (!part) return null;
  const surah = content.surahs.get(part.surah);
  if (!surah) return null;
  const verses = content.verses(part.surah, part.startAyah, part.endAyah);
  return {
    part,
    surah,
    verses,
    prev: parts[index - 1] ?? null,
    next: parts[index + 1] ?? null,
    total: content.journey.parts.length,
    works: content.works,
    scripts: scriptViews(),
    translations: translationViews(),
    minutes: depthMinutes(part, verses),
  };
}

// ── Choices readers can make (journey.json decides what is offered) ──────────

export function scriptViews(): ScriptView[] {
  return getContent().journey.scripts.map((s) => ({ id: s.dataset, label: s.label }));
}

export function translationViews(): TranslationView[] {
  const { journey, manifest } = getContent();
  return journey.translations.map((t) => {
    const ds = manifest.datasets.find((d) => d.id === t.dataset);
    return {
      id: t.dataset,
      label: t.label,
      languageName: t.languageName,
      language: ds?.language ?? "en",
      dir: ds?.direction ?? "ltr",
    };
  });
}

export interface Catalog {
  scripts: (ScriptView & { description: string; sample: string })[];
  translations: (TranslationView & { description: string; sample: string })[];
  scholars: { id: string; title: string; shortTitle: string; author?: string; authorDied?: string; description?: string }[];
  /** Reading time per Part at each depth, as a range over the Parts available. */
  depths: { id: DepthId; label: string; tagline: string; includes: string; minutes: [number, number] | null }[];
  firstPart: { partNumber: number; title: string } | null;
}

/** Everything the welcome setup and Settings offer, with a sample verse (1:2) for each script and translation. */
export function getCatalog(): Catalog {
  const content = getContent();
  const sample = content.verse(1, 2);
  const parts = visibleParts();
  const perPart = parts.map((p) => depthMinutes(p, content.verses(p.surah, p.startAyah, p.endAyah)));
  return {
    scripts: content.journey.scripts.map((s) => ({
      id: s.dataset,
      label: s.label,
      description: s.description,
      sample: sample?.scripts[s.dataset]?.text ?? "",
    })),
    translations: translationViews().map((t) => {
      const option = content.journey.translations.find((o) => o.dataset === t.id);
      return { ...t, description: option?.description ?? "", sample: sample?.translations[t.id]?.text ?? "" };
    }),
    scholars: [...content.works.values()]
      .filter((w) => w.kind === "tafsir")
      .map((w) => ({
        id: w.id,
        title: w.title,
        shortTitle: w.shortTitle ?? w.title,
        ...(w.author ? { author: w.author } : {}),
        ...(w.authorDied ? { authorDied: w.authorDied } : {}),
        ...(w.description ? { description: w.description } : {}),
      })),
    depths: DEPTHS.map((d) => {
      const m = perPart.map((x) => x[d.id]);
      return { id: d.id, label: d.label, tagline: d.tagline, includes: d.includes, minutes: m.length ? [Math.min(...m), Math.max(...m)] : null };
    }),
    firstPart: parts[0] ? { partNumber: parts[0].partNumber, title: parts[0].title } : null,
  };
}

// ── Sections and reading time ────────────────────────────────────────────────

/** The sections this Part actually has (empty ones are left out rather than shown blank). */
export function partSections(part: JourneyPart): SectionId[] {
  return SECTIONS.map((s) => s.id).filter((id) => {
    if (id === "previous") return part.connectionToPrevious !== null;
    if (id === "next") return part.connectionToNext !== null;
    if (id === "context") return part.context.length > 0;
    if (id === "insights") return part.keyInsights.length > 0;
    if (id === "misunderstandings") return part.commonMisunderstandings.length > 0;
    return true;
  });
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const claimWords = (c: Claim | null) => (c ? words(c.text) + (c.views ?? []).reduce((n, v) => n + words(v.holder) + words(v.text), 0) : 0);

/** Minutes of reading per section: ~200 wpm for English, ~60 wpm for the Arabic (as in estimateMinutes). */
function sectionMinutes(part: JourneyPart, verses: RawVerse[]): Record<SectionId, number> {
  const en = (n: number) => n / 200;
  return {
    previous: en(claimWords(part.connectionToPrevious)),
    verses: en(verses.reduce((n, v) => n + words(v.translation), 0)) + verses.reduce((n, v) => n + words(v.arabic), 0) / 60,
    context: en(part.context.reduce((n, c) => n + claimWords(c), 0)),
    summary: en(claimWords(part.summary)),
    scholars: en(part.tafsirInsights.reduce((n, c) => n + claimWords(c), 0)),
    insights: en(part.keyInsights.reduce((n, c) => n + claimWords(c), 0)),
    takeaways: en(part.takeaways.reduce((n, c) => n + claimWords(c), 0)),
    misunderstandings: en(part.commonMisunderstandings.reduce((n, m) => n + words(m.misreading) + claimWords(m.clarification), 0)),
    reflect: en(part.reflectionQuestions.reduce((n, q) => n + words(q), 0)),
    next: en(claimWords(part.connectionToNext)),
    why: en(words(part.segmentationRationale.text)),
    sources: 0.25,
  };
}

/**
 * Reading time at each depth. The Part's own estimate (`estimatedMinutes`, set by its editor) is the
 * time for the whole Part; shallower depths get the share of it that their sections take to read.
 */
export function depthMinutes(part: JourneyPart, verses: RawVerse[]): Record<DepthId, number> {
  const load = sectionMinutes(part, verses);
  const present = partSections(part);
  const total = present.reduce((n, id) => n + load[id], 0) || 1;
  const out = {} as Record<DepthId, number>;
  for (const d of DEPTHS) {
    const share = present.filter((id) => inDepth(id, d.id)).reduce((n, id) => n + load[id], 0) / total;
    out[d.id] = Math.max(1, Math.round(part.estimatedMinutes * share));
  }
  return out;
}

/** CSS order of each section before the boot script runs: the default depth and order. */
export const DEFAULT_SECTION_ORDER = sectionOrderValues(SECTION_IDS, DEFAULT_DEPTH);
