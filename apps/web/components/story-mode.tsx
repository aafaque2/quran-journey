"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StorySegment } from "@/lib/story";
import { CATEGORY, arabicDigits } from "@/lib/format";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, HeadphonesIcon, PauseIcon, PlayIcon } from "./icons";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** How long a screen stays up when no audio drives it: ~180 wpm for English, slower for Arabic. */
function durationMs(seg: StorySegment): number {
  if (seg.arabic) return Math.max(5000, words(seg.arabic) * 900 + 1500);
  const w = seg.lines.reduce((n, l) => n + words(l), 0);
  return Math.min(45000, Math.max(5000, (w / 3) * 1000 + 1500));
}

function audioUrl(template: string, surah: number, ayah: number) {
  return template
    .replaceAll("{surah3}", String(surah).padStart(3, "0"))
    .replaceAll("{ayah3}", String(ayah).padStart(3, "0"))
    .replaceAll("{surah}", String(surah))
    .replaceAll("{ayah}", String(ayah));
}

/**
 * "Listen & Understand" (product spec §9.3): the Part as a guided sequence. Recitation audio comes only
 * from a configured human reciter source, never synthesized; explanations are the Part's own reviewed text.
 */
export function StoryMode({ segments, title, audioTemplate }: { segments: StorySegment[]; title: string; audioTemplate: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const playButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const segment = segments[index];

  const phases = useMemo(() => {
    const seen = new Map<string, number>();
    segments.forEach((s, i) => {
      if (!seen.has(s.phase)) seen.set(s.phase, i);
    });
    return [...seen.entries()].map(([phase, start]) => ({ phase, start }));
  }, [segments]);

  const src = segment?.arabic && audioTemplate && segment.surah && segment.ayah ? audioUrl(audioTemplate, segment.surah, segment.ayah) : null;

  // Moves forward one screen; at the end, playback simply stops.
  const next = useCallback(() => {
    if (index >= segments.length - 1) setPlaying(false);
    else setIndex(index + 1);
  }, [index, segments.length]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Timed advance for screens without audio.
  useEffect(() => {
    if (!open || !playing || !segment || src) return;
    const t = window.setTimeout(next, durationMs(segment));
    return () => window.clearTimeout(t);
  }, [open, playing, segment, src, next]);

  // Recitation audio drives its own advance.
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    if (open && playing && src) {
      if (el.src !== src) el.src = src;
      el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  }, [open, playing, src]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " " && (e.target as HTMLElement | null)?.tagName !== "BUTTON") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev]);

  const start = useCallback(() => {
    setIndex(0);
    setOpen(true);
    setPlaying(true);
    if (!dialog.current?.open) dialog.current?.showModal();
    playButton.current?.focus(); // keyboard users land on play/pause, not the first phase chip
  }, []);
  const close = () => dialog.current?.close();

  // A shared link to /parts/N#listen opens straight into Story Mode.
  useEffect(() => {
    if (window.location.hash === "#listen") start();
  }, [start]);

  const currentPhase = segment?.phase;

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="group inline-flex items-center gap-3 rounded-full bg-ink px-5 py-3 text-paper shadow-sm transition hover:opacity-90"
      >
        <HeadphonesIcon className="h-5 w-5" />
        <span className="text-start leading-tight">
          <span className="block text-sm font-semibold">Listen &amp; Understand</span>
          <span className="block text-[0.7rem] opacity-70">Guided read-along · narration audio coming later</span>
        </span>
      </button>

      <dialog
        ref={dialog}
        className="story"
        onClose={() => {
          setOpen(false);
          setPlaying(false);
        }}
        aria-label={`Listen and understand: ${title}`}
      >
        <div className="flex h-full flex-col bg-[#14120e] text-[#efe9dd]">
          <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
            <p className="hidden min-w-0 flex-1 truncate font-serif text-sm opacity-80 sm:block">{title}</p>
            <nav aria-label="Phases" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto sm:flex-none">
              {phases.map((p) => (
                <button
                  key={p.phase}
                  type="button"
                  onClick={() => setIndex(p.start)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs transition ${
                    p.phase === currentPhase ? "bg-[#efe9dd] text-[#14120e]" : "bg-white/5 text-[#efe9dd]/70 hover:bg-white/10"
                  }`}
                >
                  {p.phase}
                </button>
              ))}
            </nav>
            <button type="button" onClick={close} className="shrink-0 rounded-full p-2 hover:bg-white/10" aria-label="Close and switch to reading">
              <CloseIcon className="h-5 w-5" />
            </button>
          </header>

          <main className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-8 sm:px-10">
            {segment && (
              <div key={index} className="fade-in w-full max-w-3xl text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-[#d4b26b]">
                  {segment.phase}
                  {segment.category && segment.phase !== "Recitation" ? ` · ${CATEGORY[segment.category].label}` : ""}
                </p>
                {segment.arabic ? (
                  <>
                    {segment.bismillah && (
                      <p className="mt-6 font-quran text-2xl leading-loose opacity-70" lang="ar" dir="rtl">
                        {segment.bismillah}
                      </p>
                    )}
                    <p className="mt-8 font-quran text-[2.1rem] leading-[2.3] sm:text-[2.6rem]" lang="ar" dir="rtl">
                      {segment.arabic}
                      <span className="ayah-mark">{arabicDigits(segment.ayah ?? 0)}</span>
                    </p>
                    {!audioTemplate && (
                      <p className="mt-6 text-xs opacity-60">Reciter audio isn&apos;t set up yet. Read along at your own pace.</p>
                    )}
                  </>
                ) : (
                  <div className="mt-6 space-y-5">
                    {segment.lines.map((line, i) => (
                      <p
                        key={i}
                        className={
                          i === 0
                            ? "font-serif text-xl leading-relaxed sm:text-2xl"
                            : "mx-auto max-w-2xl text-base leading-relaxed opacity-80"
                        }
                      >
                        {segment.phase === "Translation" && segment.ayah ? (
                          <span className="me-2 align-top text-xs text-[#d4b26b]">
                            {segment.surah}:{segment.ayah}
                          </span>
                        ) : null}
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>

          <footer className="border-t border-white/10 px-4 pb-6 pt-4 sm:px-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              <div className="flex gap-1" aria-hidden="true">
                {segments.map((_, i) => (
                  <span key={i} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-[#d4b26b]" : "bg-white/10"}`} />
                ))}
              </div>
              <div className="flex items-center justify-center gap-4">
                <button type="button" onClick={prev} disabled={index === 0} className="rounded-full p-3 hover:bg-white/10 disabled:opacity-30" aria-label="Previous">
                  <ChevronLeftIcon className="h-6 w-6" />
                </button>
                <button
                  ref={playButton}
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  className="grid h-14 w-14 place-items-center rounded-full bg-[#efe9dd] text-[#14120e] transition hover:opacity-90"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={index >= segments.length - 1}
                  className="rounded-full p-3 hover:bg-white/10 disabled:opacity-30"
                  aria-label="Next"
                >
                  <ChevronRightIcon className="h-6 w-6" />
                </button>
              </div>
              <button type="button" onClick={close} className="mx-auto text-xs opacity-60 underline-offset-2 hover:underline hover:opacity-90">
                Switch to reading
              </button>
            </div>
          </footer>
          <audio ref={audio} onEnded={next} preload="none" />
        </div>
      </dialog>
    </>
  );
}
