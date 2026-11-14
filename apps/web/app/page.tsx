import Link from "next/link";
import { CONTENT_CATEGORIES } from "@quran-journey/schema";
import { CategoryBadge, StatusBadge } from "@/components/badges";
import { ArrowRightIcon } from "@/components/icons";
import { CompletionMark, JourneyProgress, type PartSummary } from "@/components/progress";
import { getContent, getVisibility, visibleParts } from "@/lib/content";
import { CATEGORY, surahName, verseRange } from "@/lib/format";
import { SITE } from "@/lib/site";

export default function JourneyPage() {
  const content = getContent();
  const parts = visibleParts();
  const summaries: PartSummary[] = parts.map((p) => ({
    partNumber: p.partNumber,
    title: p.title,
    href: `/parts/${p.partNumber}`,
    range: `${surahName(p.surah, content.surahs.get(p.surah)?.tname)} ${verseRange(p.surah, p.startAyah, p.endAyah)}`,
    minutes: p.estimatedMinutes,
  }));
  const unreviewed = parts.some((p) => p.status !== "PUBLISHED");

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <section className="py-14 sm:py-20">
        <p className="text-sm font-medium text-gold">A guided journey through the Qur&apos;an</p>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-6xl">
          {SITE.tagline}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
          Short, connected Parts. Each one is a meaningful passage with its context, what the scholars explain, and room to
          reflect, and each picks up from the one before. Go at your own pace and pick up exactly where you left off.
        </p>
      </section>

      <div className="grid gap-12 pb-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="journey-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
            <h2 id="journey-title" className="font-serif text-2xl font-semibold">
              {content.journey.title}
            </h2>
            <p className="text-sm text-ink-3">
              {content.journey.scope} · {parts.length} of {content.journey.parts.length} Parts available
            </p>
          </div>

          {parts.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-line p-8 text-ink-2">
              <p className="font-serif text-lg text-ink">No Parts have cleared review yet.</p>
              <p className="mt-2 text-sm leading-relaxed">
                Parts appear here once an editor has reviewed them (current setting: <code className="font-mono">{getVisibility()}</code>). To
                preview unreviewed drafts in a closed pilot, set <code className="font-mono">CONTENT_VISIBILITY=drafts</code>.
              </p>
            </div>
          ) : (
            <ol className="relative mt-6 space-y-3 before:absolute before:inset-y-6 before:left-[1.375rem] before:w-px before:bg-line">
              {summaries.map((s, i) => {
                const part = parts[i];
                return (
                  <li key={s.partNumber} className="relative">
                    <Link
                      href={s.href}
                      className="group flex gap-4 rounded-2xl p-3 transition hover:bg-surface sm:gap-5 sm:p-4"
                    >
                      <span className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-paper font-serif text-lg font-semibold text-gold transition group-hover:border-gold">
                        {s.partNumber}
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5">
                        <span className="block font-serif text-lg font-semibold leading-snug text-ink">{s.title}</span>
                        <span className="mt-1 block text-sm text-ink-3">
                          {s.range} · ~{s.minutes} min
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-2">
                          {part && <StatusBadge status={part.status} />}
                          <CompletionMark partNumber={s.partNumber} />
                        </span>
                      </span>
                      <ArrowRightIcon className="mt-3 h-5 w-5 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          {summaries.length > 0 && <JourneyProgress parts={summaries} />}
          {unreviewed && (
            <div className="rounded-2xl border border-warn/30 bg-warn-bg p-5 text-sm leading-relaxed text-ink-2">
              <p className="font-semibold text-warn">Pilot drafts</p>
              <p className="mt-1">
                These Parts were drafted with AI assistance from named classical and modern tafsir, and are waiting for editorial
                and scholarly review. Every claim shows its source and its type.
              </p>
            </div>
          )}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs uppercase tracking-wider text-ink-3">Every statement is labelled</p>
            <ul className="mt-3 space-y-3">
              {CONTENT_CATEGORIES.map((c) => (
                <li key={c}>
                  <CategoryBadge category={c} />
                  <p className="mt-1 text-xs leading-relaxed text-ink-3">{CATEGORY[c].description}</p>
                </li>
              ))}
            </ul>
            <Link href="/about" className="mt-4 inline-block text-sm text-accent underline-offset-2 hover:underline">
              How this works
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
