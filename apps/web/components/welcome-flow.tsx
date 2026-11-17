"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Catalog } from "@/lib/content";
import { chosenScript, chosenTranslations, setPrefs, usePrefs } from "@/lib/prefs-client";
import { depthInfo, THEMES, type DepthId, type Theme } from "@/lib/reading-prefs";
import { DepthPicker, ScholarPicker, ScriptPicker, ThemePicker, TranslationPicker } from "./choices";
import { ArrowLeftIcon, ArrowRightIcon, OctagramIcon } from "./icons";

const STEPS = ["intro", "depth", "script", "translations", "scholars", "theme", "done"] as const;
type Step = (typeof STEPS)[number];
const QUESTIONS: Step[] = ["depth", "script", "translations", "scholars", "theme"];
/** Long enough to see the choice land, short enough not to feel like waiting. */
const ADVANCE_MS = 280;

/**
 * First-visit setup: one question per card. A single choice moves on by itself; multiple choices
 * have a Next button; Back revisits any answer. Every answer is saved as it is made, so leaving
 * half-way loses nothing, and all of it can be changed later in Settings.
 */
/** Where to go afterwards: a same-site path from ?next=, never another origin. */
function nextPath(): string | null {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export function WelcomeFlow({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => setNext(nextPath()), []);
  const prefs = usePrefs();
  const [step, setStep] = useState<Step>("intro");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [answered, setAnswered] = useState<ReadonlySet<Step>>(new Set());
  const heading = useRef<HTMLHeadingElement>(null);
  const advance = useRef<number | undefined>(undefined);
  const firstRender = useRef(true);

  const scriptIds = catalog.scripts.map((s) => s.id);
  const translationIds = catalog.translations.map((t) => t.id);
  const index = STEPS.indexOf(step);
  const questionNumber = QUESTIONS.indexOf(step);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step]);
  useEffect(() => () => window.clearTimeout(advance.current), []);

  // Reaching the end counts as finishing the setup, even if the reader never presses a button.
  useEffect(() => {
    if (step === "done" && !prefs.onboarded) setPrefs({ onboarded: true });
  }, [step, prefs.onboarded]);

  const goTo = (target: Step) => {
    window.clearTimeout(advance.current);
    setDirection(STEPS.indexOf(target) < index ? "back" : "forward");
    setStep(target);
  };
  const forward = () => goTo(STEPS[index + 1] ?? "done");
  const back = () => goTo(STEPS[index - 1] ?? "intro");
  const answer = (s: Step) => setAnswered((prev) => new Set(prev).add(s));
  const chooseAndAdvance = (s: Step, apply: () => void) => {
    apply();
    answer(s);
    const target = STEPS[STEPS.indexOf(s) + 1] ?? "done";
    window.clearTimeout(advance.current);
    advance.current = window.setTimeout(() => {
      setDirection("forward");
      setStep(target);
    }, ADVANCE_MS);
  };
  const skip = () => {
    setPrefs({ onboarded: true });
    router.push(next ?? "/");
  };

  const translations = chosenTranslations(prefs, translationIds);
  const script = chosenScript(prefs, scriptIds);
  const start = next ?? (catalog.firstPart ? `/parts/${catalog.firstPart.partNumber}` : "/");
  const startLabel = next
    ? "Continue where you were"
    : catalog.firstPart
      ? `Begin with Part ${catalog.firstPart.partNumber}: ${catalog.firstPart.title}`
      : "Go to the journey";

  return (
    <div className="welcome" data-focus-page>
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-4 pt-5 sm:pt-8">
        {step !== "intro" && step !== "done" ? (
          <button type="button" onClick={back} className="welcome-link">
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </button>
        ) : (
          <span />
        )}
        {questionNumber >= 0 && (
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {QUESTIONS.map((q, i) => (
              <span key={q} className="welcome-dot" data-state={i < questionNumber ? "done" : i === questionNumber ? "current" : undefined} />
            ))}
          </div>
        )}
        {step !== "done" ? (
          <button type="button" onClick={skip} className="welcome-link">
            Skip
          </button>
        ) : (
          <span />
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {questionNumber >= 0 ? `Question ${questionNumber + 1} of ${QUESTIONS.length}` : ""}
      </p>

      <div className="flex flex-1 justify-center px-4 pb-16 pt-8 sm:pt-12">
        <div key={step} className="welcome-card w-full max-w-xl" data-direction={direction}>
          {step === "intro" && (
            <Card
              headingRef={heading}
              eyebrow={
                <span className="inline-flex items-center gap-2">
                  <OctagramIcon className="h-4 w-4" /> Assalamu alaykum
                </span>
              }
              title="Let’s set up your journey"
              lead="Five quick choices so every Part fits the way you read: how deep to go, your script and translations, whose explanations come first, and light or dark. About a minute, and all of it can be changed later in Settings."
            >
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button type="button" onClick={forward} className="btn-primary">
                  Let’s begin <ArrowRightIcon className="h-4 w-4" />
                </button>
                <button type="button" onClick={skip} className="welcome-link justify-center">
                  Skip and use the recommended settings
                </button>
              </div>
            </Card>
          )}

          {step === "depth" && (
            <Card
              headingRef={heading}
              eyebrow={`Question 1 of ${QUESTIONS.length}`}
              title="How would you like to go through each Part?"
              lead="You can switch at any time from the top of every page. Nothing is hidden: sections outside your choice stay one tap away."
            >
              <DepthPicker
                depths={catalog.depths}
                value={answered.has("depth") ? prefs.depth : null}
                onChange={(depth: DepthId) => chooseAndAdvance("depth", () => setPrefs({ depth }))}
              />
              {answered.has("depth") && <NextButton onClick={forward} />}
            </Card>
          )}

          {step === "script" && (
            <Card
              headingRef={heading}
              eyebrow={`Question 2 of ${QUESTIONS.length}`}
              title="Which Arabic script would you like?"
              lead="Both are the same Qur’an text from the Tanzil Project, letter for letter in its own spelling. You can also hide the Arabic, or change its size, while reading."
            >
              <ScriptPicker
                scripts={catalog.scripts}
                value={answered.has("script") ? script : null}
                onChange={(id) => chooseAndAdvance("script", () => setPrefs({ script: id }))}
              />
              {answered.has("script") && <NextButton onClick={forward} />}
            </Card>
          )}

          {step === "translations" && (
            <Card
              headingRef={heading}
              eyebrow={`Question 3 of ${QUESTIONS.length}`}
              title="Which translations would you like?"
              lead="Choose one or more. They appear in the order you pick them, and the first is used in Listen & Understand. The explanations themselves are in English for now."
            >
              <TranslationPicker
                translations={catalog.translations}
                value={translations}
                onChange={(ids) => {
                  setPrefs({ translations: ids });
                  answer("translations");
                }}
              />
              <NextButton onClick={forward} />
            </Card>
          )}

          {step === "scholars" && (
            <Card
              headingRef={heading}
              eyebrow={`Question 4 of ${QUESTIONS.length}`}
              title="Whose explanations should come first?"
              lead="Each Part draws on several tafsirs. Your choice only changes what comes first: the others stay one tap away, and where scholars differ you always see every view."
            >
              <ScholarPicker
                scholars={catalog.scholars}
                value={prefs.scholars}
                onChange={(ids) => {
                  setPrefs({ scholars: ids });
                  answer("scholars");
                }}
              />
              <NextButton onClick={forward} />
            </Card>
          )}

          {step === "theme" && (
            <Card
              headingRef={heading}
              eyebrow={`Question 5 of ${QUESTIONS.length}`}
              title="Light or dark?"
              lead="It changes straight away. The sun and moon button at the top switches it whenever you like."
            >
              <ThemePicker
                value={answered.has("theme") ? prefs.theme : null}
                onChange={(theme: Theme) => chooseAndAdvance("theme", () => setPrefs({ theme }))}
              />
              {answered.has("theme") && <NextButton onClick={forward} />}
            </Card>
          )}

          {step === "done" && (
            <Card headingRef={heading} eyebrow="All set" title="Your journey is ready" lead="Here is how each Part will open for you. Change anything now, or later in Settings.">
              <dl className="summary">
                <SummaryRow label="Depth" value={depthInfo(prefs.depth).label} onChange={() => goTo("depth")} />
                <SummaryRow
                  label="Arabic script"
                  value={catalog.scripts.find((s) => s.id === script)?.label ?? ""}
                  onChange={() => goTo("script")}
                />
                <SummaryRow
                  label={translations.length > 1 ? "Translations" : "Translation"}
                  value={translations.map((id) => catalog.translations.find((t) => t.id === id)?.label).join(", ")}
                  onChange={() => goTo("translations")}
                />
                <SummaryRow
                  label="Scholars first"
                  value={
                    prefs.scholars
                      ? prefs.scholars.map((id) => catalog.scholars.find((s) => s.id === id)?.shortTitle).join(", ")
                      : "All scholars equally"
                  }
                  onChange={() => goTo("scholars")}
                />
                <SummaryRow label="Appearance" value={THEMES.find((t) => t.id === prefs.theme)?.label ?? ""} onChange={() => goTo("theme")} />
              </dl>
              <div className="mt-8 flex flex-col gap-3">
                <Link href={start} className="btn-primary justify-between">
                  <span className="truncate">{startLabel}</span> <ArrowRightIcon className="h-4 w-4 shrink-0" />
                </Link>
                {start !== "/" && (
                  <Link href="/" className="welcome-link justify-center">
                    See the whole journey first
                  </Link>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({
  headingRef,
  eyebrow,
  title,
  lead,
  children,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  eyebrow: ReactNode;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby="welcome-title">
      <p className="text-sm font-medium text-gold">{eyebrow}</p>
      <h1 id="welcome-title" ref={headingRef} tabIndex={-1} className="mt-2 font-serif text-3xl font-semibold leading-tight text-balance outline-none sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 leading-relaxed text-ink-2">{lead}</p>
      <div className="mt-7">{children}</div>
    </section>
  );
}

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="mt-6 flex justify-end">
      <button type="button" onClick={onClick} className="btn-primary">
        Next <ArrowRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function SummaryRow({ label, value, onChange }: { label: string; value: string; onChange: () => void }) {
  return (
    <div className="summary-row">
      <dt className="text-xs uppercase tracking-wider text-ink-3">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium break-words text-ink">{value}</dd>
      <button type="button" onClick={onChange} className="text-sm text-accent underline-offset-2 hover:underline">
        Change
      </button>
    </div>
  );
}
