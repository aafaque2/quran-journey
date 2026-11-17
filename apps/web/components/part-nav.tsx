"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePrefs } from "@/lib/prefs-client";
import { arrangeSections, depthInfo, DEPTHS, DIVIDER_ORDER, inDepth, type DepthId, type SectionId } from "@/lib/reading-prefs";
import { ChevronDownIcon, CloseIcon, ListIcon, PencilIcon, PlusIcon } from "./icons";
import { openSection } from "./section";
import { SectionOrderEditor } from "./section-order-editor";

export interface NavSection {
  id: SectionId;
  title: string;
  from: DepthId;
  /** CSS order before the boot script has run. */
  order: number;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The Part's section list: a sticky rail on wide screens, a sticky bar + sheet on phones. It follows
 * the reader's scroll, jumps smoothly to any section, and has the pencil that reorders sections.
 */
export function PartNav({ sections }: { sections: NavSection[] }) {
  const prefs = usePrefs();
  const { inDepth: shown, beyond } = arrangeSections(
    sections.map((s) => s.id),
    prefs.order,
    prefs.depth,
  );
  const visual = [...shown, ...beyond];
  const byId = new Map(sections.map((s) => [s.id, s]));
  const [active, setActive] = useState<SectionId | null>(null);
  const [editing, setEditing] = useState(false);
  const sheet = useRef<HTMLDialogElement>(null);

  // Scroll-spy: the active section is the last one whose top has passed the reading line.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = Math.min(window.innerHeight * 0.35, 280);
      let best: { id: SectionId; top: number } | null = null;
      for (const el of document.querySelectorAll<HTMLElement>("[data-sec]")) {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.top <= line && (!best || r.top > best.top)) best = { id: el.dataset.sec as SectionId, top: r.top };
      }
      setActive(best?.id ?? null);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [prefs.depth, prefs.order]);

  const go = useCallback(
    (id: SectionId) => {
      const target = document.getElementById(`sec-${id}`);
      if (!target) return;
      if (!inDepth(id, prefs.depth)) openSection(id);
      if (sheet.current?.open) sheet.current.close();
      setActive(id);
      // Two frames: let an opened section render before measuring where to scroll.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
          history.replaceState(null, "", `#sec-${id}`);
        }),
      );
    },
    [prefs.depth],
  );

  const position = active ? shown.indexOf(active) : -1;
  const progress = shown.length ? Math.max(0, position + 1) / shown.length : 0;
  const activeTitle = active ? byId.get(active)?.title : null;

  const editor = (prefix: string) => (
    <SectionOrderEditor
      key={`${prefs.depth}:${prefs.order.join()}`}
      idPrefix={prefix}
      sections={sections.map((s) => ({ id: s.id, title: s.title }))}
      depth={prefs.depth}
      order={prefs.order}
      onDone={() => setEditing(false)}
    />
  );

  return (
    <>
      {/* Wide screens: a sticky rail beside the text. */}
      <aside className="part-rail" aria-label="Sections of this Part">
        <div className="part-rail-inner">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{editing ? "Reorder sections" : "Sections"}</p>
            {!editing && (
              <button type="button" className="icon-btn h-8 w-8" onClick={() => setEditing(true)} aria-label="Reorder sections" title="Reorder sections">
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {editing ? editor("rail") : <TocList sections={byId} visual={visual} shownCount={shown.length} active={active} onGo={go} indicator />}
        </div>
      </aside>

      {/* Phones and tablets: a sticky bar that opens the same list in a sheet. */}
      <div className="part-bar">
        <button type="button" className="part-bar-button" onClick={() => sheet.current?.showModal()} aria-haspopup="dialog">
          <ListIcon className="h-4 w-4 shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1 truncate text-start">{activeTitle ?? "Sections"}</span>
          {position >= 0 && (
            <span className="shrink-0 text-xs tabular-nums text-ink-3">
              {position + 1} / {shown.length}
            </span>
          )}
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-ink-3" />
        </button>
        <span className="part-bar-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      </div>
      <dialog ref={sheet} className="sheet" aria-label="Sections of this Part" onClose={() => setEditing(false)}>
        <div className="sheet-panel">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{editing ? "Reorder sections" : "Sections"}</p>
            <div className="flex items-center gap-1">
              {!editing && (
                <button type="button" className="icon-btn" onClick={() => setEditing(true)} aria-label="Reorder sections">
                  <PencilIcon className="h-4 w-4" />
                </button>
              )}
              <button type="button" className="icon-btn" onClick={() => sheet.current?.close()} aria-label="Close">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          {editing ? editor("sheet") : <TocList sections={byId} visual={visual} shownCount={shown.length} active={active} onGo={go} />}
        </div>
      </dialog>
    </>
  );
}

function TocList({
  sections,
  visual,
  shownCount,
  active,
  onGo,
  indicator = false,
}: {
  sections: Map<SectionId, NavSection>;
  visual: SectionId[];
  shownCount: number;
  active: SectionId | null;
  onGo: (id: SectionId) => void;
  indicator?: boolean;
}) {
  const list = useRef<HTMLOListElement>(null);
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  const activeIndex = active ? visual.indexOf(active) : -1;
  const visualKey = visual.join();

  // The highlight slides to the active item (positions include CSS `order`, so they match what is seen).
  useLayoutEffect(() => {
    if (!indicator) return;
    const el = active ? list.current?.querySelector<HTMLElement>(`[data-toc="${active}"]`) : null;
    const next = el ? { top: el.offsetTop, height: el.offsetHeight } : null;
    setBar((prev) => (prev?.top === next?.top && prev?.height === next?.height ? prev : next));
  }, [active, indicator, visualKey]);

  // Hide the "go deeper" label for depths that leave nothing beyond them in this Part.
  const hideFor = DEPTHS.filter((d) => visual.every((id) => inDepth(id, d.id)))
    .map((d) => d.id)
    .join(" ");

  return (
    <ol ref={list} className="toc-list">
      {indicator && bar && <li className="toc-indicator" aria-hidden="true" style={{ transform: `translateY(${bar.top}px)`, height: bar.height }} />}
      {visual.map((id, i) => {
        const s = sections.get(id);
        if (!s) return null;
        return (
          <li
            key={id}
            data-toc={id}
            className="toc-item"
            data-from={s.from}
            data-active={active === id ? "" : undefined}
            data-passed={activeIndex > i && i < shownCount ? "" : undefined}
            style={{ order: `var(--qj-o-${id}, ${s.order})` }}
          >
            <a
              href={`#sec-${id}`}
              aria-current={active === id ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault();
                onGo(id);
              }}
            >
              <span className="toc-dot" aria-hidden="true" />
              <span className="min-w-0 flex-1">{s.title}</span>
              <PlusIcon className="toc-plus h-3.5 w-3.5 shrink-0" />
              <span className="sr-only toc-beyond-note"> (beyond {depthInfo(s.from).label})</span>
            </a>
          </li>
        );
      })}
      <li className="toc-deeper" aria-hidden="true" style={{ order: DIVIDER_ORDER }} data-hide-for={hideFor}>
        Go deeper
      </li>
    </ol>
  );
}
