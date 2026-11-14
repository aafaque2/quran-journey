"use client";

import { useSyncExternalStore } from "react";

/**
 * A tiny per-device store over localStorage (per-viewer conveniences only: progress and reading
 * preferences). Every access is guarded, so the app still works when storage is unavailable.
 */
export function createLocalStore<T>(key: string, fallback: T, parse: (value: unknown) => T | null) {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } | null = null;

  const read = (): T => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      /* storage unavailable */
    }
    if (cache && cache.raw === raw) return cache.value;
    let value = fallback;
    if (raw) {
      try {
        value = parse(JSON.parse(raw)) ?? fallback;
      } catch {
        value = fallback;
      }
    }
    cache = { raw, value };
    return value;
  };

  const write = (value: T) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: keep working in memory for this page */
    }
    cache = { raw: JSON.stringify(value), value };
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        cache = null;
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  return {
    read,
    write,
    useValue(): T {
      return useSyncExternalStore(subscribe, read, () => fallback);
    },
  };
}

// ── Journey progress (no streaks, nothing that punishes absence: product spec §4) ──

export interface Progress {
  completed: number[];
  lastVisited: number | null;
}

const isNumberArray = (v: unknown): v is number[] => Array.isArray(v) && v.every((n) => typeof n === "number");

export const progressStore = createLocalStore<Progress>("qj.progress.v1", { completed: [], lastVisited: null }, (v) => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    completed: isNumberArray(o.completed) ? o.completed : [],
    lastVisited: typeof o.lastVisited === "number" ? o.lastVisited : null,
  };
});

// ── Reading preferences (product spec §9.4) ──

export type ReadingMode = "both" | "arabic" | "translation";
export interface ReaderPrefs {
  mode: ReadingMode;
  arabicSize: number;
  translationSize: number;
}
export const SIZE_STEPS = [0.85, 1, 1.15, 1.3, 1.5] as const;

const clampStep = (n: unknown) => (typeof n === "number" && n >= 0 && n < SIZE_STEPS.length ? Math.round(n) : 1);

export const prefsStore = createLocalStore<ReaderPrefs>(
  "qj.prefs.v1",
  { mode: "both", arabicSize: 1, translationSize: 1 },
  (v) => {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const mode = o.mode === "arabic" || o.mode === "translation" ? o.mode : "both";
    return { mode, arabicSize: clampStep(o.arabicSize), translationSize: clampStep(o.translationSize) };
  },
);
