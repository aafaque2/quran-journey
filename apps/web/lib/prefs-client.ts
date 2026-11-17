"use client";

import { useSyncExternalStore } from "react";
import { createLocalStore } from "./local-store";
import { applyPrefsToRoot, DEFAULT_PREFS, normalizePrefs, PREFS_KEY, type BootConfig, type ReadingPrefs } from "./reading-prefs";

declare global {
  interface Window {
    /** Published by the inline boot script in <head> (see bootScript). */
    __qjBoot?: BootConfig;
  }
}

const bootCfg = () => (typeof window === "undefined" ? undefined : window.__qjBoot);

export const prefsStore = createLocalStore<ReadingPrefs>(PREFS_KEY, DEFAULT_PREFS, (v) => {
  const cfg = bootCfg();
  return normalizePrefs(v, cfg ? { scripts: cfg.scripts, translations: cfg.translations } : undefined);
});

/** Current preferences. During hydration this is DEFAULT_PREFS; CSS already shows the stored ones. */
export const usePrefs = () => prefsStore.useValue();

/** Re-applies stored preferences to <html> (after a change here, or in another tab). */
export function applyStoredPrefs() {
  const cfg = bootCfg();
  if (cfg) applyPrefsToRoot(document.documentElement, prefsStore.read(), cfg);
}

type Update = Partial<ReadingPrefs> | ((p: ReadingPrefs) => ReadingPrefs);

/**
 * Saves preferences and applies them immediately. With keepPlace, the section being read stays where
 * it is on screen, even though sections above it may open, close or move.
 */
export function setPrefs(update: Update, options: { keepPlace?: boolean } = {}) {
  const current = prefsStore.read();
  const next = typeof update === "function" ? update(current) : { ...current, ...update };
  const anchor = options.keepPlace ? readingAnchor() : null;
  prefsStore.write(next);
  applyStoredPrefs();
  if (anchor) {
    const shift = anchor.el.getBoundingClientRect().top - anchor.top;
    if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: "auto" });
  }
}

/** The section at the reading line (just below the sticky bars), with its position on screen. */
function readingAnchor(): { el: HTMLElement; top: number } | null {
  const line = 140;
  let best: { el: HTMLElement; top: number } | null = null;
  for (const el of document.querySelectorAll<HTMLElement>("[data-sec]")) {
    const top = el.getBoundingClientRect().top;
    if (top <= line && (!best || top > best.top)) best = { el, top };
  }
  return best;
}

/** Whether the page is showing the dark theme right now (explicit choice or the device's). */
export function isDarkNow(): boolean {
  const theme = document.documentElement.getAttribute("data-theme");
  if (theme) return theme === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

const subscribeNothing = () => () => {};

/** false on the server and during hydration, true once the client has taken over. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/** The translations to show, in order: the reader's choice, or the journey default. */
export function chosenTranslations(prefs: ReadingPrefs, available: readonly string[]): string[] {
  const chosen = (prefs.translations ?? []).filter((id) => available.includes(id));
  return chosen.length ? chosen : available.slice(0, 1);
}

/** The Arabic script to show: the reader's choice, or the journey default. */
export function chosenScript(prefs: ReadingPrefs, available: readonly string[]): string {
  return prefs.script && available.includes(prefs.script) ? prefs.script : (available[0] ?? "");
}
