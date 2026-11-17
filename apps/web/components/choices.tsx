"use client";

import type { ReactNode } from "react";
import type { Catalog } from "@/lib/content";
import { splitFootnoteMarkers } from "@/lib/format";
import { DEFAULT_DEPTH, THEMES, type DepthId, type Theme } from "@/lib/reading-prefs";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "./icons";

/** One option card. Single choices are radios, multiple choices are checkboxes (numbered when order matters). */
export function ChoiceCard({
  selected,
  onSelect,
  multiple = false,
  number,
  title,
  badge,
  meta,
  description,
  disabled = false,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  multiple?: boolean;
  /** Shown in the check mark when the choice's position matters (e.g. translation order). */
  number?: number;
  title: ReactNode;
  badge?: string;
  meta?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onSelect()}
      className="choice"
      data-selected={selected ? "" : undefined}
    >
      <span className={multiple ? "choice-mark choice-mark-box" : "choice-mark"} aria-hidden="true">
        {selected ? multiple && number ? <span className="text-[0.7rem] font-bold">{number}</span> : <CheckIcon className="h-3.5 w-3.5" /> : null}
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="choice-title">{title}</span>
          {badge && <span className="choice-badge">{badge}</span>}
          {meta && <span className="choice-meta">{meta}</span>}
        </span>
        {description && <span className="choice-desc">{description}</span>}
        {children}
      </span>
    </button>
  );
}

const minutesLabel = (m: [number, number] | null) => (m ? (m[0] === m[1] ? `~${m[0]} min per Part` : `${m[0]}–${m[1]} min per Part`) : null);

export function DepthPicker({ depths, value, onChange }: { depths: Catalog["depths"]; value: DepthId | null; onChange: (d: DepthId) => void }) {
  return (
    <div role="radiogroup" aria-label="Reading depth" className="choice-list">
      {depths.map((d) => (
        <ChoiceCard
          key={d.id}
          selected={value === d.id}
          onSelect={() => onChange(d.id)}
          title={d.label}
          badge={d.id === DEFAULT_DEPTH ? "Recommended" : undefined}
          meta={minutesLabel(d.minutes)}
          description={d.includes}
        />
      ))}
    </div>
  );
}

export function ScriptPicker({ scripts, value, onChange }: { scripts: Catalog["scripts"]; value: string | null; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Arabic script" className="choice-list">
      {scripts.map((s) => (
        <ChoiceCard key={s.id} selected={value === s.id} onSelect={() => onChange(s.id)} title={s.label} description={s.description}>
          {s.sample && (
            <span className="choice-sample-ar" lang="ar" dir="rtl">
              {s.sample}
            </span>
          )}
        </ChoiceCard>
      ))}
    </div>
  );
}

/** Translations in the order they were picked; the last one can't be removed. */
export function TranslationPicker({
  translations,
  value,
  onChange,
}: {
  translations: Catalog["translations"];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (value.includes(id)) {
      if (value.length > 1) onChange(value.filter((x) => x !== id));
    } else onChange([...value, id]);
  };
  return (
    <div role="group" aria-label="Translations" className="choice-list">
      {translations.map((t) => {
        const position = value.indexOf(t.id);
        return (
          <ChoiceCard
            key={t.id}
            multiple
            selected={position !== -1}
            number={value.length > 1 && position !== -1 ? position + 1 : undefined}
            disabled={position !== -1 && value.length === 1}
            onSelect={() => toggle(t.id)}
            title={t.label}
            meta={t.languageName}
            description={t.description}
          >
            {t.sample && (
              <span className={`choice-sample-tr`} lang={t.language} dir={t.dir}>
                {splitFootnoteMarkers(t.sample).map((piece, i) => ("marker" in piece ? <sup key={i}>{piece.marker}</sup> : <span key={i}>{piece.text}</span>))}
              </span>
            )}
          </ChoiceCard>
        );
      })}
    </div>
  );
}

/** null = every scholar equally. Choosing specific scholars only changes what comes first. */
export function ScholarPicker({
  scholars,
  value,
  onChange,
}: {
  scholars: Catalog["scholars"];
  value: string[] | null;
  onChange: (ids: string[] | null) => void;
}) {
  const chosen = value ?? [];
  const toggle = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    onChange(next.length ? next : null);
  };
  return (
    <div role="group" aria-label="Scholars" className="choice-list">
      <ChoiceCard
        multiple
        selected={chosen.length === 0}
        onSelect={() => onChange(null)}
        title="All scholars equally"
        badge="Recommended"
        description="Every explanation in the order the passage needs it."
      />
      {scholars.map((s) => (
        <ChoiceCard
          key={s.id}
          multiple
          selected={chosen.includes(s.id)}
          onSelect={() => toggle(s.id)}
          title={s.shortTitle}
          meta={s.author ? `${s.author}${s.authorDied ? `, d. ${s.authorDied.split(" / ")[1] ?? s.authorDied}` : ""}` : undefined}
          description={s.description}
        />
      ))}
    </div>
  );
}

const THEME_ICON: Record<Theme, ReactNode> = {
  system: <MonitorIcon className="h-4 w-4" />,
  light: <SunIcon className="h-4 w-4" />,
  dark: <MoonIcon className="h-4 w-4" />,
};

export function ThemePicker({ value, onChange }: { value: Theme | null; onChange: (t: Theme) => void }) {
  return (
    <div role="radiogroup" aria-label="Appearance" className="choice-list choice-list-row">
      {THEMES.map((t) => (
        <ChoiceCard
          key={t.id}
          selected={value === t.id}
          onSelect={() => onChange(t.id)}
          title={
            <span className="inline-flex items-center gap-2">
              {THEME_ICON[t.id]}
              {t.label}
            </span>
          }
        >
          <span className="theme-swatch" data-swatch={t.id} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </ChoiceCard>
      ))}
    </div>
  );
}
