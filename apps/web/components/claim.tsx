import type { Claim, Work } from "@quran-journey/schema";
import { CategoryBadge } from "./badges";
import { SourceList } from "./citations";

/** One claim: category badge, text, attributed views (for disagreements) and its sources. */
export function ClaimBlock({
  claim,
  works,
  internal = false,
}: {
  claim: Claim;
  works: Map<string, Work>;
  /** Review tool only: show ids and sensitivity flags. */
  internal?: boolean;
}) {
  return (
    <div className="claim" data-cat={claim.category}>
      <CategoryBadge category={claim.category} />
      <p className="mt-2 leading-relaxed text-ink">{claim.text}</p>
      {claim.views && (
        <ol className="mt-4 space-y-4">
          {claim.views.map((view, i) => (
            <li key={i} className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">View {i + 1}</p>
              <p className="mt-1 font-semibold text-ink">{view.holder}</p>
              <p className="mt-1 leading-relaxed text-ink-2">{view.text}</p>
              <SourceList sources={view.sources} works={works} />
            </li>
          ))}
        </ol>
      )}
      <SourceList sources={claim.sources} works={works} />
      {internal && (
        <p className="mt-2 font-mono text-xs text-ink-3">
          #{claim.id}
          {claim.sensitive?.length ? ` · sensitive: ${claim.sensitive.join(", ")}` : ""}
        </p>
      )}
    </div>
  );
}
