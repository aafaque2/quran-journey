import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { JourneyPart } from "@quran-journey/schema";
import { contentDir, isVisible, loadContent, parseVerseLocator, resolveVisibility, validateContent, type LoadedContent } from "./index";

const content = loadContent();
const errors = (c: LoadedContent) => validateContent(c).filter((i) => i.level === "error");
const withPart = (id: string, change: (p: JourneyPart) => JourneyPart): LoadedContent => ({
  ...content,
  parts: content.parts.map((p) => (p.id === id ? change(structuredClone(p)) : p)),
});

describe("the shipped content", () => {
  it("passes every cross-file rule", () => {
    expect(errors(content)).toEqual([]);
  });

  it("has an intact raw layer", () => {
    expect(content.integrity).toEqual([]);
  });

  it("joins raw verses verbatim, with the basmala kept separate from 2:1", () => {
    expect(content.surahs.size).toBe(114);
    expect(content.surahs.get(2)?.ayahs).toBe(286);
    const fatihah1 = content.verse(1, 1);
    const baqarah1 = content.verse(2, 1);
    expect(fatihah1?.arabic.startsWith("بِسْمِ")).toBe(true);
    expect(fatihah1?.bismillah).toBeUndefined();
    expect(baqarah1?.arabic).toBe("الٓمٓ");
    expect(baqarah1?.bismillah?.startsWith("بِسْمِ")).toBe(true);
    expect(baqarah1?.translation).toContain("Alif");
  });

  it("offers every script and translation in journey.json, the first of each as the default", () => {
    const v = content.verse(1, 2);
    const scripts = content.journey.scripts.map((s) => s.dataset);
    const translations = content.journey.translations.map((t) => t.dataset);
    expect(Object.keys(v?.scripts ?? {}).sort()).toEqual([...scripts].sort());
    expect(Object.keys(v?.translations ?? {}).sort()).toEqual([...translations].sort());
    expect(v?.arabic).toBe(v?.scripts[scripts[0]!]?.text);
    expect(v?.translation).toBe(v?.translations[translations[0]!]?.text);
    // Uthmani and Simple spell the same verse differently, so a mix-up would show here.
    expect(v?.scripts["tanzil-uthmani"]?.text).not.toBe(v?.scripts["tanzil-simple"]?.text);
    expect(content.verse(2, 1)?.scripts["tanzil-simple"]?.bismillah?.startsWith("بِسْمِ")).toBe(true);
  });
});

describe("cross-file rules", () => {
  it("rejects a translation readers can choose that is missing verses of a Part", () => {
    const broken: LoadedContent = {
      ...content,
      coverage: (id, s, a) => (id === "quranenc-hindi-omari" && s === 2 && a === 9 ? false : content.coverage(id, s, a)),
    };
    const messages = errors(broken).map((e) => `${e.where}: ${e.message}`);
    expect(messages.some((m) => m.startsWith("part-0004: quranenc-hindi-omari has no text for 2:9"))).toBe(true);
  });

  it("rejects a dataset offered as the wrong kind", () => {
    const broken: LoadedContent = {
      ...content,
      journey: { ...content.journey, scripts: [...content.journey.scripts, { dataset: "quranenc-english-rwwad", label: "Oops", description: "A translation offered as a script." }] },
    };
    expect(errors(broken).some((e) => e.message.includes("is a translation, but it is offered as a quran_text"))).toBe(true);
  });

  it("rejects gaps between Parts", () => {
    const broken = withPart("part-0003", (p) => ({ ...p, startAyah: 7 }));
    expect(errors(broken).some((e) => e.message.includes("does not continue"))).toBe(true);
  });

  it("rejects verbatim excerpts from copyrighted works", () => {
    const broken = withPart("part-0002", (p) => {
      p.tafsirInsights[0]!.views![0]!.sources[1] = { work: "tafsir-al-sadi", locator: "on 2:1", excerpt: "نص" };
      return p;
    });
    expect(errors(broken).some((e) => e.message.includes("excerpts are allowed only from public-domain works"))).toBe(true);
  });

  it("rejects citations of unknown works and invalid verse references", () => {
    const broken = withPart("part-0001", (p) => {
      p.summary.sources = [{ work: "made-up-tafsir", locator: "on 1:1" }, { work: "quran", locator: "1:99" }];
      return p;
    });
    const messages = errors(broken).map((e) => e.message);
    expect(messages.some((m) => m.includes("unknown work"))).toBe(true);
    expect(messages.some((m) => m.includes("invalid Qur'an locator"))).toBe(true);
  });

  it("requires continuity with the previous Part", () => {
    const broken = withPart("part-0002", (p) => ({ ...p, connectionToPrevious: null }));
    expect(errors(broken).some((e) => e.message.includes("connectionToPrevious"))).toBe(true);
  });

  it("detects any edit to the raw layer", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qj-content-"));
    try {
      fs.cpSync(contentDir(), tmp, { recursive: true });
      fs.appendFileSync(path.join(tmp, "raw/quranenc/english_saheeh/001.json"), " ");
      const tampered = loadContent(tmp);
      expect(tampered.integrity.length).toBe(1);
      expect(errors(tampered).some((e) => e.where === "raw")).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("helpers", () => {
  it("parses verse locators", () => {
    expect(parseVerseLocator("2:8-20")).toEqual({ surah: 2, from: 8, to: 20 });
    expect(parseVerseLocator("1:5")).toEqual({ surah: 1, from: 5, to: 5 });
    expect(parseVerseLocator("on 2:8")).toBeNull();
    expect(parseVerseLocator("2:9-3")).toBeNull();
  });

  it("only shows reviewed content in production by default", () => {
    expect(resolveVisibility(undefined, "production")).toBe("reviewed");
    expect(resolveVisibility(undefined, "development")).toBe("drafts");
    expect(isVisible("AI_GENERATED", "reviewed")).toBe(false);
    expect(isVisible("EDITOR_REVIEW", "reviewed")).toBe(true);
    expect(isVisible("APPROVED", "published")).toBe(false);
    expect(isVisible("NEEDS_REVISION", "reviewed")).toBe(false);
  });
});
