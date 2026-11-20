"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Catalog } from "@/lib/content";
import { resetProgress } from "@/lib/local-store";
import { chosenScript, chosenTranslations, setPrefs, useHydrated, usePrefs } from "@/lib/prefs-client";
import { DEFAULT_PREFS, SECTIONS } from "@/lib/reading-prefs";
import { DepthPicker, ScholarPicker, ScriptPicker, ThemePicker, TranslationPicker } from "./choices";
import { InstallApp, SaveForOffline } from "./pwa";
import { ReaderControls } from "./reader-shell";
import { SectionOrderEditor } from "./section-order-editor";

/** Every reading preference in one place. Changes apply at once and are saved on this device only. */
export function SettingsPanel({ catalog, partPaths }: { catalog: Catalog; partPaths: string[] }) {
  const hydrated = useHydrated();
  const prefs = usePrefs();
  const [confirmProgress, setConfirmProgress] = useState(false);
  const [progressCleared, setProgressCleared] = useState(false);

  // Before hydration the stored choices aren't known yet; showing defaults would flash wrong answers.
  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />;

  const scriptIds = catalog.scripts.map((s) => s.id);
  const translationIds = catalog.translations.map((t) => t.id);

  return (
    <div className="space-y-6">
      <Group id="depth" title="Reading depth" lead="How much of each Part opens for you. Sections outside it stay available below a “Go deeper” line.">
        <DepthPicker depths={catalog.depths} value={prefs.depth} onChange={(depth) => setPrefs({ depth })} />
      </Group>

      <Group
        id="order"
        title="Order of sections"
        lead="Put the sections in the order you like to read them. Sections beyond your depth always come after the ones within it."
      >
        <SectionOrderEditor
          key={`${prefs.depth}:${prefs.order.join()}`}
          idPrefix="settings"
          sections={SECTIONS.map((s) => ({ id: s.id, title: s.title }))}
          depth={prefs.depth}
          order={prefs.order}
        />
      </Group>

      <Group id="script" title="Arabic script">
        <ScriptPicker scripts={catalog.scripts} value={chosenScript(prefs, scriptIds)} onChange={(script) => setPrefs({ script })} />
      </Group>

      <Group id="translations" title="Translations" lead="In the order you pick them. The first is used in Listen & Understand.">
        <TranslationPicker
          translations={catalog.translations}
          value={chosenTranslations(prefs, translationIds)}
          onChange={(translations) => setPrefs({ translations })}
        />
      </Group>

      <Group
        id="scholars"
        title="Whose explanations come first"
        lead="This only changes order and emphasis. Other scholars stay one tap away, and every view in a disagreement is always shown."
      >
        <ScholarPicker scholars={catalog.scholars} value={prefs.scholars} onChange={(scholars) => setPrefs({ scholars })} />
      </Group>

      <Group id="display" title="Verses" lead="What to show, and the size of each text.">
        <ReaderControls />
      </Group>

      <Group id="appearance" title="Appearance">
        <ThemePicker value={prefs.theme} onChange={(theme) => setPrefs({ theme })} />
      </Group>

      <Group id="progress" title="Your progress" lead="Completed Parts and where you left off, kept on this device only.">
        {progressCleared ? (
          <p className="text-sm text-ink-2">Progress cleared.</p>
        ) : confirmProgress ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink-2">Clear all progress on this device?</p>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                resetProgress();
                setProgressCleared(true);
              }}
            >
              Yes, clear it
            </button>
            <button type="button" className="welcome-link" onClick={() => setConfirmProgress(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" className="btn-secondary" onClick={() => setConfirmProgress(true)}>
            Reset progress
          </button>
        )}
      </Group>

      <Group id="install" title="On your phone" lead="Install the journey like an app, and keep Parts for reading without a connection.">
        <div className="space-y-5">
          <InstallApp />
          {partPaths.length > 0 && <SaveForOffline paths={partPaths} />}
        </div>
      </Group>

      <Group id="start-over" title="Start over">
        <div className="flex flex-wrap gap-3">
          <Link href="/welcome" className="btn-secondary">
            Run the welcome setup again
          </Link>
          <button type="button" className="btn-secondary" onClick={() => setPrefs({ ...DEFAULT_PREFS, onboarded: true })}>
            Restore default settings
          </button>
        </div>
      </Group>
    </div>
  );
}

function Group({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 rounded-2xl border border-line bg-surface p-5 sm:p-7">
      <h2 id={`${id}-title`} className="font-serif text-xl font-semibold">
        {title}
      </h2>
      {lead && <p className="mt-1 text-sm leading-relaxed text-ink-3">{lead}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
