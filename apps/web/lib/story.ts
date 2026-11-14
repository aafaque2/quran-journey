import type { Claim, ContentCategory, JourneyPart, RawVerse } from "@quran-journey/schema";

/** One screen of Story Mode. Built on the server from the Part's own reviewed sections. */
export interface StorySegment {
  phase: string;
  category?: ContentCategory;
  /** Verbatim Arabic (recitation phase only). */
  arabic?: string;
  /** Verbatim basmala shown before a surah's first verse (recitation phase only). */
  bismillah?: string;
  surah?: number;
  ayah?: number;
  lines: string[];
}

const claimLines = (claim: Claim): string[] => [
  claim.text,
  ...(claim.views ?? []).map((v) => `${v.holder}: ${v.text}`),
];

/**
 * Story Mode reads the Part's own sections in the spec's order (§9.3) rather than improvising
 * new narration: recitation → translation → context → explanation → insights → takeaways →
 * misunderstandings → reflection.
 */
export function buildStory(part: JourneyPart, verses: RawVerse[]): StorySegment[] {
  const segments: StorySegment[] = [];
  for (const v of verses)
    segments.push({
      phase: "Recitation",
      arabic: v.arabic,
      ...(v.bismillah ? { bismillah: v.bismillah } : {}),
      surah: v.surah,
      ayah: v.ayah,
      lines: [],
    });
  for (const v of verses)
    // Footnote markers are dropped in read-along only; the reading view shows the notes in full.
    segments.push({ phase: "Translation", surah: v.surah, ayah: v.ayah, lines: [v.translation.replace(/\[\d+\]/g, "")] });

  const add = (phase: string, claim: Claim) => segments.push({ phase, category: claim.category, lines: claimLines(claim) });
  if (part.connectionToPrevious) add("Context", part.connectionToPrevious);
  part.context.forEach((c) => add("Context", c));
  add("Explanation", part.summary);
  part.tafsirInsights.forEach((c) => add("Explanation", c));
  part.keyInsights.forEach((c) => add("Key insights", c));
  segments.push({ phase: "Takeaways", category: "editorial_synthesis", lines: part.takeaways.map((t) => t.text) });
  part.commonMisunderstandings.forEach((m) =>
    segments.push({
      phase: "Misunderstandings",
      category: m.clarification.category,
      lines: [`A common misreading: ${m.misreading}`, m.clarification.text],
    }),
  );
  segments.push({ phase: "Reflection", category: "reflection", lines: part.reflectionQuestions });
  return segments;
}
