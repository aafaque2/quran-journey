import "server-only";
import { cache } from "react";
import { allClaims, type Citation, type JourneyPart, type Work } from "@quran-journey/schema";
import { isVisible, loadContent, resolveVisibility, type LoadedContent } from "@quran-journey/content";

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
  return {
    part,
    surah,
    verses: content.verses(part.surah, part.startAyah, part.endAyah),
    prev: parts[index - 1] ?? null,
    next: parts[index + 1] ?? null,
    total: content.journey.parts.length,
    works: content.works,
    translation: content.manifest.datasets.find((d) => d.id === content.journey.translations[0]?.dataset),
  };
}
