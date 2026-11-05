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
  id: z.string().min(1),
  kind: z.enum(["quran_text", "quran_metadata", "translation"]),
  name: z.string().min(1),
  publisher: z.string().min(1),
  version: z.string().optional(),
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

/** A verse as the app sees it after joining raw datasets. Layer: raw (verbatim). User-visible. */
export interface RawVerse {
  surah: number;
  ayah: number;
  key: string;
  /** Uthmani Arabic, verbatim from Tanzil. Raw; user-visible. */
  arabic: string;
  /** Basmala preceding ayah 1 (all surahs except 1 and 9), verbatim from Tanzil. Raw; user-visible. */
  bismillah?: string;
  /** Translation of the meaning, verbatim (including [n] footnote markers). Raw; user-visible. */
  translation: string;
  /** Translator footnotes, verbatim. Raw; user-visible. */
  footnotes?: string;
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
