import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
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
  LinkIcon,
  ListIcon,
  MapIcon,
  OctagramIcon,
} from "@/components/icons";
import { PartFlow } from "@/components/part-flow";
import { PartNav } from "@/components/part-nav";
import { CompleteButton, TrackVisit } from "@/components/progress";
import { ReaderControls } from "@/components/reader-shell";
import { ReportIssue } from "@/components/report-issue";
import { ScholarList } from "@/components/scholars";
import { PartSection } from "@/components/section";
import { StoryMode } from "@/components/story-mode";
import { VerseList } from "@/components/verses";
import { DEFAULT_SECTION_ORDER, getPartView, partSections, visibleParts, worksUsed } from "@/lib/content";
import { surahName, verseRange } from "@/lib/format";
import { DEPTHS, inDepth, sectionInfo, type DepthId, type SectionId } from "@/lib/reading-prefs";
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

  const { part, surah, verses, prev, next, total, works, scripts, translations, minutes } = view;
  const name = surahName(part.surah, surah.tname);
  const range = verseRange(part.surah, part.startAyah, part.endAyah);
  const used = worksUsed(part, works);
  const story = buildStory(part, verses);
  const audioTemplate = process.env.NEXT_PUBLIC_RECITATION_URL_TEMPLATE || null;
  const present = partSections(part);
  const scholarNames = Object.fromEntries([...works.values()].map((w) => [w.id, w.shortTitle ?? w.title]));

  const frame = (id: SectionId, icon: ReactNode, kind: string, body: ReactNode, extra: { title?: ReactNode; aside?: ReactNode; hideHeading?: boolean } = {}) => (
    <PartSection
      id={id}
      from={sectionInfo(id).from}
      order={DEFAULT_SECTION_ORDER[id]}
      icon={icon}
      title={extra.title ?? sectionInfo(id).title}
      kind={kind}
      aside={extra.aside}
      hideHeading={extra.hideHeading}
    >
      {body}
    </PartSection>
  );

  const claims = (list: typeof part.context) => (
    <div className="space-y-10">
      {list.map((c) => (
        <ClaimBlock key={c.id} claim={c} works={works} />
      ))}
    </div>
  );

  const sections: Record<SectionId, () => ReactNode> = {
    previous: () =>
      part.connectionToPrevious &&
      frame(
        "previous",
        <LinkIcon className="h-4 w-4" />,
        "Continuity",
        <ContinuityCard
          direction="previous"
          href={prev ? `/parts/${prev.partNumber}` : null}
          label={prev ? `Coming from Part ${prev.partNumber}: ${prev.title}` : "Where we are"}
          claim={part.connectionToPrevious}
          works={works}
        />,
        { hideHeading: true },
      ),
    verses: () =>
      frame(
        "verses",
        <OctagramIcon className="h-4 w-4" />,
        `The Qur'an · ${surah.ename}`,
        <VerseList verses={verses} scripts={scripts} translations={translations} />,
        {
          title: (
            <span className="flex flex-wrap items-baseline gap-x-3">
              <span>
                {name} · {range}
              </span>
              <span className="font-quran text-2xl font-normal leading-normal text-gold" lang="ar" dir="rtl">
                {surah.name}
              </span>
            </span>
          ),
          aside: <ReaderControls />,
        },
      ),
    context: () => frame("context", <MapIcon className="h-4 w-4" />, "Context", claims(part.context)),
    summary: () => frame("summary", <CompassIcon className="h-4 w-4" />, "Editorial summary", <ClaimBlock claim={part.summary} works={works} />),
    scholars: () =>
      frame(
        "scholars",
        <BookIcon className="h-4 w-4" />,
        "Scholarly commentary",
        <ScholarList
          names={scholarNames}
          items={part.tafsirInsights.map((c) => ({
            id: c.id,
            works: [...new Set([...c.sources, ...(c.views ?? []).flatMap((v) => v.sources)].map((s) => s.work))],
            disagreement: c.category === "scholarly_disagreement",
            node: <ClaimBlock claim={c} works={works} />,
          }))}
        />,
      ),
    insights: () => frame("insights", <BulbIcon className="h-4 w-4" />, "Worth noticing", claims(part.keyInsights)),
    takeaways: () =>
      frame(
        "takeaways",
        <ListIcon className="h-4 w-4" />,
        "To remember",
        <ol className="space-y-4">
          {part.takeaways.map((t, i) => (
            <li key={t.id} className="flex gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft font-serif font-semibold text-accent">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-serif text-lg leading-snug text-ink">{t.text}</p>
                <div className="mt-2">
                  <CategoryBadge category={t.category} />
                </div>
                <SourceList sources={t.sources} works={works} />
              </div>
            </li>
          ))}
        </ol>,
      ),
    misunderstandings: () =>
      frame(
        "misunderstandings",
        <HelpIcon className="h-4 w-4" />,
        "Clarifications",
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
        </div>,
      ),
    reflect: () =>
      frame(
        "reflect",
        <FeatherIcon className="h-4 w-4" />,
        "Personal reflection · not tafsir",
        <div className="reflect-card rounded-2xl p-6 sm:p-8">
          <ul className="space-y-5">
            {part.reflectionQuestions.map((q) => (
              <li key={q} className="font-serif text-lg italic leading-relaxed text-ink">
                {q}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-ink-3">These prompts are for your own reflection. They are not tafsir and carry no religious authority.</p>
        </div>,
      ),
    next: () =>
      part.connectionToNext &&
      frame(
        "next",
        <LinkIcon className="h-4 w-4" />,
        "Continuity",
        <ContinuityCard
          direction="next"
          href={next ? `/parts/${next.partNumber}` : null}
          label={next ? `Next: Part ${next.partNumber} · ${next.title}` : "Where the journey goes next"}
          claim={part.connectionToNext}
          works={works}
        />,
        { hideHeading: true },
      ),
    why: () =>
      frame(
        "why",
        <LayersIcon className="h-4 w-4" />,
        "Segmentation",
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3">{BASIS_LABEL[part.segmentationRationale.basis]}</p>
          <p className="mt-2 leading-relaxed text-ink-2">{part.segmentationRationale.text}</p>
          <SourceList sources={part.segmentationRationale.sources} works={works} />
        </div>,
      ),
    sources: () =>
      frame(
        "sources",
        <LibraryIcon className="h-4 w-4" />,
        `${used.length} works cited`,
        <div>
          <ul className="space-y-4">
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
          <p className="mt-5 border-t border-line pt-4 text-xs text-ink-3">
            Qur&apos;an text and translations: see the credits at the foot of the page and on{" "}
            <Link href="/about#sources" className="underline underline-offset-2">
              sources &amp; method
            </Link>
            .
          </p>
        </div>,
      ),
  };

  const beyondCounts = Object.fromEntries(DEPTHS.map((d) => [d.id, present.filter((id) => !inDepth(id, d.id)).length])) as Record<DepthId, number>;
  const reportSections = present.map((id) => ({ value: id, label: sectionInfo(id).title }));

  return (
    <>
      <TrackVisit partNumber={part.partNumber} />
      <article className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {/* A. Orientation */}
        <header className="pt-8 sm:pt-12 lg:ps-[calc(14rem+3rem)]">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
            <Link href="/" className="hover:text-ink">
              Journey
            </Link>{" "}
            / Part {part.partNumber}
          </nav>
          <DraftBanner status={part.status} />
          <p className="mt-8 text-sm font-medium text-gold">
            Part {part.partNumber} of {total} · {name} {range}
            {DEPTHS.map((d) => (
              <span key={d.id} data-show-depth={d.id}>
                {" "}
                · ~{minutes[d.id]} min in {d.label}
              </span>
            ))}
          </p>
          <h1 className="mt-2 max-w-3xl font-serif text-3xl font-semibold leading-tight text-balance sm:text-5xl">{part.title}</h1>
          {part.subtitle && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">{part.subtitle}</p>}

          <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs uppercase tracking-wider text-ink-3">In this Part you will</p>
              <ul className="mt-3 space-y-2">
                {part.learningObjectives.map((o) => (
                  <li key={o} className="flex gap-2.5 text-ink-2">
                    <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-accent" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
            <StoryMode
              segments={story}
              title={`Part ${part.partNumber}: ${part.title}`}
              audioTemplate={audioTemplate}
              scripts={scripts.map((s) => s.id)}
              translations={translations.map((t) => ({ id: t.id, language: t.language, dir: t.dir }))}
            />
          </div>
        </header>

        <div className="part-layout mt-10 sm:mt-12">
          <PartNav sections={present.map((id) => ({ id, title: sectionInfo(id).title, from: sectionInfo(id).from, order: DEFAULT_SECTION_ORDER[id] }))} />
          <div className="min-w-0">
            <PartFlow items={present.map((id) => ({ id, node: sections[id]() }))} beyondCounts={beyondCounts} />

            <div className="mt-16 flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
              <CompleteButton partNumber={part.partNumber} next={next ? { partNumber: next.partNumber, href: `/parts/${next.partNumber}` } : null} />
              <ReportIssue partNumber={part.partNumber} sections={reportSections} />
            </div>

            <nav aria-label="Parts" className="mt-8 flex justify-between gap-4 text-sm">
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
        </div>
      </article>
    </>
  );
}
