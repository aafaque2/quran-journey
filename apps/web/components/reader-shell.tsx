"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { prefsStore, SIZE_STEPS, type ReaderPrefs, type ReadingMode } from "@/lib/local-store";

const PrefsContext = createContext<{ prefs: ReaderPrefs; setPrefs: (p: ReaderPrefs) => void } | null>(null);

/** Applies reading preferences (mode, independent Arabic/translation sizes) to everything inside it. */
export function ReaderShell({ children }: { children: ReactNode }) {
  const prefs = prefsStore.useValue();
  const style = {
    "--ar-scale": SIZE_STEPS[prefs.arabicSize] ?? 1,
    "--tr-scale": SIZE_STEPS[prefs.translationSize] ?? 1,
  } as CSSProperties;
  return (
    <PrefsContext.Provider value={{ prefs, setPrefs: prefsStore.write }}>
      <div data-mode={prefs.mode} style={style}>
        {children}
      </div>
    </PrefsContext.Provider>
  );
}

const MODES: { value: ReadingMode; label: string }[] = [
  { value: "both", label: "Arabic + translation" },
  { value: "arabic", label: "Arabic" },
  { value: "translation", label: "Translation" },
];

export function ReaderControls() {
  const ctx = useContext(PrefsContext);
  if (!ctx) return null;
  const { prefs, setPrefs } = ctx;
  const bump = (key: "arabicSize" | "translationSize", delta: number) =>
    setPrefs({ ...prefs, [key]: Math.min(SIZE_STEPS.length - 1, Math.max(0, prefs[key] + delta)) });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="Reading mode" className="inline-flex rounded-full border border-line bg-surface p-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={prefs.mode === m.value}
            onClick={() => setPrefs({ ...prefs, mode: m.value })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              prefs.mode === m.value ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {prefs.mode !== "translation" && (
        <SizeControl label="Arabic" value={prefs.arabicSize} onChange={(d) => bump("arabicSize", d)} />
      )}
      {prefs.mode !== "arabic" && (
        <SizeControl label="Translation" value={prefs.translationSize} onChange={(d) => bump("translationSize", d)} />
      )}
    </div>
  );
}

function SizeControl({ label, value, onChange }: { label: string; value: number; onChange: (delta: number) => void }) {
  const btn =
    "inline-flex h-7 w-7 items-center justify-center rounded-full font-serif text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-30";
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface px-1 py-1 text-xs text-ink-2">
      <button type="button" className={btn} onClick={() => onChange(-1)} disabled={value <= 0} aria-label={`Smaller ${label} text`}>
        <span className="text-[0.7rem]">A</span>
        <span aria-hidden="true">−</span>
      </button>
      <span className="px-1">{label}</span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(1)}
        disabled={value >= SIZE_STEPS.length - 1}
        aria-label={`Larger ${label} text`}
      >
        <span className="text-[0.95rem]">A</span>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
