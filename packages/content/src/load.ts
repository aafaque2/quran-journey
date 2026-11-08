import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  Journey,
  JourneyPart,
  WorksFile,
  type RawManifest,
  type RawVerse,
  type SurahInfo,
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

  // Raw layer: Arabic (Tanzil), structure (Tanzil metadata), translation (QuranEnc).
  const read = (datasetId: string) =>
    findDataset(manifest, datasetId).files.map((f) => ({ path: f.path, text: fs.readFileSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ rawDir, f.path), "utf8") }));

  const arabic = parseTanzilQuranXml(read(journey.quranTextDataset)[0]?.text ?? "");
  const { surahs, rukuStarts } = parseTanzilMetadataXml(read(journey.quranMetadataDataset)[0]?.text ?? "");
  const translation = new Map<string, { translation: string; footnotes?: string }>();
  for (const f of read(journey.translationDataset)) for (const [k, v] of parseQuranEncSura(f.text)) translation.set(k, v);

  const verse = (surah: number, ayah: number): RawVerse | undefined => {
    const key = `${surah}:${ayah}`;
    const ar = arabic.get(key);
    const tr = translation.get(key);
    if (!ar || !tr) return undefined;
    return {
      surah,
      ayah,
      key,
      arabic: ar.text,
      ...(ar.bismillah ? { bismillah: ar.bismillah } : {}),
      translation: tr.translation,
      ...(tr.footnotes ? { footnotes: tr.footnotes } : {}),
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
