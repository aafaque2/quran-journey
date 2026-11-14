import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONTENT_CATEGORIES, partIsSensitive, type Claim, type JourneyPart } from "@quran-journey/schema";
import { validateContent } from "@quran-journey/content";
import { StatusBadge } from "@/components/badges";
import { SourceList } from "@/components/citations";
import { ClaimBlock } from "@/components/claim";
import { getContent } from "@/lib/content";
import { CATEGORY, REPORT_LABEL, STATUS_LABEL, surahName, verseRange } from "@/lib/format";
import { listReports } from "@/lib/reports";

// Internal tool (implementation guide, milestone 3): deliberately plain. Never enable on a public deployment.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Internal review", robots: { index: false, follow: false } };

function claimsByField(part: JourneyPart): Array<{ field: string; claim: Claim }> {
  return [
    ...(part.connectionToPrevious ? [{ field: "connectionToPrevious", claim: part.connectionToPrevious }] : []),
    ...part.context.map((claim) => ({ field: "context", claim })),
    { field: "summary", claim: part.summary },
    ...part.tafsirInsights.map((claim) => ({ field: "tafsirInsights", claim })),
    ...part.keyInsights.map((claim) => ({ field: "keyInsights", claim })),
    ...part.takeaways.map((claim) => ({ field: "takeaways", claim })),
    ...part.commonMisunderstandings.map((m) => ({ field: "commonMisunderstandings", claim: m.clarification })),
    ...(part.connectionToNext ? [{ field: "connectionToNext", claim: part.connectionToNext }] : []),
  ];
}

export default async function InternalReviewPage() {
  if (process.env.INTERNAL_REVIEW !== "true") notFound();

  const content = getContent();
  const issues = validateContent(content);
  const reports = await listReports();
  const root = path.dirname(content.dir);

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold">Internal review</h1>
        <p className="mt-2 text-sm text-ink-2">Local only. Shows every Part regardless of status.</p>
        <div className="mt-4 rounded-xl border border-line bg-surface p-4 font-mono text-xs leading-relaxed text-ink-2">
          <p># edit content in content/parts/*.json, then refresh this page</p>
          <p>pnpm schema:validate</p>
          <p>pnpm content:status &lt;part&gt; &lt;STATUS&gt; --by &quot;Your Name&quot; --note &quot;…&quot;   # interactive terminal only</p>
          <p>git commit   # the review history lives in git</p>
        </div>
      </header>

      <section>
        <h2 className="font-serif text-xl font-semibold">Validation</h2>
        {issues.length === 0 ? (
          <p className="mt-3 text-sm text-accent">All content checks pass. Raw layer intact.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {issues.map((i, n) => (
              <li key={n} className={i.level === "error" ? "text-warn" : "text-ink-2"}>
                <span className="font-semibold uppercase">{i.level}</span> <span className="font-mono text-xs">{i.where}</span>: {i.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-serif text-xl font-semibold">Issue reports ({reports.length})</h2>
        {reports.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">No reports yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="rounded-xl border border-line bg-surface p-4 text-sm">
                <p className="font-semibold">
                  Part {r.input.partNumber} · {REPORT_LABEL[r.input.category]}
                  {r.input.section ? ` · ${r.input.section}` : ""} <span className="font-normal text-ink-3">· {r.status}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-ink-2">{r.input.message}</p>
                <p className="mt-2 font-mono text-xs text-ink-3">
                  {r.createdAt}
                  {r.input.contact ? ` · contact: ${r.input.contact}` : ""} · {r.id}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {content.parts.map((part) => {
        const file = content.partFiles.get(part.id);
        const items = claimsByField(part);
        return (
          <section key={part.id} className="space-y-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <header>
              <p className="font-mono text-xs text-ink-3">
                {part.id} · {file ? path.relative(root, file) : "?"}
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold">
                Part {part.partNumber}: {part.title}
              </h2>
              <p className="text-sm text-ink-2">
                {surahName(part.surah)} {verseRange(part.surah, part.startAyah, part.endAyah)} · {STATUS_LABEL[part.status]}
                {partIsSensitive(part) ? " · contains sensitive claims (scholar review required)" : ""}
              </p>
              <div className="mt-2">
                <StatusBadge status={part.status} />
              </div>
            </header>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-3">Review history</h3>
              <ol className="mt-2 space-y-1 font-mono text-xs text-ink-2">
                {part.review.history.map((e, i) => (
                  <li key={i}>
                    {e.at} · {e.actor}:{e.by} · {e.from ?? "∅"} → {e.to}
                    {e.note ? ` · ${e.note}` : ""}
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-3">Segmentation rationale ({part.segmentationRationale.basis})</h3>
              <p className="mt-2 text-sm text-ink-2">{part.segmentationRationale.text}</p>
              <SourceList sources={part.segmentationRationale.sources} works={content.works} />
            </div>

            {CONTENT_CATEGORIES.map((category) => {
              const group = items.filter((i) => i.claim.category === category);
              if (group.length === 0) return null;
              return (
                <div key={category}>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-3">
                    {CATEGORY[category].label} ({group.length})
                  </h3>
                  <div className="mt-3 space-y-6">
                    {group.map(({ field, claim }) => (
                      <div key={`${field}-${claim.id}`}>
                        <p className="mb-1 font-mono text-xs text-ink-3">{field}</p>
                        <ClaimBlock claim={claim} works={content.works} internal />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-3">Reflection questions</h3>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-ink-2">
                {part.reflectionQuestions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
