"use client";

import { Fragment, type ReactNode } from "react";
import { usePrefs } from "@/lib/prefs-client";
import { arrangeSections, DEPTHS, DIVIDER_ORDER, type DepthId, type SectionId } from "@/lib/reading-prefs";
import { openSection } from "./section";

/**
 * The sections of a Part in the reader's order: those in their depth first, then a "go deeper"
 * divider, then the rest as collapsed cards. CSS `order` (set before first paint) already shows this;
 * re-ordering the DOM after hydration keeps keyboard and screen-reader order the same as what is seen.
 */
export function PartFlow({
  items,
  beyondCounts,
}: {
  items: { id: SectionId; node: ReactNode }[];
  /** How many of this Part's sections lie beyond each depth. */
  beyondCounts: Record<DepthId, number>;
}) {
  const prefs = usePrefs();
  const { inDepth, beyond } = arrangeSections(
    items.map((i) => i.id),
    prefs.order,
    prefs.depth,
  );
  const node = new Map(items.map((i) => [i.id, i.node]));

  return (
    <div className="part-flow">
      {inDepth.map((id) => (
        <Fragment key={id}>{node.get(id)}</Fragment>
      ))}
      <DeeperDivider counts={beyondCounts} />
      {beyond.map((id) => (
        <Fragment key={id}>{node.get(id)}</Fragment>
      ))}
    </div>
  );
}

function DeeperDivider({ counts }: { counts: Record<DepthId, number> }) {
  const hideFor = DEPTHS.filter((d) => counts[d.id] === 0)
    .map((d) => d.id)
    .join(" ");
  return (
    <div className="deeper" style={{ order: DIVIDER_ORDER }} data-hide-for={hideFor}>
      <div className="deeper-rule" aria-hidden="true" />
      <p className="deeper-title">Go deeper</p>
      {DEPTHS.map((d) =>
        counts[d.id] > 0 ? (
          <p key={d.id} data-show-depth={d.id} className="deeper-note">
            {counts[d.id] === 1 ? "One more section" : `${counts[d.id]} more sections`} beyond {d.label}. Open any of them, or change
            depth at the top of the page.
          </p>
        ) : null,
      )}
      <button type="button" className="deeper-open" onClick={() => openSection("*")}>
        Open them all
      </button>
    </div>
  );
}
