import { z } from "zod";
import {
  Claim,
  ContentCategory,
  Misunderstanding,
  SegmentationRationale,
  type Claim as ClaimT,
} from "./claims";
import { AI_SETTABLE, PartStatus, canTransition } from "./status";

/** One status change in a Part's life. Layer: editorial metadata. Internal (review tool only). */
export const ReviewEvent = z.object({
  at: z.iso.datetime(),
  /** A person's name, or the model/tool id for automated drafting. */
  by: z.string().min(1),
  actor: z.enum(["ai", "human"]),
  /** null only for the creation event. */
  from: PartStatus.nullable(),
  to: PartStatus,
  note: z.string().optional(),
});
export type ReviewEvent = z.infer<typeof ReviewEvent>;

/** Layer: editorial metadata. Internal. */
export const Review = z.object({
  /** Model/tool that drafted the Part, if any. Required once AI_GENERATED appears in history. */
  generatedBy: z.string().optional(),
  history: z.array(ReviewEvent).min(1),
});
export type Review = z.infer<typeof Review>;

export const STORY_PHASES = [
  "recitation",
  "translation",
  "context",
  "explanation",
  "insights",
  "takeaways",
  "misunderstandings",
  "reflection",
] as const;

/** Approved narration script for Story Mode (product spec §9.3). Layer: editorial. User-visible (heard/read). */
export const NarrationSegment = z.object({
  phase: z.enum(STORY_PHASES),
  text: z.string().min(1),
});

const ALLOWED: Record<string, readonly ContentCategory[]> = {
  summary: ["editorial_synthesis"],
  context: ["established", "scholarly_interpretation", "scholarly_disagreement", "editorial_synthesis"],
  connection: ["established", "scholarly_interpretation", "editorial_synthesis"],
  tafsirInsights: ["scholarly_interpretation", "scholarly_disagreement"],
  keyInsights: ["established", "scholarly_interpretation", "scholarly_disagreement", "editorial_synthesis"],
  takeaways: ["established", "editorial_synthesis"],
  clarification: ["established", "scholarly_interpretation", "scholarly_disagreement", "editorial_synthesis"],
};

/**
 * The fundamental product unit (product spec §8). Verse text is never stored here: the Part points
 * at the raw layer by surah + ayah range (AGENTS.md rule 1), and the app joins them at load time.
 */
export const JourneyPart = z
  .object({
    schemaVersion: z.literal(1),
    /** Stable id ("part-0001"). Editorial; internal. */
    id: z.string().regex(/^part-\d{4}$/),
    /** Position in the journey ("Part 2"). Editorial; user-visible. */
    partNumber: z.number().int().positive(),
    /** Pointer into the raw layer. Editorial; user-visible as the verse range. */
    surah: z.number().int().min(1).max(114),
    startAyah: z.number().int().min(1),
    endAyah: z.number().int().min(1),
    /** Editorial; user-visible. */
    title: z.string().min(3).max(90),
    /** Editorial; user-visible. */
    subtitle: z.string().max(200).optional(),
    /** Editorial; user-visible ("~12 min"). */
    estimatedMinutes: z.number().int().min(1).max(60),
    /** "In this Part you will…". Editorial; user-visible. */
    learningObjectives: z.array(z.string().min(5)).min(1).max(4),
    /** Plain-language "what is this passage doing". Editorial synthesis; user-visible. */
    summary: Claim,
    /** What is happening and why here. Editorial; user-visible. */
    context: z.array(Claim),
    /** Continuity with the previous Part (null only for Part 1). Editorial; user-visible. */
    connectionToPrevious: Claim.nullable(),
    /** Continuity with what comes next. Editorial; user-visible. */
    connectionToNext: Claim.nullable(),
    /** Concise, sourced tafsir insights — never a raw dump. Editorial; user-visible. */
    tafsirInsights: z.array(Claim).min(1),
    /** The "I never noticed that" layer. Editorial; user-visible. */
    keyInsights: z.array(Claim),
    /** 3–5 short items for memory and practice. Editorial; user-visible. */
    takeaways: z.array(Claim).min(3).max(5),
    /** AGENTS.md rule 4: [] is valid, expected and common. Editorial; user-visible only when non-empty. */
    commonMisunderstandings: z.array(Misunderstanding),
    /** Personal, explicitly non-authoritative prompts. Editorial (reflection); user-visible. */
    reflectionQuestions: z.array(z.string().min(10)).min(1).max(4),
    /** AGENTS.md rule 5. Editorial; user-visible. */
    segmentationRationale: SegmentationRationale,
    /** Optional approved narration; Story Mode reads the Part's own sections when null. Editorial; user-visible. */
    audioScript: z.array(NarrationSegment).nullable(),
    /** AGENTS.md rule 6. Editorial metadata; user-visible as a badge. */
    status: PartStatus,
    /** Editorial metadata; internal. */
    review: Review,
  })
  .superRefine((part, ctx) => {
    if (part.endAyah < part.startAyah)
      ctx.addIssue({ code: "custom", path: ["endAyah"], message: "endAyah must be >= startAyah" });

    // Category constraints per field (AGENTS.md rule 3).
    const check = (claim: ClaimT, kind: keyof typeof ALLOWED, path: (string | number)[]) => {
      const allowed = ALLOWED[kind] ?? [];
      if (!allowed.includes(claim.category))
        ctx.addIssue({
          code: "custom",
          path: [...path, "category"],
          message: `${kind} may only be ${allowed.join(" | ")} (got ${claim.category})`,
        });
    };
    check(part.summary, "summary", ["summary"]);
    part.context.forEach((c, i) => check(c, "context", ["context", i]));
    if (part.connectionToPrevious) check(part.connectionToPrevious, "connection", ["connectionToPrevious"]);
    if (part.connectionToNext) check(part.connectionToNext, "connection", ["connectionToNext"]);
    part.tafsirInsights.forEach((c, i) => check(c, "tafsirInsights", ["tafsirInsights", i]));
    part.keyInsights.forEach((c, i) => check(c, "keyInsights", ["keyInsights", i]));
    part.takeaways.forEach((c, i) => {
      check(c, "takeaways", ["takeaways", i]);
      if (c.text.length > 200)
        ctx.addIssue({ code: "custom", path: ["takeaways", i, "text"], message: "takeaways must be short (<= 200 chars)" });
    });
    part.commonMisunderstandings.forEach((m, i) =>
      check(m.clarification, "clarification", ["commonMisunderstandings", i, "clarification"]),
    );

    // Claim ids are unique within a Part (reports and review notes point at them).
    const ids = allClaims(part).map((c) => c.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length)
      ctx.addIssue({ code: "custom", path: ["id"], message: `duplicate claim ids: ${[...new Set(dupes)].join(", ")}` });

    // Review history must be a legal, gap-free chain ending at the current status (AGENTS.md rule 6).
    const history = part.review.history;
    history.forEach((ev, i) => {
      const prev = history[i - 1];
      if (i === 0) {
        if (ev.from !== null)
          ctx.addIssue({ code: "custom", path: ["review", "history", 0, "from"], message: "the first event must have from: null" });
      } else if (prev && ev.from !== prev.to) {
        ctx.addIssue({
          code: "custom",
          path: ["review", "history", i, "from"],
          message: `event ${i} starts from ${ev.from} but the previous event ended at ${prev.to}`,
        });
      } else if (ev.from && !canTransition(ev.from, ev.to)) {
        ctx.addIssue({
          code: "custom",
          path: ["review", "history", i],
          message: `illegal transition ${ev.from} -> ${ev.to}`,
        });
      }
      if (ev.actor === "ai" && !AI_SETTABLE.includes(ev.to))
        ctx.addIssue({
          code: "custom",
          path: ["review", "history", i, "actor"],
          message: `an AI actor may not set ${ev.to}; only a named human can`,
        });
    });
    const last = history[history.length - 1];
    if (last && last.to !== part.status)
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: `status is ${part.status} but the review history ends at ${last.to}`,
      });
    if (history.some((ev) => ev.to === "AI_GENERATED") && !part.review.generatedBy)
      ctx.addIssue({ code: "custom", path: ["review", "generatedBy"], message: "AI-generated content must record generatedBy" });

    // Sensitive content needs a scholar's sign-off before it can be approved (product spec §7.5).
    if ((part.status === "APPROVED" || part.status === "PUBLISHED") && partIsSensitive(part)) {
      const lastRevision = history.map((e) => e.to).lastIndexOf("NEEDS_REVISION");
      const signedOff = history
        .slice(lastRevision + 1)
        .some((e) => e.from === "SCHOLAR_REVIEW" && e.to === "APPROVED" && e.actor === "human");
      if (!signedOff)
        ctx.addIssue({
          code: "custom",
          path: ["status"],
          message: "this Part has sensitive claims: it needs SCHOLAR_REVIEW -> APPROVED by a human before approval",
        });
    }
  });
export type JourneyPart = z.infer<typeof JourneyPart>;

/** Every claim in a Part, in reading order (useful for reports, review and source lists). */
export function allClaims(part: Pick<
  JourneyPart,
  "summary" | "context" | "connectionToPrevious" | "connectionToNext" | "tafsirInsights" | "keyInsights" | "takeaways" | "commonMisunderstandings"
>): ClaimT[] {
  return [
    ...(part.connectionToPrevious ? [part.connectionToPrevious] : []),
    ...part.context,
    part.summary,
    ...part.tafsirInsights,
    ...part.keyInsights,
    ...part.takeaways,
    ...part.commonMisunderstandings.map((m) => m.clarification),
    ...(part.connectionToNext ? [part.connectionToNext] : []),
  ];
}

export function partIsSensitive(part: Parameters<typeof allClaims>[0]): boolean {
  return allClaims(part).some((c) => (c.sensitive?.length ?? 0) > 0);
}
