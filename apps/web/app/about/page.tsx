import type { Metadata } from "next";
import { CONTENT_CATEGORIES, WORKFLOW } from "@quran-journey/schema";
import { CategoryBadge } from "@/components/badges";
import { getContent } from "@/lib/content";
import { CATEGORY, STATUS_LABEL } from "@/lib/format";

export const metadata: Metadata = { title: "How it works", description: "How Parts are built, labelled, sourced and reviewed." };

export default function AboutPage() {
  const { works, manifest } = getContent();
  const cited = [...works.values()].filter((w) => w.kind !== "quran");

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="text-sm font-medium text-gold">Method</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">How it works</h1>
      <p className="mt-5 text-lg leading-relaxed text-ink-2">
        We are not replacing tafsir. We are building a bridge to it. The Qur&apos;an is walked through in order, one meaningful
        passage at a time. Each Part shows the text, explains what is happening, brings in what named scholars say, and connects
        to the Part before and after it.
      </p>

      <section className="mt-14">
        <h2 className="font-serif text-2xl font-semibold">Five kinds of statement, never blended</h2>
        <p className="mt-3 leading-relaxed text-ink-2">
          The Qur&apos;an&apos;s Arabic text and the translation of its meaning are always shown separately. Everything else is labelled:
        </p>
        <ul className="mt-6 space-y-5">
          {CONTENT_CATEGORIES.map((c) => (
            <li key={c} className="claim" data-cat={c}>
              <CategoryBadge category={c} />
              <p className="mt-2 text-ink-2">{CATEGORY[c].description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="font-serif text-2xl font-semibold">How AI is (and isn&apos;t) used</h2>
        <ul className="mt-4 list-disc space-y-2 ps-5 leading-relaxed text-ink-2">
          <li>AI may help draft a Part, but only by reading and citing named sources. It is a drafting tool, never the authority.</li>
          <li>The Qur&apos;an text and translations are never written or changed by AI: they are copied verbatim from their publishers, and the build fails if a single byte changes.</li>
          <li>Every status change after drafting is made by a named person and recorded. Software cannot approve or publish anything.</li>
          <li>
            Parts touching belief, law, hadith, history or other faiths must pass a scholar&apos;s review before approval. Until then
            each Part shows its review status at the top.
          </li>
          <li>Where scholars differ, the views are shown side by side with who holds them. Where nothing is genuinely misunderstood, the &ldquo;misunderstandings&rdquo; section is simply left out.</li>
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="font-serif text-2xl font-semibold">Review workflow</h2>
        <ol className="mt-5 space-y-2">
          {WORKFLOW.map((s, i) => (
            <li key={s} className="flex items-baseline gap-3 text-ink-2">
              <span className="font-mono text-xs text-ink-3">{i + 1}</span>
              <span className="font-medium text-ink">{STATUS_LABEL[s]}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-ink-3">Any Part can be sent back as &ldquo;{STATUS_LABEL.NEEDS_REVISION}&rdquo; at any point, including after publication.</p>
      </section>

      <section id="sources" className="mt-14 scroll-mt-24">
        <h2 className="font-serif text-2xl font-semibold">Sources and permissions</h2>
        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wider text-ink-3">Qur&apos;an text and translation</h3>
        <ul className="mt-3 space-y-4">
          {manifest.datasets.map((d) => (
            <li key={d.id} className="text-sm leading-relaxed">
              <p className="font-semibold text-ink">
                {d.name}
                {d.version ? ` · v${d.version}` : ""}
              </p>
              <p className="text-ink-2">{d.publisher}</p>
              <p className="mt-1 text-ink-3">{d.license}</p>
              <a href={d.attributionUrl} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
                {d.attributionUrl}
              </a>
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-sm font-semibold uppercase tracking-wider text-ink-3">Works cited</h3>
        <ul className="mt-3 space-y-4">
          {cited.map((w) => (
            <li key={w.id} className="text-sm leading-relaxed">
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
              <p className="mt-1 text-ink-3">{w.rightsNote}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
