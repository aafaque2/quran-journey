import { describe, expect, it } from "vitest";
import {
  applyPrefsToRoot,
  applyReorder,
  arrangeSections,
  bootConfig,
  bootScript,
  DEFAULT_PREFS,
  DEPTH_IDS,
  normalizeOrder,
  normalizePrefs,
  SECTION_IDS,
  sectionOrderValues,
  type SectionId,
} from "./reading-prefs";

/** A stand-in for <html>: just enough of the DOM for applyPrefsToRoot. */
function fakeRoot() {
  const attrs = new Map<string, string>();
  const vars = new Map<string, string>();
  const root = {
    setAttribute: (k: string, v: string) => attrs.set(k, v),
    removeAttribute: (k: string) => attrs.delete(k),
    style: { setProperty: (k: string, v: string) => vars.set(k, v) },
  };
  return { root: root as unknown as HTMLElement, attrs, vars };
}
(globalThis as Record<string, unknown>).document = { readyState: "complete", querySelectorAll: () => [] };

const cfg = bootConfig(["tanzil-uthmani", "tanzil-simple"], ["en-a", "ur-b", "hi-c"], { light: "#fff", dark: "#000" });

describe("normalizePrefs", () => {
  it("falls back to defaults for anything unreadable", () => {
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs("nonsense")).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs({ depth: "deepest", mode: "x", theme: 3, arabicSize: 99 })).toEqual(DEFAULT_PREFS);
  });

  it("keeps the MVP's stored shape (same key) and fills in the rest", () => {
    const p = normalizePrefs({ mode: "arabic", arabicSize: 3, translationSize: 0 });
    expect(p).toMatchObject({ mode: "arabic", arabicSize: 3, translationSize: 0, depth: "understand", onboarded: false });
  });

  it("drops ids the server no longer offers", () => {
    const p = normalizePrefs({ script: "gone", translations: ["gone", "ur-b", "ur-b"] }, { scripts: cfg.scripts, translations: cfg.translations });
    expect(p.script).toBeNull();
    expect(p.translations).toEqual(["ur-b"]);
  });

  it("repairs a partial or corrupted section order", () => {
    const order = normalizeOrder(["takeaways", "bogus", "verses", "takeaways"]);
    expect([...order].sort()).toEqual([...SECTION_IDS].sort());
    expect(order.indexOf("takeaways")).toBeLessThan(order.indexOf("verses"));
  });
});

describe("arranging sections", () => {
  const present: SectionId[] = ["verses", "context", "summary", "scholars", "insights", "takeaways", "reflect", "next", "why", "sources"];

  it("never puts a section beyond the depth above one inside it", () => {
    const order: SectionId[] = ["why", "scholars", "context", "takeaways", "verses", "previous", "summary", "insights", "misunderstandings", "reflect", "next", "sources"];
    const { inDepth, beyond } = arrangeSections(present, order, "read");
    expect(inDepth).toEqual(["takeaways", "verses", "summary", "insights", "next"]);
    expect(beyond).toEqual(["why", "scholars", "context", "reflect", "sources"]);
    expect(arrangeSections(present, order, "study").beyond).toEqual([]);
  });

  it("writes a reordering back without moving anything else", () => {
    const order = applyReorder(SECTION_IDS, ["takeaways", "verses"]);
    expect(order.indexOf("takeaways")).toBe(SECTION_IDS.indexOf("verses"));
    expect(order.indexOf("verses")).toBe(SECTION_IDS.indexOf("takeaways"));
    expect(order.filter((id) => id !== "takeaways" && id !== "verses")).toEqual(SECTION_IDS.filter((id) => id !== "takeaways" && id !== "verses"));
  });
});

describe("applyPrefsToRoot (the pre-paint boot script)", () => {
  it("lays sections out exactly as React does, for every depth", () => {
    const order = normalizeOrder(["why", "reflect", "takeaways", "scholars", "verses"]);
    for (const depth of DEPTH_IDS) {
      const { root, vars } = fakeRoot();
      applyPrefsToRoot(root, { depth, order }, cfg);
      const byCss = [...SECTION_IDS].sort((a, b) => Number(vars.get(`--qj-o-${a}`)) - Number(vars.get(`--qj-o-${b}`)));
      const { inDepth, beyond } = arrangeSections(SECTION_IDS, order, depth);
      expect(byCss).toEqual([...inDepth, ...beyond]);
      // Everything beyond the depth sorts after the "go deeper" divider (order 50), everything else before it.
      for (const id of inDepth) expect(Number(vars.get(`--qj-o-${id}`))).toBeLessThan(50);
      for (const id of beyond) expect(Number(vars.get(`--qj-o-${id}`))).toBeGreaterThan(50);
      expect(sectionOrderValues(order, depth)[beyond[0] ?? inDepth[0]!]).toBe(Number(vars.get(`--qj-o-${beyond[0] ?? inDepth[0]}`)));
    }
  });

  it("sets theme, script, translations and sizes, ignoring junk", () => {
    const { root, attrs, vars } = fakeRoot();
    applyPrefsToRoot(root, { theme: "dark", script: "tanzil-simple", translations: ["hi-c", "nope", "en-a"], mode: "arabic", arabicSize: 4 }, cfg);
    expect(attrs.get("data-theme")).toBe("dark");
    expect(attrs.get("data-script")).toBe("tanzil-simple");
    expect(attrs.get("data-tr")).toBe("hi-c en-a");
    expect(attrs.get("data-tr-count")).toBe("2");
    expect(vars.get("--qj-tr-hi-c")).toBe("0");
    expect(vars.get("--qj-tr-en-a")).toBe("1");
    expect(vars.get("--qj-tr-ur-b")).toBe("99");
    expect(attrs.get("data-mode")).toBe("arabic");
    expect(vars.get("--ar-scale")).toBe("1.5");

    const fresh = fakeRoot();
    applyPrefsToRoot(fresh.root, "garbage", cfg);
    expect(fresh.attrs.has("data-theme")).toBe(false);
    expect(fresh.attrs.get("data-depth")).toBe("understand");
    expect(fresh.attrs.get("data-script")).toBe("tanzil-uthmani");
    expect(fresh.attrs.get("data-tr")).toBe("en-a");
  });

  it("serializes into a self-contained inline script", () => {
    const script = bootScript(cfg);
    expect(() => new Function(script)).not.toThrow();
    expect(script).not.toContain("</script");
  });
});
