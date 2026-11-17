import type { RawVerse } from "@quran-journey/schema";
import { arabicDigits, parseFootnotes, splitFootnoteMarkers } from "@/lib/format";

export interface ScriptView {
  id: string;
  label: string;
}

export interface TranslationView {
  id: string;
  label: string;
  languageName: string;
  /** BCP 47, from the raw dataset. */
  language: string;
  dir: "ltr" | "rtl";
}

/**
 * The Qur'an section. Arabic (verbatim, RTL) and each translation of its meaning are separate blocks
 * with their own typography, never merged into one string (AGENTS.md conventions). Every script and
 * translation readers can choose is rendered; CSS shows the reader's choice from the first paint.
 */
export function VerseList({ verses, scripts, translations }: { verses: RawVerse[]; scripts: ScriptView[]; translations: TranslationView[] }) {
  return (
    <div className="quran-panel rounded-2xl px-5 py-6 sm:px-8">
      <div className="verse-credits mb-6">
        <span>Arabic text</span>
        {scripts.map((s) => (
          <span key={s.id} data-ar-script={s.id}>
            ({s.label} script)
          </span>
        ))}
        <span className="verse-credits-tr">· Translation of the meaning:</span>
        {translations.map((t, i) => (
          <span key={t.id} data-tr-key={t.id} className="verse-credit-chip" style={{ order: `var(--qj-tr-${t.id}, ${i === 0 ? 0 : 99})` }}>
            {t.label}
            {t.languageName !== "English" ? ` (${t.languageName})` : ""}
          </span>
        ))}
      </div>
      <ol className="space-y-9">
        {verses.map((v) => (
          <li key={v.key} id={`v-${v.surah}-${v.ayah}`} className="scroll-mt-32">
            {scripts.map((s) => {
              const basmala = v.scripts[s.id]?.bismillah;
              return basmala ? (
                <p key={s.id} className="quran-text mb-6 text-center" lang="ar" dir="rtl" data-ar-script={s.id} style={{ textAlign: "center" }}>
                  {basmala}
                </p>
              ) : null;
            })}
            <div className="verse">
              <div className="ar-col">
                {scripts.map((s) => (
                  <p key={s.id} className="quran-text" lang="ar" dir="rtl" data-ar-script={s.id}>
                    {v.scripts[s.id]?.text}
                    <span className="ayah-mark" aria-label={`verse ${v.ayah}`}>
                      {arabicDigits(v.ayah)}
                    </span>
                  </p>
                ))}
              </div>
              <div className="tr-col">
                <p className="verse-key">
                  {v.surah}:{v.ayah}
                </p>
                {translations.map((t, i) => {
                  const tr = v.translations[t.id];
                  if (!tr) return null;
                  const notes = parseFootnotes(tr.footnotes);
                  const fn = (marker: string) => `fn-${t.id}-${v.surah}-${v.ayah}-${marker}`;
                  return (
                    <div
                      key={t.id}
                      className="tr-block"
                      data-tr-key={t.id}
                      lang={t.language}
                      dir={t.dir}
                      style={{ order: `var(--qj-tr-${t.id}, ${i === 0 ? 0 : 99})` }}
                    >
                      <p className="tr-label" dir="ltr">
                        {t.label} · {t.languageName}
                      </p>
                      <p className="translation-text">
                        {splitFootnoteMarkers(tr.text).map((piece, k) =>
                          "marker" in piece ? (
                            <sup key={k}>
                              <a href={`#${fn(piece.marker)}`} className="px-0.5 font-sans text-[0.7em] text-accent">
                                {piece.marker}
                              </a>
                            </sup>
                          ) : (
                            <span key={k}>{piece.text}</span>
                          ),
                        )}
                      </p>
                      {notes.length > 0 && (
                        <details className="tr-notes mt-2 text-sm text-ink-3">
                          <summary className="cursor-pointer select-none" dir="ltr">
                            Translator&apos;s notes ({notes.length})
                          </summary>
                          <ol className="mt-2 space-y-2 border-s border-line ps-3">
                            {notes.map((n) => (
                              <li key={n.marker} id={fn(n.marker)} className="leading-relaxed">
                                <span className="me-1 font-semibold text-ink-2">[{n.marker}]</span>
                                {n.text}
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
