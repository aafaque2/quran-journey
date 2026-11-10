import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contentDir } from "@quran-journey/content";
import { applyTransition } from "./transition";

const read = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(contentDir(), "parts", file), "utf8")) as Record<string, unknown>;
const now = new Date("2026-11-14T10:00:00.000Z");

function step(raw: Record<string, unknown>, to: string) {
  const r = applyTransition(raw, to, "Test Reviewer", undefined, now);
  if (!r.ok) throw new Error(r.error);
  return r.updated;
}

describe("content:status transitions", () => {
  it("records a named human step and keeps the Part valid", () => {
    const r = applyTransition(read("0001-al-fatihah-1-7.json"), "source_checked", "Test Reviewer", "checked citations", now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.updated.status).toBe("SOURCE_CHECKED");
    const history = (r.updated.review as { history: Array<Record<string, unknown>> }).history;
    expect(history.at(-1)).toMatchObject({ actor: "human", by: "Test Reviewer", from: "AI_GENERATED", to: "SOURCE_CHECKED" });
  });

  it("refuses to skip steps or publish directly", () => {
    const r = applyTransition(read("0001-al-fatihah-1-7.json"), "PUBLISHED", "Test Reviewer", undefined, now);
    expect(r.ok).toBe(false);
  });

  it("refuses anonymous changes", () => {
    const r = applyTransition(read("0001-al-fatihah-1-7.json"), "SOURCE_CHECKED", "  ", undefined, now);
    expect(r.ok).toBe(false);
  });

  it("sends sensitive Parts through scholar review before approval", () => {
    let raw = read("0003-al-baqarah-2-6-7.json"); // contains aqeedah / sabab al-nuzul claims
    raw = step(step(raw, "SOURCE_CHECKED"), "EDITOR_REVIEW");
    expect(applyTransition(raw, "APPROVED", "Test Reviewer", undefined, now).ok).toBe(false);
    raw = step(raw, "SCHOLAR_REVIEW");
    expect(applyTransition(raw, "APPROVED", "A Scholar", undefined, now).ok).toBe(true);
  });
});
