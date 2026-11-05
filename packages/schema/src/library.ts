import { z } from "zod";

/**
 * A work that editorial content cites (tafsir, hadith collection, translation…).
 * Layer: editorial (bibliography). User-visible on the sources list.
 */
export const Work = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  kind: z.enum(["quran", "tafsir", "hadith_collection", "translation", "scholarship"]),
  title: z.string().min(1),
  /** Short name for source chips, e.g. "Ibn Kathir". User-visible. */
  shortTitle: z.string().min(1).optional(),
  /** Title in the original language. User-visible. */
  titleOriginal: z.string().optional(),
  author: z.string().optional(),
  /** e.g. "774 AH / 1373 CE". User-visible. */
  authorDied: z.string().optional(),
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
 * The journey definition: which Parts, in which order, over which raw datasets.
 * Layer: editorial. User-visible (title, scope).
 */
export const Journey = z.object({
  schemaVersion: z.literal(1),
  title: z.string().min(1),
  scope: z.string().min(1),
  /** Raw dataset ids (see content/raw/manifest.json) used for display. */
  quranTextDataset: z.string().min(1),
  quranMetadataDataset: z.string().min(1),
  translationDataset: z.string().min(1),
  /** Ordered Part ids. */
  parts: z.array(z.string().regex(/^part-\d{4}$/)).min(1),
});
export type Journey = z.infer<typeof Journey>;
