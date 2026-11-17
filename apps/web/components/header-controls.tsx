"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { applyStoredPrefs, isDarkNow, setPrefs, usePrefs } from "@/lib/prefs-client";
import { DEPTHS, PREFS_KEY } from "@/lib/reading-prefs";
import { MoonIcon, SunIcon } from "./icons";

/**
 * Read · Understand · Study, on every page. The highlighted option is drawn by CSS from `data-depth`
 * on <html> (correct before hydration); switching keeps the section being read in place.
 */
export function DepthSwitch() {
  const prefs = usePrefs();
  const group = useRef<HTMLDivElement>(null);

  const choose = (index: number) => {
    const d = DEPTHS[(index + DEPTHS.length) % DEPTHS.length];
    if (!d) return;
    setPrefs({ depth: d.id }, { keepPlace: true });
    group.current?.querySelector<HTMLButtonElement>(`[data-depth-opt="${d.id}"]`)?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = DEPTHS.findIndex((d) => d.id === prefs.depth);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") choose(current + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") choose(current - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={group} role="radiogroup" aria-label="Reading depth" className="depth-switch" onKeyDown={onKeyDown}>
      {DEPTHS.map((d) => (
        <button
          key={d.id}
          type="button"
          role="radio"
          aria-checked={prefs.depth === d.id}
          tabIndex={prefs.depth === d.id ? 0 : -1}
          data-depth-opt={d.id}
          title={d.tagline}
          onClick={() => setPrefs({ depth: d.id }, { keepPlace: true })}
          className="seg-opt"
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

/** One tap between light and dark. "Match my device" lives in Settings. */
export function ThemeToggle() {
  const toggle = () => {
    const apply = () => setPrefs({ theme: isDarkNow() ? "light" : "dark" });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce && "startViewTransition" in document) document.startViewTransition(apply);
    else apply();
  };
  return (
    <button type="button" onClick={toggle} className="icon-btn" aria-label="Switch between light and dark" title="Light / dark">
      <MoonIcon className="theme-when-light h-[1.1rem] w-[1.1rem]" />
      <SunIcon className="theme-when-dark h-[1.1rem] w-[1.1rem]" />
    </button>
  );
}

/** Keeps <html> in step when preferences change in another tab. */
export function PrefsSync() {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFS_KEY) applyStoredPrefs();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
