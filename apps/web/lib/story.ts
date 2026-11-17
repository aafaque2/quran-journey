import type { Claim, ContentCategory, JourneyPart, RawVerse } from "@quran-journey/schema";
import type { SectionId } from "./reading-prefs";

/** One screen of Story Mode. Built on the server from the Part's own reviewed sections. */
export interface StorySegment {
  phase: string;
  /** The Part section this screen comes from: Story Mode plays only the reader's depth. */
  section: SectionId;
  category?: ContentCategory;
  /** Verbatim Arabic per script dataset id (recitation phase only). */
  arabic?: Record<string, string>;
  /** Verbatim basmala per script dataset id, shown before a surah's first verse. */
  bismillah?: Record<string, string>;
  /** Verbatim translation per dataset id (translation phase only); footnote markers are dropped. */
  translation?: Record<string, string>;
  surah?: number;
  ayah?: number;
  lines: string[];
}

const claimLines = (claim: Claim): string[] => [
  claim.text,
  ...(claim.views ?? []).map((v) => `${v.holder}: ${v.text}`),
];

function mapValues<T>(record: Record<string, T>, f: (v: T) => string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) {
    const s = f(v);
    if (s) out[k] = s;
  }
  return out;
}

/**
 * Story Mode reads the Part's own sections in the spec's order (§9.3) rather than improvising new
 * narration: recitation → translation → context → explanation → insights → takeaways →
 * misunderstandings → reflection. Each screen remembers its section so the player can follow depth.
 */
export function buildStory(part: JourneyPart, verses: RawVerse[]): StorySegment[] {
  const segments: StorySegment[] = [];
  for (const v of verses) {
    const bismillah = mapValues(v.scripts, (s) => s.bismillah);
    segments.push({
      phase: "Recitation",
      section: "verses",
      arabic: mapValues(v.scripts, (s) => s.text),
      ...(Object.keys(bismillah).length ? { bismillah } : {}),
      surah: v.surah,
      ayah: v.ayah,
      lines: [],
    });
  }
  for (const v of verses)
    // Footnote markers are dropped in read-along only; the reading view shows the notes in full.
    segments.push({
      phase: "Translation",
      section: "verses",
      translation: mapValues(v.translations, (t) => t.text.replace(/\[\d+\]/g, "")),
      surah: v.surah,
      ayah: v.ayah,
      lines: [],
    });

  const add = (phase: string, section: SectionId, claim: Claim) =>
    segments.push({ phase, section, category: claim.category, lines: claimLines(claim) });
  if (part.connectionToPrevious) add("Context", "previous", part.connectionToPrevious);
  part.context.forEach((c) => add("Context", "context", c));
  add("Explanation", "summary", part.summary);
  part.tafsirInsights.forEach((c) => add("Explanation", "scholars", c));
  part.keyInsights.forEach((c) => add("Key insights", "insights", c));
  segments.push({ phase: "Takeaways", section: "takeaways", category: "editorial_synthesis", lines: part.takeaways.map((t) => t.text) });
  part.commonMisunderstandings.forEach((m) =>
    segments.push({
      phase: "Misunderstandings",
      section: "misunderstandings",
      category: m.clarification.category,
      lines: [`A common misreading: ${m.misreading}`, m.clarification.text],
    }),
  );
  segments.push({ phase: "Reflection", section: "reflect", category: "reflection", lines: part.reflectionQuestions });
  return segments;
}
