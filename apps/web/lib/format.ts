import type { ContentCategory, PartStatus, ReportCategory } from "@quran-journey/schema";

/** How each claim category is presented to readers (AGENTS.md rule 3). */
export const CATEGORY: Record<ContentCategory, { label: string; description: string }> = {
  established: {
    label: "The Qur'an states",
    description: "What the Qur'an itself clearly says, cited by verse.",
  },
  scholarly_interpretation: {
    label: "Scholarly explanation",
    description: "How a named tafsir or scholar explains the passage, with the exact source.",
  },
  scholarly_disagreement: {
    label: "Scholars differ",
    description: "Recognized scholars hold different views. Each view is shown with who holds it; none is flattened.",
  },
  editorial_synthesis: {
    label: "Our summary",
    description: "Our own plain-language summary of the cited sources. It is not tafsir in itself.",
  },
  reflection: {
    label: "Reflection",
    description: "A personal prompt to think about. Not tafsir, and not a ruling.",
  },
};

export const STATUS_LABEL: Record<PartStatus, string> = {
  DRAFT: "Draft",
  AI_GENERATED: "AI-assisted draft · not yet reviewed",
  SOURCE_CHECKED: "Sources checked · review in progress",
  EDITOR_REVIEW: "In editorial review",
  SCHOLAR_REVIEW: "With a scholar for review",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  NEEDS_REVISION: "Needs revision",
};

export const REPORT_LABEL: Record<ReportCategory, string> = {
  quran_text: "Qur'an text",
  translation: "Translation",
  tafsir_attribution: "Tafsir attribution",
  tafsir_interpretation: "Tafsir interpretation",
  historical_context: "Historical / contextual info",
  hadith: "Hadith",
  missing_source: "Missing source",
  verse_range: "Verse range",
  typo: "Typo",
  other: "Other",
};

/** Display names (editorial choice); Tanzil's transliteration is the fallback. */
const SURAH_NAMES: Record<number, string> = { 1: "Al-Fatihah", 2: "Al-Baqarah" };

export function surahName(surah: number, fallback?: string): string {
  return SURAH_NAMES[surah] ?? fallback ?? `Surah ${surah}`;
}

export function verseRange(surah: number, from: number, to: number): string {
  return from === to ? `${surah}:${from}` : `${surah}:${from}–${to}`;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function arabicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)] ?? d);
}

/** Splits translation text into plain runs and [n] footnote markers (the text itself is never altered). */
export function splitFootnoteMarkers(text: string): Array<{ text: string } | { marker: string }> {
  return text
    .split(/(\[\d+\])/)
    .filter(Boolean)
    .map((piece) => {
      const m = piece.match(/^\[(\d+)\]$/);
      return m?.[1] ? { marker: m[1] } : { text: piece };
    });
}

/** Parses QuranEnc footnotes ("[2] text\n[3] text") into numbered notes. */
export function parseFootnotes(footnotes: string | undefined): Array<{ marker: string; text: string }> {
  if (!footnotes) return [];
  return [...footnotes.matchAll(/\[(\d+)\]\s*([\s\S]*?)(?=\n?\[\d+\]|$)/g)].map((m) => ({
    marker: m[1] ?? "",
    text: (m[2] ?? "").trim(),
  }));
}
