"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { progressStore } from "@/lib/local-store";
import { ArrowRightIcon, CheckIcon } from "./icons";

export interface PartSummary {
  partNumber: number;
  title: string;
  href: string;
  range: string;
  minutes: number;
}

/** "Part X of Y" + continue. Returning after any gap feels the same as returning the next day (spec §4). */
export function JourneyProgress({ parts }: { parts: PartSummary[] }) {
  const progress = progressStore.useValue();
  const done = parts.filter((p) => progress.completed.includes(p.partNumber)).length;
  const isDone = (p: PartSummary) => progress.completed.includes(p.partNumber);
  const resume =
    parts.find((p) => p.partNumber === progress.lastVisited && !isDone(p)) ?? parts.find((p) => !isDone(p)) ?? null;
  const started = progress.completed.length > 0 || progress.lastVisited !== null;
  const pct = parts.length ? Math.round((done / parts.length) * 100) : 0;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-ink-3">Your journey</p>
      <p className="mt-2 font-serif text-2xl font-semibold">
        {done} <span className="text-base font-normal text-ink-3">of {parts.length} Parts complete</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      {resume ? (
        <Link
          href={resume.href}
          className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-accent px-4 py-3 text-accent-ink transition hover:opacity-90"
        >
          <span>
            <span className="block text-xs opacity-80">{started ? "Continue where you left off" : "Begin the journey"}</span>
            <span className="block font-semibold">
              Part {resume.partNumber}: {resume.title}
            </span>
          </span>
          <ArrowRightIcon className="h-5 w-5 shrink-0" />
        </Link>
      ) : (
        <p className="mt-5 text-sm text-ink-2">You have completed every Part available so far. More is on the way, in shā&apos; Allāh.</p>
      )}
      <p className="mt-3 text-xs text-ink-3">Progress is saved on this device only. No streaks, no pressure.</p>
    </div>
  );
}

export function CompletionMark({ partNumber }: { partNumber: number }) {
  const progress = progressStore.useValue();
  if (!progress.completed.includes(partNumber)) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
      <CheckIcon className="h-3.5 w-3.5" /> Completed
    </span>
  );
}

/** Remembers the last Part opened, so "Continue" resumes exactly there. */
export function TrackVisit({ partNumber }: { partNumber: number }) {
  useEffect(() => {
    const current = progressStore.read();
    if (current.lastVisited !== partNumber) progressStore.write({ ...current, lastVisited: partNumber });
  }, [partNumber]);
  return null;
}

export function CompleteButton({
  partNumber,
  next,
}: {
  partNumber: number;
  next: { partNumber: number; href: string } | null;
}) {
  const router = useRouter();
  const progress = progressStore.useValue();
  const done = progress.completed.includes(partNumber);

  const complete = () => {
    const completed = [...new Set([...progress.completed, partNumber])].sort((a, b) => a - b);
    progressStore.write({ completed, lastVisited: next?.partNumber ?? partNumber });
    router.push(next?.href ?? "/");
  };

  return (
    <button
      type="button"
      onClick={complete}
      className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-ink shadow-sm transition hover:opacity-90"
    >
      {done ? <CheckIcon className="h-4 w-4" /> : null}
      {done
        ? next
          ? `Completed · continue to Part ${next.partNumber}`
          : "Completed · back to the journey"
        : next
          ? `Mark complete & continue to Part ${next.partNumber}`
          : "Mark complete"}
      <ArrowRightIcon className="h-4 w-4" />
    </button>
  );
}
