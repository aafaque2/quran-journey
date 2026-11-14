import Link from "next/link";
import type { Claim, PartStatus, Work } from "@quran-journey/schema";
import { STATUS_LABEL } from "@/lib/format";
import { ClaimBlock } from "./claim";
import { AlertIcon, LinkIcon } from "./icons";

/** The explicit connection to the previous / next Part: the product's core differentiator (spec §3). */
export function ContinuityCard({
  direction,
  href,
  label,
  claim,
  works,
}: {
  direction: "previous" | "next";
  href: string | null;
  label: string;
  claim: Claim;
  works: Map<string, Work>;
}) {
  return (
    <aside
      className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6"
      aria-label={direction === "previous" ? "Connection to the previous Part" : "Connection to what comes next"}
    >
      <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink-3">
        <LinkIcon className="h-4 w-4" />
        {direction === "previous" ? "Continuity" : "What comes next"}
      </p>
      <p className="mt-2 font-serif text-lg font-semibold">
        {href ? (
          <Link href={href} className="underline-offset-4 hover:underline">
            {label}
          </Link>
        ) : (
          label
        )}
      </p>
      <div className="mt-4">
        <ClaimBlock claim={claim} works={works} />
      </div>
    </aside>
  );
}

const STATUS_NOTE: Partial<Record<PartStatus, string>> = {
  DRAFT: "This Part is an early draft and has not been reviewed.",
  AI_GENERATED:
    "This Part was drafted with AI assistance from the named sources and has not yet been checked by an editor or a scholar. Treat it as a pilot draft, check the sources, and please report anything that looks wrong.",
  SOURCE_CHECKED: "Its sources have been checked by a person; editorial review is still in progress. It has not been reviewed by a scholar.",
  EDITOR_REVIEW: "It is in editorial review. It has not yet been reviewed by a scholar.",
  SCHOLAR_REVIEW: "It is being reviewed by a scholar.",
  APPROVED: "It has been approved and is awaiting publication.",
  NEEDS_REVISION: "It has been flagged for revision; some of it may change.",
};

export function DraftBanner({ status }: { status: PartStatus }) {
  if (status === "PUBLISHED") return null;
  return (
    <div role="note" className="mt-5 flex gap-3 rounded-xl border border-warn/30 bg-warn-bg p-4 text-sm">
      <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
      <div>
        <p className="font-semibold text-warn">Review status: {STATUS_LABEL[status]}</p>
        <p className="mt-1 leading-relaxed text-ink-2">{STATUS_NOTE[status]}</p>
      </div>
    </div>
  );
}
