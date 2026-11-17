"use client";

import { setPrefs, usePrefs } from "@/lib/prefs-client";
import { SIZE_STEPS, VERSE_MODES } from "@/lib/reading-prefs";

/**
 * Verse display (Arabic + translation / Arabic only / translation only) and the two independent text
 * sizes (product spec §9.4). The highlighted option comes from CSS (`data-mode` on <html>), so it is
 * right before hydration; the preferences themselves live on <html> as well.
 */
export function ReaderControls() {
  const prefs = usePrefs();
  const bump = (key: "arabicSize" | "translationSize", delta: number) =>
    setPrefs((p) => ({ ...p, [key]: Math.min(SIZE_STEPS.length - 1, Math.max(0, p[key] + delta)) }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="Verse display" className="inline-flex rounded-full border border-line bg-surface p-1">
        {VERSE_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={prefs.mode === m.id}
            data-mode-opt={m.id}
            onClick={() => setPrefs({ mode: m.id }, { keepPlace: true })}
            className="seg-opt rounded-full px-3 py-1.5 text-xs font-medium"
          >
            {m.id === "both" ? "Arabic + translation" : m.id === "arabic" ? "Arabic" : "Translation"}
          </button>
        ))}
      </div>
      <SizeControl label="Arabic" className="size-ar" value={prefs.arabicSize} onChange={(d) => bump("arabicSize", d)} />
      <SizeControl label="Translation" className="size-tr" value={prefs.translationSize} onChange={(d) => bump("translationSize", d)} />
    </div>
  );
}

export function SizeControl({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: number;
  onChange: (delta: number) => void;
  className?: string;
}) {
  const btn =
    "inline-flex h-7 w-7 items-center justify-center rounded-full font-serif text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-30";
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-full border border-line bg-surface px-1 py-1 text-xs text-ink-2 ${className}`}>
      <button type="button" className={btn} onClick={() => onChange(-1)} disabled={value <= 0} aria-label={`Smaller ${label} text`}>
        <span className="text-[0.7rem]">A</span>
        <span aria-hidden="true">−</span>
      </button>
      <span className="px-1">{label}</span>
      <button type="button" className={btn} onClick={() => onChange(1)} disabled={value >= SIZE_STEPS.length - 1} aria-label={`Larger ${label} text`}>
        <span className="text-[0.95rem]">A</span>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
