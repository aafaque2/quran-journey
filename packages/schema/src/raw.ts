import { z } from "zod";

/** A downloaded source file, stored byte-for-byte. Layer: raw. Internal. */
export const RawFile = z.object({
  /** Relative to content/raw. */
  path: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
  sourceUrl: z.url(),
  retrievedAt: z.iso.datetime(),
});
export type RawFile = z.infer<typeof RawFile>;

/**
 * Provenance + license for one raw dataset (product spec §6.3: licensing is first-class).
 * Layer: raw. User-visible as attribution.
 */
export const RawDataset = z.object({
  /** Lowercase kebab-case: it is also used as a CSS attribute value and a preference key. */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  kind: z.enum(["quran_text", "quran_metadata", "translation"]),
  name: z.string().min(1),
  publisher: z.string().min(1),
  version: z.string().optional(),
  /** BCP 47 language of the text, as the source declares it ("ar", "en", "ur"…). Raw; drives lang/font. */
  language: z.string().min(2).optional(),
  /** Writing direction of the text. Raw; drives dir. */
  direction: z.enum(["ltr", "rtl"]).optional(),
  /** License terms as we understand them. */
  license: z.string().min(1),
  /** Attribution line shown in the app. User-visible. */
  attribution: z.string().min(1),
  attributionUrl: z.url(),
  files: z.array(RawFile).min(1),
});
export type RawDataset = z.infer<typeof RawDataset>;

/** content/raw/manifest.json — written only by `pnpm raw:fetch`. */
export const RawManifest = z.object({
  schemaVersion: z.literal(1),
  datasets: z.array(RawDataset),
});
export type RawManifest = z.infer<typeof RawManifest>;

/** One verse in one Arabic script, verbatim from Tanzil. Layer: raw. User-visible. */
export interface ScriptText {
  text: string;
  /** Basmala preceding ayah 1 (all surahs except 1 and 9). */
  bismillah?: string;
}

/** One verse in one translation, verbatim (including [n] footnote markers). Layer: raw. User-visible. */
export interface TranslationText {
  text: string;
  /** Translator footnotes, verbatim. */
  footnotes?: string;
}

/** A verse as the app sees it after joining raw datasets. Layer: raw (verbatim). User-visible. */
export interface RawVerse {
  surah: number;
  ayah: number;
  key: string;
  /** Arabic in the journey's default script (the first in journey.json). */
  arabic: string;
  /** Basmala in the default script, before ayah 1 of every surah except 1 and 9. */
  bismillah?: string;
  /** The journey's default translation (the first in journey.json), verbatim. */
  translation: string;
  /** Footnotes of the default translation, verbatim. */
  footnotes?: string;
  /** Every script readers can choose, keyed by raw dataset id (the default included). */
  scripts: Record<string, ScriptText>;
  /** Every translation readers can choose, keyed by raw dataset id (the default included). */
  translations: Record<string, TranslationText>;
}

/** Surah-level structural metadata, verbatim from Tanzil's quran-data.xml. Layer: raw. User-visible. */
export interface SurahInfo {
  index: number;
  ayahs: number;
  name: string;
  tname: string;
  ename: string;
  type: string;
  order: number;
  rukus: number;
}
