import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { RawManifest, type RawDataset, type SurahInfo } from "@quran-journey/schema";

// Raw layer: read-only parsing of files downloaded verbatim by `pnpm raw:fetch`.
// Nothing in this module (or anywhere in the editorial pipeline) writes to content/raw.

export function sha256(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function readManifest(rawDir: string): RawManifest {
  const file = path.join(/*turbopackIgnore: true*/ rawDir, "manifest.json");
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) throw new Error(`Missing ${file}. Run \`pnpm raw:fetch\` first.`);
  return RawManifest.parse(JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")));
}

export function findDataset(manifest: RawManifest, id: string): RawDataset {
  const ds = manifest.datasets.find((d) => d.id === id);
  if (!ds) throw new Error(`Raw dataset "${id}" is not in content/raw/manifest.json. Run \`pnpm raw:fetch\`.`);
  return ds;
}

/** Re-hashes every raw file. Any difference means someone edited the raw layer (AGENTS.md rule 1). */
export function verifyRawIntegrity(rawDir: string, manifest: RawManifest): string[] {
  const problems: string[] = [];
  for (const ds of manifest.datasets) {
    for (const f of ds.files) {
      const abs = path.join(/*turbopackIgnore: true*/ rawDir, f.path);
      if (!fs.existsSync(/*turbopackIgnore: true*/ abs)) {
        problems.push(`${ds.id}: missing raw file ${f.path}`);
        continue;
      }
      const actual = sha256(fs.readFileSync(/*turbopackIgnore: true*/ abs));
      if (actual !== f.sha256)
        problems.push(
          `${ds.id}: ${f.path} has changed since it was fetched (sha256 ${actual.slice(0, 12)}… ≠ ${f.sha256.slice(0, 12)}…). ` +
            "Raw files are never edited by hand or by scripts; re-run `pnpm raw:fetch --force` only if the upstream source was intentionally updated.",
        );
    }
  }
  return problems;
}

const XML_ENTITIES: Record<string, string> = { quot: '"', apos: "'", lt: "<", gt: ">", amp: "&" };

function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|quot|apos|lt|gt|amp);/gi, (m, ent: string) => {
    if (ent.startsWith("#x") || ent.startsWith("#X")) return String.fromCodePoint(parseInt(ent.slice(2), 16));
    if (ent.startsWith("#")) return String.fromCodePoint(parseInt(ent.slice(1), 10));
    return XML_ENTITIES[ent.toLowerCase()] ?? m;
  });
}

function attributes(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, key, value] of source.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    if (key && value !== undefined) out[key] = decodeXml(value);
  }
  return out;
}

/** Tanzil quran-*.xml: <sura index> … <aya index text [bismillah]/>. Returns "s:a" → verbatim text. */
export function parseTanzilQuranXml(xml: string): Map<string, { text: string; bismillah?: string }> {
  const verses = new Map<string, { text: string; bismillah?: string }>();
  for (const [, suraIndex, body] of xml.matchAll(/<sura\s+index="(\d+)"[^>]*>([\s\S]*?)<\/sura>/g)) {
    for (const [, attrs] of (body ?? "").matchAll(/<aya\s+([^>]*?)\/>/g)) {
      const a = attributes(attrs ?? "");
      if (!a.index || a.text === undefined) continue;
      verses.set(`${suraIndex}:${a.index}`, a.bismillah ? { text: a.text, bismillah: a.bismillah } : { text: a.text });
    }
  }
  return verses;
}

/** Tanzil quran-data.xml: surah metadata and ruku starts. */
export function parseTanzilMetadataXml(xml: string): { surahs: Map<number, SurahInfo>; rukuStarts: Set<string> } {
  const surahs = new Map<number, SurahInfo>();
  const suraBlock = xml.match(/<suras[^>]*>([\s\S]*?)<\/suras>/)?.[1] ?? "";
  for (const [, attrs] of suraBlock.matchAll(/<sura\s+([^>]*?)\/>/g)) {
    const a = attributes(attrs ?? "");
    const index = Number(a.index);
    surahs.set(index, {
      index,
      ayahs: Number(a.ayas),
      name: a.name ?? "",
      tname: a.tname ?? "",
      ename: a.ename ?? "",
      type: a.type ?? "",
      order: Number(a.order),
      rukus: Number(a.rukus),
    });
  }
  const rukuStarts = new Set<string>();
  const rukuBlock = xml.match(/<rukus[^>]*>([\s\S]*?)<\/rukus>/)?.[1] ?? "";
  for (const [, attrs] of rukuBlock.matchAll(/<ruku\s+([^>]*?)\/>/g)) {
    const a = attributes(attrs ?? "");
    rukuStarts.add(`${a.sura}:${a.aya}`);
  }
  return { surahs, rukuStarts };
}

/** QuranEnc /translation/sura/{key}/{n} response. Returns "s:a" → verbatim translation + footnotes. */
export function parseQuranEncSura(json: string): Map<string, { translation: string; footnotes?: string }> {
  const data = JSON.parse(json) as { result?: Array<{ sura: string; aya: string; translation: string; footnotes?: string }> };
  const out = new Map<string, { translation: string; footnotes?: string }>();
  for (const row of data.result ?? []) {
    out.set(
      `${Number(row.sura)}:${Number(row.aya)}`,
      row.footnotes ? { translation: row.translation, footnotes: row.footnotes } : { translation: row.translation },
    );
  }
  return out;
}
