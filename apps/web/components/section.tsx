"use client";

import { useEffect, useState, type ReactNode } from "react";
import { depthInfo, type DepthId, type SectionId } from "@/lib/reading-prefs";
import { ChevronDownIcon } from "./icons";

const OPEN_SECTION_EVENT = "qj:open-section";

/** Opens a section that sits beyond the reader's depth ("*" opens all of them). */
export function openSection(id: SectionId | "*") {
  window.dispatchEvent(new CustomEvent<string>(OPEN_SECTION_EVENT, { detail: id }));
}

/**
 * One section of a Part. Whether it reads as a full section or as a collapsed "go deeper" card is
 * decided by CSS from the depth on <html>, so it is right from the first paint; React only remembers
 * whether the reader opened it. `kind` names the content type so readers always know what they read.
 */
export function PartSection({
  id,
  from,
  order,
  icon,
  title,
  kind,
  aside,
  hideHeading = false,
  children,
}: {
  id: SectionId;
  /** The shallowest depth that includes this section. */
  from: DepthId;
  /** CSS order before the boot script has run (the default depth and order). */
  order: number;
  icon: ReactNode;
  title: ReactNode;
  kind: string;
  /** Controls shown beside the heading (e.g. the verse display options). */
  aside?: ReactNode;
  /** For sections that bring their own visible heading (the continuity cards). */
  hideHeading?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const target = (e as CustomEvent<string>).detail;
      if (target === id || target === "*") setOpen(true);
    };
    window.addEventListener(OPEN_SECTION_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SECTION_EVENT, onOpen);
  }, [id]);

  return (
    <section
      id={`sec-${id}`}
      data-sec={id}
      data-from={from}
      data-open={open ? "" : undefined}
      aria-labelledby={`sec-${id}-title`}
      className="sec"
      style={{ order: `var(--qj-o-${id}, ${order})` }}
    >
      <div className={hideHeading ? "sec-head sec-head-hidden" : "sec-head"}>
        <span className="sec-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`sec-${id}-title`} className="font-serif text-xl font-semibold text-ink">
            {title}
          </h2>
          <p className="text-xs uppercase tracking-wider text-ink-3">
            {kind}
            <span className="sec-depth-note"> · part of {depthInfo(from).label}</span>
          </p>
        </div>
        {aside && <div className="sec-aside">{aside}</div>}
        <button
          type="button"
          className="sec-toggle"
          aria-expanded={open}
          aria-controls={`sec-${id}-body`}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide" : "Show"}
          <ChevronDownIcon className="sec-toggle-icon h-4 w-4" />
        </button>
      </div>
      <div id={`sec-${id}-body`} className="sec-body">
        {children}
      </div>
    </section>
  );
}
