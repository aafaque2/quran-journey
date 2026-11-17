/**
 * Reading preferences: per-device conveniences kept in localStorage. They are never synced or sent
 * anywhere, and they change only emphasis, order and presentation, never the content itself (a
 * scholarly disagreement always shows every view, whatever scholars the reader prefers).
 *
 * Shared by the server (defaults, the boot script) and the client (stores, controls). No React here.
 */

// ── Depth: how much of each Part to read ─────────────────────────────────────

export const DEPTHS = [
  {
    id: "read",
    label: "Read",
    tagline: "The passage, what it means, and what to take from it.",
    includes: "The verses, a plain summary, key insights, takeaways, and how it connects to the Parts around it.",
  },
  {
    id: "understand",
    label: "Understand",
    tagline: "Adds the context, what the scholars explain, common misreadings and reflection.",
    includes: "Everything in Read, plus the background, each scholar's explanation, where scholars differ, and questions to reflect on.",
  },
  {
    id: "study",
    label: "Study",
    tagline: "Everything, including why the passage is one Part and every source.",
    includes: "Everything in Understand, plus how the passage was divided and the full list of works cited.",
  },
] as const;
export type DepthId = (typeof DEPTHS)[number]["id"];
export const DEPTH_IDS: DepthId[] = DEPTHS.map((d) => d.id);
export const DEFAULT_DEPTH: DepthId = "understand";
export const depthInfo = (id: DepthId) => DEPTHS.find((d) => d.id === id) ?? DEPTHS[1];
const depthIndex = (id: DepthId) => DEPTH_IDS.indexOf(id);

// ── Sections of a Part, in the default reading order ─────────────────────────
// `from` is the shallowest depth that includes the section. Order follows product spec §9.2.

export const SECTIONS = [
  { id: "previous", from: "read", title: "Where we left off" },
  { id: "verses", from: "read", title: "The passage" },
  { id: "context", from: "understand", title: "What is happening here" },
  { id: "summary", from: "read", title: "What this passage is doing" },
  { id: "scholars", from: "understand", title: "What the scholars explain" },
  { id: "insights", from: "read", title: "Key insights" },
  { id: "takeaways", from: "read", title: "Takeaways" },
  { id: "misunderstandings", from: "understand", title: "Common misunderstandings" },
  { id: "reflect", from: "understand", title: "Reflect" },
  { id: "next", from: "read", title: "What comes next" },
  { id: "why", from: "study", title: "Why this passage is one Part" },
  { id: "sources", from: "study", title: "Sources" },
] as const satisfies ReadonlyArray<{ id: string; from: DepthId; title: string }>;
export type SectionId = (typeof SECTIONS)[number]["id"];
export const SECTION_IDS: SectionId[] = SECTIONS.map((s) => s.id);
export const sectionInfo = (id: SectionId) => SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];
export const isSectionId = (v: unknown): v is SectionId => typeof v === "string" && (SECTION_IDS as string[]).includes(v);

/** Whether a section belongs to a depth (Read ⊂ Understand ⊂ Study). */
export function inDepth(id: SectionId, depth: DepthId): boolean {
  return depthIndex(sectionInfo(id).from) <= depthIndex(depth);
}

/** CSS `order` of the "go deeper" divider: in-depth sections sort before it, the rest after. */
export const DIVIDER_ORDER = 50;
const BEYOND_OFFSET = 100;

// ── Other preferences ────────────────────────────────────────────────────────

export const VERSE_MODES = [
  { id: "both", label: "Arabic + translation" },
  { id: "arabic", label: "Arabic only" },
  { id: "translation", label: "Translation only" },
] as const;
export type VerseMode = (typeof VERSE_MODES)[number]["id"];

export const THEMES = [
  { id: "system", label: "Match my device" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const;
export type Theme = (typeof THEMES)[number]["id"];

export const SIZE_STEPS = [0.85, 1, 1.15, 1.3, 1.5] as const;
const DEFAULT_SIZE_STEP = 1;

export interface ReadingPrefs {
  depth: DepthId;
  /** Every section id exactly once, in the reader's order. */
  order: SectionId[];
  /** Raw dataset id of the Arabic script; null means the journey's default. */
  script: string | null;
  /** Raw dataset ids of the chosen translations, in display order; null means the journey's default. */
  translations: string[] | null;
  /** Work ids whose explanations come first; null means all scholars equally. */
  scholars: string[] | null;
  mode: VerseMode;
  arabicSize: number;
  translationSize: number;
  theme: Theme;
  /** Set once the reader has finished or skipped the welcome setup. */
  onboarded: boolean;
}

/** The old key is kept on purpose: the shape only grew, and normalizePrefs fills what is missing. */
export const PREFS_KEY = "qj.prefs.v1";

export const DEFAULT_PREFS: ReadingPrefs = {
  depth: DEFAULT_DEPTH,
  order: [...SECTION_IDS],
  script: null,
  translations: null,
  scholars: null,
  mode: "both",
  arabicSize: DEFAULT_SIZE_STEP,
  translationSize: DEFAULT_SIZE_STEP,
  theme: "system",
  onboarded: false,
};

/** Ids the server knows about; anything else in storage (e.g. a retired translation) is dropped. */
export interface KnownIds {
  scripts: string[];
  translations: string[];
  scholars: string[];
}

const pick = <T extends string>(value: unknown, allowed: readonly { id: T }[], fallback: T): T =>
  allowed.some((a) => a.id === value) ? (value as T) : fallback;

function idList(value: unknown, allowed: string[] | undefined): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.filter((v): v is string => typeof v === "string" && (!allowed || allowed.includes(v))))];
  return ids.length ? ids : null;
}

const sizeStep = (v: unknown) => (typeof v === "number" && v >= 0 && v < SIZE_STEPS.length ? Math.round(v) : DEFAULT_SIZE_STEP);

/** Keeps known ids in the stored order and slots any missing section in at its default position. */
export function normalizeOrder(value: unknown): SectionId[] {
  const order: SectionId[] = [];
  if (Array.isArray(value)) for (const v of value) if (isSectionId(v) && !order.includes(v)) order.push(v);
  SECTION_IDS.forEach((id, i) => {
    if (order.includes(id)) return;
    let at = 0;
    for (let k = i - 1; k >= 0; k--) {
      const j = order.indexOf(SECTION_IDS[k]!);
      if (j !== -1) {
        at = j + 1;
        break;
      }
    }
    order.splice(at, 0, id);
  });
  return order;
}

/** Parses whatever is in storage into valid preferences. Never throws. */
export function normalizePrefs(raw: unknown, known?: Partial<KnownIds>): ReadingPrefs {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    depth: pick(o.depth, DEPTHS, DEFAULT_DEPTH),
    order: normalizeOrder(o.order),
    script: typeof o.script === "string" && (!known?.scripts || known.scripts.includes(o.script)) ? o.script : null,
    translations: idList(o.translations, known?.translations),
    scholars: idList(o.scholars, known?.scholars),
    mode: pick(o.mode, VERSE_MODES, "both"),
    arabicSize: sizeStep(o.arabicSize),
    translationSize: sizeStep(o.translationSize),
    theme: pick(o.theme, THEMES, "system"),
    onboarded: o.onboarded === true,
  };
}

/**
 * The sections a Part has, split into the reader's depth and the "go deeper" rest. Both keep the
 * reader's order, and nothing outside the depth can ever be placed above something inside it.
 */
export function arrangeSections(present: readonly SectionId[], order: readonly SectionId[], depth: DepthId) {
  const sorted = [...present].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return {
    inDepth: sorted.filter((id) => inDepth(id, depth)),
    beyond: sorted.filter((id) => !inDepth(id, depth)),
  };
}

/** Writes a new order for some sections into the full order; every other section keeps its slot. */
export function applyReorder(order: readonly SectionId[], reordered: readonly SectionId[]): SectionId[] {
  const moving = new Set(reordered);
  let next = 0;
  return order.map((id) => (moving.has(id) ? (reordered[next++] ?? id) : id));
}

// ── Mirroring preferences onto <html> ────────────────────────────────────────

export interface BootConfig {
  key: string;
  /** [section id, index of the shallowest depth that includes it], in default order. */
  sections: Array<[string, number]>;
  /** Depth ids, shallow to deep. */
  depths: string[];
  defaultDepth: string;
  /** Raw dataset ids; the first of each list is the journey default. */
  scripts: string[];
  translations: string[];
  sizes: number[];
  /** Where first-time visitors to "/" are sent, or null. */
  welcome: string | null;
  themeColors: { light: string; dark: string };
}

export function bootConfig(scripts: string[], translations: string[], themeColors: BootConfig["themeColors"]): BootConfig {
  return {
    key: PREFS_KEY,
    sections: SECTIONS.map((s) => [s.id, depthIndex(s.from)]),
    depths: [...DEPTH_IDS],
    defaultDepth: DEFAULT_DEPTH,
    scripts,
    translations,
    sizes: [...SIZE_STEPS],
    welcome: "/welcome",
    themeColors,
  };
}

/**
 * Mirrors preferences onto <html> as data attributes and CSS custom properties, so CSS lays the page
 * out correctly before React hydrates: no flash of the wrong theme, depth, section order, script or
 * translation. It runs inline in <head> (serialized with Function#toString, as next-themes does) and
 * again after every change. It must stay self-contained: no imports, no outer references, plain ES2017.
 */
export function applyPrefsToRoot(root: HTMLElement, raw: unknown, cfg: BootConfig): void {
  var p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  var listed = function (list: string[], v: unknown) {
    return typeof v === "string" && list.indexOf(v) !== -1;
  };

  // Theme: an explicit choice wins; otherwise the stylesheet follows the device.
  var theme = p.theme === "light" || p.theme === "dark" ? (p.theme as string) : "";
  if (theme) root.setAttribute("data-theme", theme);
  else root.removeAttribute("data-theme");
  var paintMeta = function () {
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var m = 0; m < metas.length; m++) {
      var forDark = (metas[m]!.getAttribute("media") || "").indexOf("dark") !== -1;
      var dark = theme ? theme === "dark" : forDark;
      metas[m]!.setAttribute("content", dark ? cfg.themeColors.dark : cfg.themeColors.light);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paintMeta);
  else paintMeta();

  // Depth.
  var depth = listed(cfg.depths, p.depth) ? (p.depth as string) : cfg.defaultDepth;
  var level = cfg.depths.indexOf(depth);
  root.setAttribute("data-depth", depth);

  // Section order: the reader's order, with sections beyond the depth after the divider (order 50).
  var order: string[] = [];
  var known = function (id: unknown) {
    for (var i = 0; i < cfg.sections.length; i++) if (cfg.sections[i]![0] === id) return true;
    return false;
  };
  if (Array.isArray(p.order)) for (var o = 0; o < p.order.length; o++) if (known(p.order[o]) && order.indexOf(p.order[o]) === -1) order.push(p.order[o]);
  for (var d = 0; d < cfg.sections.length; d++) {
    var sid = cfg.sections[d]![0];
    if (order.indexOf(sid) !== -1) continue;
    var at = 0;
    for (var k = d - 1; k >= 0; k--) {
      var j = order.indexOf(cfg.sections[k]![0]);
      if (j !== -1) {
        at = j + 1;
        break;
      }
    }
    order.splice(at, 0, sid);
  }
  for (var r = 0; r < order.length; r++) {
    var from = 0;
    for (var s = 0; s < cfg.sections.length; s++) if (cfg.sections[s]![0] === order[r]) from = cfg.sections[s]![1];
    root.style.setProperty("--qj-o-" + order[r], String((from > level ? 100 : 0) + r));
  }

  // Arabic script and translations (raw dataset ids; the first of each list is the default).
  root.setAttribute("data-script", listed(cfg.scripts, p.script) ? (p.script as string) : cfg.scripts[0] || "");
  var tr: string[] = [];
  if (Array.isArray(p.translations))
    for (var t = 0; t < p.translations.length; t++) if (listed(cfg.translations, p.translations[t]) && tr.indexOf(p.translations[t]) === -1) tr.push(p.translations[t]);
  if (!tr.length && cfg.translations[0]) tr.push(cfg.translations[0]);
  root.setAttribute("data-tr", tr.join(" "));
  root.setAttribute("data-tr-count", String(tr.length));
  for (var c = 0; c < cfg.translations.length; c++) {
    var pos = tr.indexOf(cfg.translations[c]!);
    root.style.setProperty("--qj-tr-" + cfg.translations[c], String(pos === -1 ? 99 : pos));
  }

  // Verse display and the two independent text sizes.
  root.setAttribute("data-mode", p.mode === "arabic" || p.mode === "translation" ? (p.mode as string) : "both");
  var size = function (v: unknown) {
    return typeof v === "number" && v >= 0 && v < cfg.sizes.length ? cfg.sizes[Math.round(v)]! : cfg.sizes[1]!;
  };
  root.style.setProperty("--ar-scale", String(size(p.arabicSize)));
  root.style.setProperty("--tr-scale", String(size(p.translationSize)));

  if (p.onboarded === true) root.setAttribute("data-onboarded", "");
  else root.removeAttribute("data-onboarded");
}

/** The section order values applyPrefsToRoot writes, for server-side defaults and tests. */
export function sectionOrderValues(order: readonly SectionId[], depth: DepthId): Record<SectionId, number> {
  const out = {} as Record<SectionId, number>;
  normalizeOrder(order).forEach((id, i) => {
    out[id] = (inDepth(id, depth) ? 0 : BEYOND_OFFSET) + i;
  });
  return out;
}

/**
 * The inline <head> script. Applies stored preferences before first paint, publishes the config for
 * client code, and sends first-time visitors of "/" to the welcome setup (only when storage works,
 * so a browser that can't remember the answer is never sent round in circles).
 */
export function bootScript(cfg: BootConfig): string {
  const json = JSON.stringify(cfg).replace(/</g, "\\u003c");
  return (
    `(function(){var cfg=${json};window.__qjBoot=cfg;var raw=null,ok=false;` +
    `try{raw=JSON.parse(localStorage.getItem(cfg.key)||"null");localStorage.setItem("qj.probe","1");localStorage.removeItem("qj.probe");ok=true}catch(e){}` +
    `try{(${applyPrefsToRoot.toString()})(document.documentElement,raw,cfg)}catch(e){}` +
    `if(ok&&cfg.welcome&&location.pathname==="/"&&!(raw&&raw.onboarded===true)&&!/bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent))location.replace(cfg.welcome)})();`
  );
}
