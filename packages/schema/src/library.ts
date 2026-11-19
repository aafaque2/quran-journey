import { z } from "zod";

/**
 * A work that editorial content cites (tafsir, hadith collection, translation…).
 * Layer: editorial (bibliography). User-visible on the sources list.
 */
export const Work = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /** "structure": a traditional division of the text (e.g. rukus), cited as the basis of a Part boundary. */
  kind: z.enum(["quran", "tafsir", "hadith_collection", "translation", "scholarship", "structure"]),
  title: z.string().min(1),
  /** Short name for source chips, e.g. "Ibn Kathir". User-visible. */
  shortTitle: z.string().min(1).optional(),
  /** Title in the original language. User-visible. */
  titleOriginal: z.string().optional(),
  author: z.string().optional(),
  /** e.g. "774 AH / 1373 CE". User-visible. */
  authorDied: z.string().optional(),
  /**
   * One neutral line on the work's approach, shown where readers choose whose explanations
   * come first. Editorial; user-visible.
   */
  description: z.string().min(10).max(220).optional(),
  /** Language of the edition actually consulted. */
  language: z.string().min(2),
  /**
   * public_domain: may be excerpted verbatim. copyrighted: cite and summarize only, no excerpts.
   * open_license: per rightsNote.
   */
  rights: z.enum(["public_domain", "open_license", "copyrighted"]),
  /** Why we believe that, and what it allows. User-visible on the sources page. */
  rightsNote: z.string().min(1),
  /** How the text was consulted, e.g. "quran.com API v4, resource 14". Internal. */
  accessedVia: z.string().optional(),
  url: z.url().optional(),
});
export type Work = z.infer<typeof Work>;

export const WorksFile = z.object({
  schemaVersion: z.literal(1),
  works: z.array(Work).min(1),
});

/**
 * An Arabic script readers can choose. Points at a raw quran_text dataset.
 * Layer: editorial (which scripts we offer, and how we describe them). User-visible.
 */
export const ScriptOption = z.object({
  /** Raw dataset id (content/raw/manifest.json), kind quran_text. */
  dataset: z.string().min(1),
  /** Short name in pickers, e.g. "Uthmani". */
  label: z.string().min(1).max(40),
  /** One line on what distinguishes this script. */
  description: z.string().min(10).max(200),
});
export type ScriptOption = z.infer<typeof ScriptOption>;

/**
 * A translation of the meaning readers can choose. Points at a raw translation dataset.
 * Layer: editorial (which translations we offer, and how we name them). User-visible.
 */
export const TranslationOption = z.object({
  /** Raw dataset id (content/raw/manifest.json), kind translation. */
  dataset: z.string().min(1),
  /** Name in pickers and above the text, e.g. "Saheeh International". */
  label: z.string().min(1).max(60),
  /** Language name in English, e.g. "Urdu". */
  languageName: z.string().min(1).max(30),
  /** One line on the translation, e.g. who produced it. */
  description: z.string().min(10).max(200),
});
export type TranslationOption = z.infer<typeof TranslationOption>;

/**
 * The journey definition: which Parts, in which order, over which raw datasets.
 * Layer: editorial. User-visible (title, scope, the script and translation choices).
 */
export const Journey = z
  .object({
    schemaVersion: z.literal(2),
    title: z.string().min(1),
    scope: z.string().min(1),
    /** Raw dataset id for surah names, ayah counts and rukus. */
    quranMetadataDataset: z.string().min(1),
    /** Arabic scripts readers can choose. The first is the default. */
    scripts: z.array(ScriptOption).min(1),
    /** Translations readers can choose. The first is the default. */
    translations: z.array(TranslationOption).min(1),
    /** Ordered Part ids. */
    parts: z.array(z.string().regex(/^part-\d{4}$/)).min(1),
  })
  .superRefine((j, ctx) => {
    const ids = [...j.scripts.map((s) => s.dataset), ...j.translations.map((t) => t.dataset)];
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length)
      ctx.addIssue({ code: "custom", path: ["translations"], message: `datasets listed twice: ${[...new Set(dupes)].join(", ")}` });
  });
export type Journey = z.infer<typeof Journey>;
