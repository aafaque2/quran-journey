import type { RawVerse } from "@quran-journey/schema";
import { arabicDigits, parseFootnotes, splitFootnoteMarkers } from "@/lib/format";

/**
 * The Qur'an section. Arabic (verbatim, RTL) and the translation of its meaning are rendered as
 * separate blocks with different typography, never merged into one string (AGENTS.md conventions).
 */
export function VerseList({ verses, translationName }: { verses: RawVerse[]; translationName: string }) {
  return (
    <div className="quran-panel rounded-2xl px-5 py-6 sm:px-8">
      <p className="mb-6 text-xs uppercase tracking-wider text-ink-3">
        Arabic text · Translation of the meaning: {translationName}
      </p>
      <ol className="space-y-9">
        {verses.map((v) => {
          const notes = parseFootnotes(v.footnotes);
          return (
            <li key={v.key} id={`v-${v.surah}-${v.ayah}`} className="scroll-mt-24">
              {v.bismillah && (
                <p className="quran-text mb-6 text-center" lang="ar" dir="rtl" style={{ textAlign: "center" }}>
                  {v.bismillah}
                </p>
              )}
              <div className="verse">
                <div className="ar-col">
                  <p className="quran-text" lang="ar" dir="rtl">
                    {v.arabic}
                    <span className="ayah-mark" aria-label={`verse ${v.ayah}`}>
                      {arabicDigits(v.ayah)}
                    </span>
                  </p>
                </div>
                <div className="tr-col">
                  <p className="translation-text">
                    <span className="me-2 align-top font-sans text-xs font-semibold text-gold">
                      {v.surah}:{v.ayah}
                    </span>
                    {splitFootnoteMarkers(v.translation).map((piece, i) =>
                      "marker" in piece ? (
                        <sup key={i}>
                          <a href={`#fn-${v.surah}-${v.ayah}-${piece.marker}`} className="px-0.5 font-sans text-[0.7em] text-accent">
                            {piece.marker}
                          </a>
                        </sup>
                      ) : (
                        <span key={i}>{piece.text}</span>
                      ),
                    )}
                  </p>
                  {notes.length > 0 && (
                    <details className="mt-2 text-sm text-ink-3">
                      <summary className="cursor-pointer select-none">Translator&apos;s notes ({notes.length})</summary>
                      <ol className="mt-2 space-y-2 border-s border-line ps-3">
                        {notes.map((n) => (
                          <li key={n.marker} id={`fn-${v.surah}-${v.ayah}-${n.marker}`} className="leading-relaxed">
                            <span className="me-1 font-semibold text-ink-2">[{n.marker}]</span>
                            {n.text}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
