import { allClaims, type Citation, type JourneyPart } from "@quran-journey/schema";
import type { LoadedContent } from "./load";

export interface Issue {
  level: "error" | "warning";
  where: string;
  message: string;
}

/** Parses "2:8" or "2:8-20" into a range. */
export function parseVerseLocator(locator: string): { surah: number; from: number; to: number } | null {
  const m = locator.trim().match(/^(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/);
  if (!m) return null;
  const surah = Number(m[1]);
  const from = Number(m[2]);
  const to = m[3] ? Number(m[3]) : from;
  return to >= from ? { surah, from, to } : null;
}

function citationsOf(part: JourneyPart): { where: string; c: Citation }[] {
  const out: { where: string; c: Citation }[] = [];
  for (const claim of allClaims(part)) {
    claim.sources.forEach((c) => out.push({ where: `${part.id}#${claim.id}`, c }));
    claim.views?.forEach((v, i) => v.sources.forEach((c) => out.push({ where: `${part.id}#${claim.id}/view-${i + 1}`, c })));
  }
  for (const m of part.commonMisunderstandings) m.addressedBy.forEach((c) => out.push({ where: `${part.id}#${m.id}/addressedBy`, c }));
  part.segmentationRationale.sources.forEach((c) => out.push({ where: `${part.id}#segmentation`, c }));
  return out;
}

/** Rough reading time: ~200 wpm for English, plus time to read the Arabic. */
export function estimateMinutes(part: JourneyPart, content: LoadedContent): number {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  let english = 0;
  for (const claim of allClaims(part)) {
    english += words(claim.text);
    claim.views?.forEach((v) => (english += words(v.text)));
  }
  part.reflectionQuestions.forEach((q) => (english += words(q)));
  const verses = content.verses(part.surah, part.startAyah, part.endAyah);
  verses.forEach((v) => (english += words(v.translation)));
  const arabicWords = verses.reduce((n, v) => n + words(v.arabic), 0);
  return Math.max(1, Math.round(english / 200 + arabicWords / 60));
}

/** Cross-file rules that a single-file schema can't express. */
export function validateContent(content: LoadedContent): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ level: "error", where, message });
  const warn = (where: string, message: string) => issues.push({ level: "warning", where, message });

  content.integrity.forEach((p) => err("raw", p));

  // The scripts and translations journey.json offers must be raw datasets of the right kind.
  const offered: Array<{ id: string; kind: "quran_text" | "translation" }> = [
    ...content.journey.scripts.map((s) => ({ id: s.dataset, kind: "quran_text" as const })),
    ...content.journey.translations.map((t) => ({ id: t.dataset, kind: "translation" as const })),
  ];
  for (const { id, kind } of offered) {
    const ds = content.manifest.datasets.find((d) => d.id === id);
    if (ds && ds.kind !== kind) err("journey.json", `dataset "${id}" is a ${ds.kind}, but it is offered as a ${kind}`);
  }

  // Journey ↔ Part files.
  const byId = new Map(content.parts.map((p) => [p.id, p]));
  content.journey.parts.forEach((id, i) => {
    const part = byId.get(id);
    if (!part) return err("journey.json", `lists ${id}, but no Part file has that id`);
    if (part.partNumber !== i + 1) err(id, `partNumber is ${part.partNumber} but it is #${i + 1} in journey.json`);
  });
  for (const p of content.parts) if (!content.journey.parts.includes(p.id)) warn(p.id, "Part file is not listed in journey.json (it will not be shown)");

  const ordered = content.journey.parts.map((id) => byId.get(id)).filter((p): p is JourneyPart => Boolean(p));
  ordered.forEach((part, i) => {
    const surah = content.surahs.get(part.surah);
    if (!surah) return err(part.id, `unknown surah ${part.surah}`);
    if (part.endAyah > surah.ayahs) err(part.id, `endAyah ${part.endAyah} exceeds ${surah.tname}'s ${surah.ayahs} verses`);

    // Raw text must exist for every verse, in every script and translation readers can choose.
    const expected = part.endAyah - part.startAyah + 1;
    const found = content.verses(part.surah, part.startAyah, part.endAyah).length;
    if (found !== expected)
      err(part.id, `raw layer has ${found}/${expected} verses for ${part.surah}:${part.startAyah}-${part.endAyah}; run \`pnpm raw:fetch --suras=${part.surah}\``);
    for (const { id } of offered) {
      const gaps: number[] = [];
      for (let a = part.startAyah; a <= Math.min(part.endAyah, surah.ayahs); a++) if (!content.coverage(id, part.surah, a)) gaps.push(a);
      if (gaps.length)
        err(part.id, `${id} has no text for ${part.surah}:${gaps.join(", ")}; run \`pnpm raw:fetch --suras=${part.surah}\` (journey.json offers it to readers)`);
    }

    // Contiguity: the journey never skips or repeats verses.
    const prev = ordered[i - 1];
    if (prev) {
      const prevSurah = content.surahs.get(prev.surah);
      const continues =
        (part.surah === prev.surah && part.startAyah === prev.endAyah + 1) ||
        (part.surah === prev.surah + 1 && part.startAyah === 1 && prevSurah !== undefined && prev.endAyah === prevSurah.ayahs);
      if (!continues)
        err(part.id, `does not continue from ${prev.id} (${prev.surah}:${prev.endAyah} → ${part.surah}:${part.startAyah}); gaps and overlaps are not allowed`);
    } else if (!(part.surah === 1 && part.startAyah === 1)) {
      warn(part.id, "the journey does not start at 1:1");
    }

    // Continuity texts.
    if (i > 0 && !part.connectionToPrevious) err(part.id, "connectionToPrevious is required for every Part after the first");
    if (i === 0 && part.connectionToPrevious) warn(part.id, "the first Part has a connectionToPrevious");
    if (!part.connectionToNext && i < ordered.length - 1) err(part.id, "connectionToNext is required when another Part follows");

    // Citations resolve, Qur'an locators are real, excerpts only from public-domain works.
    for (const { where, c } of citationsOf(part)) {
      const work = content.works.get(c.work);
      if (!work) {
        err(where, `cites unknown work "${c.work}" (add it to content/works.json)`);
        continue;
      }
      if (work.kind === "quran") {
        const r = parseVerseLocator(c.locator);
        const s = r ? content.surahs.get(r.surah) : undefined;
        if (!r || !s || r.to > s.ayahs) err(where, `invalid Qur'an locator "${c.locator}" (use "2:8" or "2:8-20")`);
      }
      if (work.kind === "structure") {
        // A ruku citation must match the raw layer: "Al-Baqarah, ruku 4 (2:21–29)" starts and ends where Tanzil's rukus do.
        const m = c.locator.match(/(\d{1,3}):(\d{1,3})(?:\s*[–-]\s*(\d{1,3}))?/);
        const s = m ? content.surahs.get(Number(m[1])) : undefined;
        if (!m || !s) err(where, `a ${work.title} citation needs a verse range, e.g. "Al-Baqarah, ruku 4 (2:21–29)"`);
        else {
          const [surahNo, from] = [Number(m[1]), Number(m[2])];
          const to = m[3] ? Number(m[3]) : undefined;
          if (!content.rukuStarts.has(`${surahNo}:${from}`)) err(where, `no ruku starts at ${surahNo}:${from} in the raw metadata`);
          if (to !== undefined && to !== s.ayahs && !content.rukuStarts.has(`${surahNo}:${to + 1}`))
            err(where, `the ruku cited as ${surahNo}:${from}–${to} does not end at ${surahNo}:${to} in the raw metadata`);
        }
      }
      if (c.excerpt && work.rights !== "public_domain")
        err(where, `verbatim excerpt from "${work.title}" (${work.rights}); excerpts are allowed only from public-domain works`);
    }

    // Interpretation must rest on scholarship, not on a translation alone.
    for (const claim of allClaims(part)) {
      if (claim.category !== "scholarly_interpretation") continue;
      const scholarly = claim.sources.some((s) => {
        const kind = content.works.get(s.work)?.kind;
        return kind === "tafsir" || kind === "hadith_collection" || kind === "scholarship";
      });
      if (!scholarly) err(`${part.id}#${claim.id}`, "scholarly_interpretation must cite a tafsir, hadith collection or scholarly work");
    }
    for (const m of part.commonMisunderstandings) {
      const ok = m.addressedBy.some((s) => {
        const kind = content.works.get(s.work)?.kind;
        return kind === "tafsir" || kind === "scholarship";
      });
      if (!ok) err(`${part.id}#${m.id}`, "a misunderstanding must be addressedBy a tafsir or scholarly work that identifies it (AGENTS.md rule 4)");
    }

    // Reading-time sanity check.
    const est = estimateMinutes(part, content);
    if (part.estimatedMinutes > est * 2.5 || part.estimatedMinutes * 2.5 < est)
      warn(part.id, `estimatedMinutes is ${part.estimatedMinutes}, but the text reads in about ${est} min`);
  });

  return issues;
}
