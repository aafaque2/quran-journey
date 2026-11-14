import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/badges";
import { SourceList } from "@/components/citations";
import { ClaimBlock } from "@/components/claim";
import { ContinuityCard, DraftBanner } from "@/components/continuity";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookIcon,
  BulbIcon,
  CheckIcon,
  CompassIcon,
  FeatherIcon,
  HelpIcon,
  LayersIcon,
  LibraryIcon,
  ListIcon,
  MapIcon,
} from "@/components/icons";
import { CompleteButton, TrackVisit } from "@/components/progress";
import { ReaderControls, ReaderShell } from "@/components/reader-shell";
import { ReportIssue } from "@/components/report-issue";
import { Section } from "@/components/section";
import { StoryMode } from "@/components/story-mode";
import { VerseList } from "@/components/verses";
import { getPartView, visibleParts, worksUsed } from "@/lib/content";
import { surahName, verseRange } from "@/lib/format";
import { buildStory } from "@/lib/story";

export const dynamicParams = false;

export function generateStaticParams() {
  return visibleParts().map((p) => ({ partNumber: String(p.partNumber) }));
}

type Props = { params: Promise<{ partNumber: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { partNumber } = await params;
  const view = getPartView(Number(partNumber));
  if (!view) return {};
  return { title: `Part ${view.part.partNumber}: ${view.part.title}`, description: view.part.subtitle };
}

const BASIS_LABEL = {
  classical: "Boundary from classical scholarship",
  editorial: "Editorial boundary",
  classical_and_editorial: "Classical boundary, with an editorial choice",
} as const;

export default async function PartPage({ params }: Props) {
  const { partNumber } = await params;
  const view = getPartView(Number(partNumber));
  if (!view) notFound();

  const { part, surah, verses, prev, next, total, works, translation } = view;
  const name = surahName(part.surah, surah.tname);
  const range = verseRange(part.surah, part.startAyah, part.endAyah);
  const used = worksUsed(part, works);
  const story = buildStory(part, verses);
  const audioTemplate = process.env.NEXT_PUBLIC_RECITATION_URL_TEMPLATE || null;
  const sections = [
    { value: "quran-text", label: "Qur'an text" },
    { value: "translation", label: "Translation" },
    ...(part.context.length ? [{ value: "context", label: "Context" }] : []),
    { value: "summary", label: "What this passage is doing" },
    { value: "tafsir", label: "What the scholars explain" },
    ...(part.keyInsights.length ? [{ value: "insights", label: "Key insights" }] : []),
    { value: "takeaways", label: "Takeaways" },
    ...(part.commonMisunderstandings.length ? [{ value: "misunderstandings", label: "Common misunderstandings" }] : []),
    { value: "reflection", label: "Reflect" },
    { value: "continuity", label: "Connection to the previous / next Part" },
    { value: "segmentation", label: "Why this passage is one Part" },
    { value: "sources", label: "Sources" },
  ];

  return (
    <ReaderShell>
      <TrackVisit partNumber={part.partNumber} />
      <article className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        {/* A. Orientation */}
        <header className="pt-8 sm:pt-12">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
            <Link href="/" className="hover:text-ink">
              Journey
            </Link>{" "}
            / Part {part.partNumber}
          </nav>
          <DraftBanner status={part.status} />
          <p className="mt-8 text-sm font-medium text-gold">
            Part {part.partNumber} of {total} · {name} {range} · ~{part.estimatedMinutes} min
          </p>
          <h1 className="mt-2 max-w-3xl font-serif text-3xl font-semibold leading-tight text-balance sm:text-5xl">{part.title}</h1>
          {part.subtitle && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">{part.subtitle}</p>}

          <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs uppercase tracking-wider text-ink-3">In this Part</p>
              <ul className="mt-3 space-y-2">
                {part.learningObjectives.map((o) => (
                  <li key={o} className="flex gap-2.5 text-ink-2">
                    <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-accent" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
            <StoryMode segments={story} title={`Part ${part.partNumber}: ${part.title}`} audioTemplate={audioTemplate} />
          </div>
        </header>

        <div className="mt-12 space-y-16">
          {part.connectionToPrevious && (
            <ContinuityCard
              direction="previous"
              href={prev ? `/parts/${prev.partNumber}` : null}
              label={prev ? `Coming from Part ${prev.partNumber}: ${prev.title}` : "Where we are"}
              claim={part.connectionToPrevious}
              works={works}
            />
          )}

          {/* B. The Qur'an */}
          <section id="quran" aria-labelledby="quran-title" className="scroll-mt-24">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h2 id="quran-title" className="font-serif text-xl font-semibold">
                    {name} · {range}
                  </h2>
                  <span className="font-quran text-2xl leading-normal text-gold" lang="ar" dir="rtl">
                    {surah.name}
                  </span>
                </div>
                <p className="text-xs uppercase tracking-wider text-ink-3">{surah.ename}</p>
              </div>
              <ReaderControls />
            </div>
            <VerseList verses={verses} translationName={translation?.name ?? "translation"} />
          </section>

          {part.context.length > 0 && (
            <Section id="context" icon={<MapIcon className="h-4 w-4" />} title="What is happening here" kind="Context">
              <div className="space-y-10">
                {part.context.map((c) => (
                  <ClaimBlock key={c.id} claim={c} works={works} />
                ))}
              </div>
            </Section>
          )}

          <Section id="summary" icon={<CompassIcon className="h-4 w-4" />} title="What this passage is doing" kind="Editorial summary">
            <ClaimBlock claim={part.summary} works={works} />
          </Section>

          <Section id="tafsir" icon={<BookIcon className="h-4 w-4" />} title="What the scholars explain" kind="Scholarly commentary">
            <div className="space-y-10">
              {part.tafsirInsights.map((c) => (
                <ClaimBlock key={c.id} claim={c} works={works} />
              ))}
            </div>
          </Section>

          {part.keyInsights.length > 0 && (
            <Section id="insights" icon={<BulbIcon className="h-4 w-4" />} title="Key insights" kind="Worth noticing">
              <div className="space-y-10">
                {part.keyInsights.map((c) => (
                  <ClaimBlock key={c.id} claim={c} works={works} />
                ))}
              </div>
            </Section>
          )}

          <Section id="takeaways" icon={<ListIcon className="h-4 w-4" />} title="Takeaways" kind="To remember">
            <ol className="space-y-4">
              {part.takeaways.map((t, i) => (
                <li key={t.id} className="flex gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft font-serif font-semibold text-accent">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-serif text-lg leading-snug text-ink">{t.text}</p>
                    <div className="mt-2">
                      <CategoryBadge category={t.category} />
                    </div>
                    <SourceList sources={t.sources} works={works} />
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {part.commonMisunderstandings.length > 0 && (
            <Section id="misunderstandings" icon={<HelpIcon className="h-4 w-4" />} title="Common misunderstandings" kind="Clarifications">
              <div className="space-y-10">
                {part.commonMisunderstandings.map((m) => (
                  <div key={m.id} className="space-y-4">
                    <div className="rounded-2xl border border-line bg-surface-2 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">A common misreading</p>
                      <p className="mt-1 font-serif text-lg italic text-ink-2">&ldquo;{m.misreading}&rdquo;</p>
                      <p className="mt-3 text-xs text-ink-3">Identified as a misreading by:</p>
                      <SourceList sources={m.addressedBy} works={works} />
                    </div>
                    <ClaimBlock claim={m.clarification} works={works} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section id="reflect" icon={<FeatherIcon className="h-4 w-4" />} title="Reflect" kind="Personal reflection · not tafsir">
            <div className="reflect-card rounded-2xl p-6 sm:p-8">
              <ul className="space-y-5">
                {part.reflectionQuestions.map((q) => (
                  <li key={q} className="font-serif text-lg italic leading-relaxed text-ink">
                    {q}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-ink-3">
                These prompts are for your own reflection. They are not tafsir and carry no religious authority.
              </p>
            </div>
          </Section>

          {part.connectionToNext && (
            <ContinuityCard
              direction="next"
              href={next ? `/parts/${next.partNumber}` : null}
              label={next ? `Next: Part ${next.partNumber} · ${next.title}` : "Where the journey goes next"}
              claim={part.connectionToNext}
              works={works}
            />
          )}

          <div className="space-y-4">
            <details id="segmentation" className="group rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <summary className="flex cursor-pointer list-none items-center gap-3 font-serif text-lg font-semibold">
                <LayersIcon className="h-5 w-5 text-ink-3" /> Why this passage is one Part
              </summary>
              <p className="mt-4 text-xs uppercase tracking-wider text-ink-3">{BASIS_LABEL[part.segmentationRationale.basis]}</p>
              <p className="mt-2 leading-relaxed text-ink-2">{part.segmentationRationale.text}</p>
              <SourceList sources={part.segmentationRationale.sources} works={works} />
            </details>

            <details id="sources" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <summary className="flex cursor-pointer list-none items-center gap-3 font-serif text-lg font-semibold">
                <LibraryIcon className="h-5 w-5 text-ink-3" /> Sources used in this Part ({used.length})
              </summary>
              <ul className="mt-4 space-y-4">
                {used.map((w) => (
                  <li key={w.id} className="text-sm">
                    <p className="font-semibold text-ink">
                      {w.title}
                      {w.titleOriginal && (
                        <span className="ms-2 font-quran text-base font-normal" lang="ar" dir="rtl">
                          {w.titleOriginal}
                        </span>
                      )}
                    </p>
                    <p className="text-ink-2">
                      {w.author}
                      {w.authorDied ? ` (d. ${w.authorDied})` : ""}
                    </p>
                    <p className="mt-1 text-xs text-ink-3">{w.rightsNote}</p>
                  </li>
                ))}
              </ul>
              {translation && (
                <p className="mt-5 border-t border-line pt-4 text-xs text-ink-3">
                  {translation.attribution}.{" "}
                  <a href={translation.attributionUrl} className="underline underline-offset-2" target="_blank" rel="noreferrer">
                    Source
                  </a>
                </p>
              )}
            </details>
          </div>

          <div className="flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
            <CompleteButton partNumber={part.partNumber} next={next ? { partNumber: next.partNumber, href: `/parts/${next.partNumber}` } : null} />
            <ReportIssue partNumber={part.partNumber} sections={sections} />
          </div>

          <nav aria-label="Parts" className="flex justify-between gap-4 text-sm">
            {prev ? (
              <Link href={`/parts/${prev.partNumber}`} className="inline-flex items-center gap-2 text-ink-2 hover:text-ink">
                <ArrowLeftIcon className="h-4 w-4" /> Part {prev.partNumber}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/parts/${next.partNumber}`} className="inline-flex items-center gap-2 text-ink-2 hover:text-ink">
                Part {next.partNumber} <ArrowRightIcon className="h-4 w-4" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </div>
      </article>
    </ReaderShell>
  );
}
