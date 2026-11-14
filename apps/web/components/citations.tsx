import type { Citation, Work } from "@quran-journey/schema";
import { parseVerseLocator } from "@quran-journey/content";

/** Source chips under a claim. Each opens to show the full reference (and the Arabic, for public-domain works). */
export function SourceList({ sources, works }: { sources: Citation[]; works: Map<string, Work> }) {
  if (sources.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Sources">
      {sources.map((c, i) => (
        <CitationChip key={`${c.work}-${c.locator}-${i}`} citation={c} work={works.get(c.work)} />
      ))}
    </ul>
  );
}

function CitationChip({ citation, work }: { citation: Citation; work: Work | undefined }) {
  const isQuran = work?.kind === "quran";
  const label = isQuran ? `Qur'an ${citation.locator}` : `${work?.shortTitle ?? work?.title ?? citation.work} · ${citation.locator}`;
  const range = isQuran ? parseVerseLocator(citation.locator) : null;
  return (
    <li className="contents">
      <details className="citation">
        <summary className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-2 transition hover:border-ink-3 hover:text-ink">
          <span className="truncate">{label}</span>
        </summary>
        <div className="mt-2 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-2 shadow-sm">
          <p className="font-semibold text-ink">
            {work?.title ?? citation.work}
            {work?.titleOriginal && (
              <span className="ms-2 font-quran text-base font-normal" lang="ar" dir="rtl">
                {work.titleOriginal}
              </span>
            )}
          </p>
          {work?.author && (
            <p>
              {work.author}
              {work.authorDied ? ` (d. ${work.authorDied})` : ""}
            </p>
          )}
          <p className="mt-1">
            <span className="text-ink-3">Location:</span> {citation.locator}
            {citation.note ? <span className="text-ink-3"> — {citation.note}</span> : null}
          </p>
          {citation.excerpt && (
            <blockquote className="excerpt mt-3 border-e-2 border-gold pe-3 text-ink" lang="ar" dir="rtl">
              {citation.excerpt}
            </blockquote>
          )}
          {range && (
            <a
              className="mt-2 inline-block text-accent underline-offset-2 hover:underline"
              href={`https://quran.com/${range.surah}/${range.from}${range.to !== range.from ? `-${range.to}` : ""}`}
              target="_blank"
              rel="noreferrer"
            >
              Read in context on Quran.com
            </a>
          )}
          {work && work.rights !== "public_domain" && (
            <p className="mt-2 text-xs text-ink-3">Summarized in our own words. This work is not quoted.</p>
          )}
        </div>
      </details>
    </li>
  );
}
