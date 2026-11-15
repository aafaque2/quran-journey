/**
 * Raw-layer ingestion: `pnpm raw:fetch [--suras=1,2] [--force]`
 *
 * Downloads source files VERBATIM (byte-for-byte, license notices intact) and records provenance,
 * license and sha256 in content/raw/manifest.json. It never edits text. The editorial pipeline never
 * writes to content/raw, and the validator fails if any raw file's hash changes (AGENTS.md rule 1).
 *
 * Which of these datasets readers can actually choose is an editorial decision made in
 * content/journey.json; this file only knows how to fetch them.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { RawManifest, type RawDataset, type RawFile } from "@quran-journey/schema";
import { contentDir, parseTanzilMetadataXml, parseTanzilQuranXml, sha256 } from "@quran-journey/content";

const { values } = parseArgs({
  options: {
    suras: { type: "string", default: "1,2" },
    force: { type: "boolean", default: false },
  },
});
const suras = (values.suras ?? "1,2").split(",").map((s) => Number(s.trim())).filter((n) => n >= 1 && n <= 114);
const force = values.force ?? false;

const rawDir = path.join(contentDir(), "raw");
const manifestPath = path.join(rawDir, "manifest.json");
const manifest: RawManifest = fs.existsSync(manifestPath)
  ? RawManifest.parse(JSON.parse(fs.readFileSync(manifestPath, "utf8")))
  : { schemaVersion: 1, datasets: [] };

/** Tanzil text types we can ingest (https://tanzil.net/download). Same license for every type. */
const QURAN_TEXTS = [
  { id: "tanzil-uthmani", quranType: "uthmani", label: "Uthmani", file: "tanzil/quran-uthmani.xml" },
  { id: "tanzil-simple", quranType: "simple", label: "Simple", file: "tanzil/quran-simple.xml" },
] as const;

/**
 * QuranEnc translations we can ingest. `credit` names the translator/publisher as QuranEnc describes
 * them (their terms require crediting the publisher, QuranEnc and the version).
 */
const TRANSLATIONS = [
  { id: "quranenc-english-saheeh", key: "english_saheeh", language: "en", name: "Saheeh International (English)", credit: "Saheeh International (Noor International Center)" },
  { id: "quranenc-english-rwwad", key: "english_rwwad", language: "en", name: "Rowwad Translation Center (English)", credit: "Rowwad Translation Center" },
  { id: "quranenc-urdu-junagarhi", key: "urdu_junagarhi", language: "ur", name: "Muhammad Junagarhi (Urdu)", credit: "Muhammad Ibrahim Junagarhi, developed under the supervision of the Rowwad Translation Center" },
  { id: "quranenc-hindi-omari", key: "hindi_omari", language: "hi", name: "Azizul Haq al-Omari (Hindi)", credit: "Azizul Haq al-Omari" },
] as const;

const QURANENC_LICENSE =
  "QuranEnc.com republishing terms: no modification, addition or deletion; clearly credit the publisher and the source (QuranEnc.com) and mention the version number; keep the translation updated to the latest version; notify QuranEnc of any notes on the translation; no inappropriate advertisements alongside it. Commercial use is not addressed by these terms.";

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": "quran-journey-raw-fetch/0.1" } });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Downloads one file unless it already exists (and --force is off). Returns its manifest entry. */
async function fetchFile(
  datasetId: string,
  relPath: string,
  url: string,
  check: (body: Buffer) => void,
): Promise<RawFile> {
  const abs = path.join(rawDir, relPath);
  const known = manifest.datasets.find((d) => d.id === datasetId)?.files.find((f) => f.path === relPath);
  if (known && fs.existsSync(abs) && !force) {
    console.log(`  keep  ${relPath}`);
    return known;
  }
  const body = await download(url);
  check(body);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  console.log(`  fetch ${relPath} (${body.length.toLocaleString()} bytes)`);
  return { path: relPath, sha256: sha256(body), bytes: body.length, sourceUrl: url, retrievedAt: new Date().toISOString() };
}

function upsert(dataset: RawDataset) {
  const i = manifest.datasets.findIndex((d) => d.id === dataset.id);
  if (i === -1) manifest.datasets.push(dataset);
  else manifest.datasets[i] = dataset;
}

function mergeFiles(datasetId: string, fresh: RawFile[]): RawFile[] {
  const old = manifest.datasets.find((d) => d.id === datasetId)?.files ?? [];
  const byPath = new Map(old.map((f) => [f.path, f]));
  fresh.forEach((f) => byPath.set(f.path, f));
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

interface QuranEncListing {
  key: string;
  version: string;
  title: string;
  description: string;
  direction?: string;
  language_iso_code?: string;
}

async function main() {
  console.log(`Raw layer → ${rawDir}${force ? " (forced re-download)" : ""}`);

  // 1. Qur'an text: Tanzil (with pause marks and sajdah signs). The XML keeps the basmala separate from each surah's first verse.
  for (const t of QURAN_TEXTS) {
    const url = `https://tanzil.net/pub/download/index.php?quranType=${t.quranType}&outType=xml&marks=true&sajdah=true&agree=true`;
    let version = manifest.datasets.find((d) => d.id === t.id)?.version;
    const file = await fetchFile(t.id, t.file, url, (body) => {
      const xml = body.toString("utf8");
      const count = parseTanzilQuranXml(xml).size;
      if (count !== 6236) throw new Error(`Tanzil ${t.label} text has ${count} verses, expected 6236`);
      if (!xml.includes("Tanzil Project")) throw new Error("Tanzil copyright notice missing; refusing to store the text");
      version = xml.match(new RegExp(`Tanzil Quran Text \\(${t.label}, Version ([\\d.]+)\\)`))?.[1] ?? version;
    });
    upsert({
      id: t.id,
      kind: "quran_text",
      name: `Tanzil Quran Text (${t.label})`,
      publisher: "Tanzil Project",
      ...(version ? { version } : {}),
      language: "ar",
      direction: "rtl",
      license:
        "Creative Commons Attribution 3.0. Verbatim copies only: changing the text is not allowed. The source (Tanzil Project) must be clearly indicated with a link to tanzil.net, and the copyright notice kept with the text (it is retained inside the stored file).",
      attribution: `Qur'an text: Tanzil Project, ${t.label} text${version ? ` v${version}` : ""}`,
      attributionUrl: "https://tanzil.net",
      files: mergeFiles(t.id, [file]),
    });
  }

  // 2. Structural metadata: surah names, ayah counts, ruku starts (Tanzil).
  const metaUrl = "https://tanzil.net/res/text/metadata/quran-data.xml";
  const metaFile = await fetchFile("tanzil-metadata", "tanzil/quran-data.xml", metaUrl, (body) => {
    const { surahs } = parseTanzilMetadataXml(body.toString("utf8"));
    if (surahs.size !== 114) throw new Error(`Tanzil metadata lists ${surahs.size} surahs, expected 114`);
  });
  upsert({
    id: "tanzil-metadata",
    kind: "quran_metadata",
    name: "Tanzil Quran Metadata",
    publisher: "Tanzil Project",
    license: "Tanzil metadata (license declared inside the stored file). Credit Tanzil Project with a link to tanzil.net.",
    attribution: "Qur'an structure metadata: Tanzil Project",
    attributionUrl: "https://tanzil.net",
    files: mergeFiles("tanzil-metadata", [metaFile]),
  });

  // 3. Translations of the meaning, via QuranEnc (verbatim, footnotes included).
  const ayahCounts = parseTanzilMetadataXml(fs.readFileSync(path.join(rawDir, "tanzil/quran-data.xml"), "utf8")).surahs;
  const listings = new Map<string, QuranEncListing>();
  const listing = async (key: string, language: string) => {
    if (!listings.has(key)) {
      const list = JSON.parse((await download(`https://quranenc.com/api/v1/translations/list/${language}`)).toString("utf8")) as {
        translations: QuranEncListing[];
      };
      list.translations.forEach((t) => listings.set(t.key, t));
    }
    return listings.get(key);
  };

  for (const t of TRANSLATIONS) {
    const meta = await listing(t.key, t.language);
    if (!meta) throw new Error(`QuranEnc no longer lists ${t.key}`);
    const previous = manifest.datasets.find((d) => d.id === t.id);
    if (previous?.version && previous.version !== meta.version && !force)
      console.warn(
        `  ! QuranEnc ${t.key} is now v${meta.version} (stored: v${previous.version}). ` +
          "Their terms ask you to keep it updated: re-run with --force so every file moves to the same version.",
      );
    const files: RawFile[] = [];
    for (const n of suras) {
      const rel = `quranenc/${t.key}/${String(n).padStart(3, "0")}.json`;
      files.push(
        await fetchFile(t.id, rel, `https://quranenc.com/api/v1/translation/sura/${t.key}/${n}`, (body) => {
          const rows = (JSON.parse(body.toString("utf8")) as { result?: unknown[] }).result?.length ?? 0;
          const expected = ayahCounts.get(n)?.ayahs;
          if (rows !== expected) throw new Error(`QuranEnc ${t.key} sura ${n}: ${rows} verses, expected ${expected}`);
        }),
      );
    }
    const version = force || !previous?.version ? meta.version : previous.version;
    upsert({
      id: t.id,
      kind: "translation",
      name: t.name,
      publisher: `${t.credit}, via QuranEnc.com`,
      version,
      language: meta.language_iso_code ?? t.language,
      direction: meta.direction === "rtl" ? "rtl" : "ltr",
      license: QURANENC_LICENSE,
      attribution: `Translation of the meaning: ${t.credit}, via QuranEnc.com, v${version}`,
      attributionUrl: `https://quranenc.com/en/browse/${t.key}`,
      files: mergeFiles(t.id, files),
    });
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(RawManifest.parse(manifest), null, 2)}\n`);
  console.log(`Done. Manifest: ${path.relative(process.cwd(), manifestPath)}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
