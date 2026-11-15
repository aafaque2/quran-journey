import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  Journey,
  JourneyPart,
  WorksFile,
  type RawManifest,
  type RawVerse,
  type ScriptText,
  type SurahInfo,
  type TranslationText,
  type Work,
} from "@quran-journey/schema";
import { contentDir } from "./paths";
import {
  findDataset,
  parseQuranEncSura,
  parseTanzilMetadataXml,
  parseTanzilQuranXml,
  readManifest,
  verifyRawIntegrity,
} from "./raw";

export interface LoadedContent {
  dir: string;
  manifest: RawManifest;
  journey: Journey;
  works: Map<string, Work>;
  /** Sorted by partNumber. */
  parts: JourneyPart[];
  partFiles: Map<string, string>;
  surahs: Map<number, SurahInfo>;
  rukuStarts: Set<string>;
  /** Raw-layer integrity problems (non-empty means the raw layer was modified). */
  integrity: string[];
  verse(surah: number, ayah: number): RawVerse | undefined;
  verses(surah: number, from: number, to: number): RawVerse[];
  /** Whether a raw text dataset (a script or a translation) has this verse. */
  coverage(datasetId: string, surah: number, ayah: number): boolean;
}

export class ContentError extends Error {
  constructor(
    message: string,
    readonly problems: string[],
  ) {
    super(`${message}\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ContentError";
  }
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8"));
}

function parseOrCollect<T>(schema: z.ZodType<T>, data: unknown, label: string, problems: string[]): T | undefined {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  problems.push(`${label}:\n${z.prettifyError(result.error).replace(/^/gm, "      ")}`);
  return undefined;
}

/** Parses a single Part file (schema only). Used by the validator CLI for files outside content/. */
export function parsePartFile(file: string): { part?: JourneyPart; problems: string[] } {
  const problems: string[] = [];
  const part = parseOrCollect(JourneyPart, readJson(file), path.basename(file), problems);
  return part ? { part, problems } : { problems };
}

/**
 * Loads and schema-validates everything under content/, joining Parts with the raw layer.
 * Throws ContentError on any schema failure. Cross-file rules live in validate.ts.
 */
export function loadContent(dir: string = contentDir()): LoadedContent {
  const problems: string[] = [];
  const rawDir = path.join(/*turbopackIgnore: true*/ dir, "raw");
  const manifest = readManifest(rawDir);
  const integrity = verifyRawIntegrity(rawDir, manifest);

  const journey = parseOrCollect(Journey, readJson(path.join(/*turbopackIgnore: true*/ dir, "journey.json")), "journey.json", problems);
  const worksFile = parseOrCollect(WorksFile, readJson(path.join(/*turbopackIgnore: true*/ dir, "works.json")), "works.json", problems);

  const parts: JourneyPart[] = [];
  const partFiles = new Map<string, string>();
  const partsDir = path.join(/*turbopackIgnore: true*/ dir, "parts");
  for (const name of fs.readdirSync(/*turbopackIgnore: true*/ partsDir).filter((f) => f.endsWith(".json")).sort()) {
    const file = path.join(/*turbopackIgnore: true*/ partsDir, name);
    const part = parseOrCollect(JourneyPart, readJson(file), `parts/${name}`, problems);
    if (part) {
      parts.push(part);
      partFiles.set(part.id, file);
    }
  }
  if (problems.length || !journey || !worksFile) throw new ContentError("Content failed schema validation:", problems);

  // Every dataset journey.json offers must have been fetched (`pnpm raw:fetch`).
  const offered = [journey.quranMetadataDataset, ...journey.scripts.map((s) => s.dataset), ...journey.translations.map((t) => t.dataset)];
  const missing = offered.filter((id) => !manifest.datasets.some((d) => d.id === id));
  if (missing.length)
    throw new ContentError("journey.json offers raw datasets that are not in content/raw/manifest.json (run `pnpm raw:fetch`):", missing);

  // Raw layer: Arabic scripts (Tanzil), structure (Tanzil metadata), translations (QuranEnc).
  const read = (datasetId: string) =>
    findDataset(manifest, datasetId).files.map((f) => ({ path: f.path, text: fs.readFileSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ rawDir, f.path), "utf8") }));

  const { surahs, rukuStarts } = parseTanzilMetadataXml(read(journey.quranMetadataDataset)[0]?.text ?? "");
  const scriptTexts = new Map<string, Map<string, ScriptText>>();
  for (const s of journey.scripts) scriptTexts.set(s.dataset, parseTanzilQuranXml(read(s.dataset)[0]?.text ?? ""));
  const translationTexts = new Map<string, Map<string, TranslationText>>();
  for (const t of journey.translations) {
    const texts = new Map<string, TranslationText>();
    for (const f of read(t.dataset))
      for (const [k, v] of parseQuranEncSura(f.text)) texts.set(k, v.footnotes ? { text: v.translation, footnotes: v.footnotes } : { text: v.translation });
    translationTexts.set(t.dataset, texts);
  }
  const defaultScript = journey.scripts[0]?.dataset ?? "";
  const defaultTranslation = journey.translations[0]?.dataset ?? "";

  const verse = (surah: number, ayah: number): RawVerse | undefined => {
    const key = `${surah}:${ayah}`;
    const scripts: Record<string, ScriptText> = {};
    for (const [id, texts] of scriptTexts) {
      const v = texts.get(key);
      if (v) scripts[id] = v;
    }
    const translations: Record<string, TranslationText> = {};
    for (const [id, texts] of translationTexts) {
      const v = texts.get(key);
      if (v) translations[id] = v;
    }
    const ar = scripts[defaultScript];
    const tr = translations[defaultTranslation];
    if (!ar || !tr) return undefined;
    return {
      surah,
      ayah,
      key,
      arabic: ar.text,
      ...(ar.bismillah ? { bismillah: ar.bismillah } : {}),
      translation: tr.text,
      ...(tr.footnotes ? { footnotes: tr.footnotes } : {}),
      scripts,
      translations,
    };
  };

  return {
    dir,
    manifest,
    journey,
    works: new Map(worksFile.works.map((w) => [w.id, w])),
    parts: parts.sort((a, b) => a.partNumber - b.partNumber),
    partFiles,
    surahs,
    rukuStarts,
    integrity,
    verse,
    coverage(datasetId, surah, ayah) {
      const key = `${surah}:${ayah}`;
      return Boolean(scriptTexts.get(datasetId)?.has(key) || translationTexts.get(datasetId)?.has(key));
    },
    verses(surah, from, to) {
      const out: RawVerse[] = [];
      for (let a = from; a <= to; a++) {
        const v = verse(surah, a);
        if (v) out.push(v);
      }
      return out;
    },
  };
}
