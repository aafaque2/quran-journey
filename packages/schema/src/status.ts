import { z } from "zod";

/**
 * Editorial workflow states (AGENTS.md rule 6), in workflow order.
 * Layer: editorial metadata. User-visible only as a "review status" badge, so unreviewed
 * content is never mistaken for reviewed content.
 */
export const PART_STATUSES = [
  "DRAFT",
  "AI_GENERATED",
  "SOURCE_CHECKED",
  "EDITOR_REVIEW",
  "SCHOLAR_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "NEEDS_REVISION",
] as const;
export const PartStatus = z.enum(PART_STATUSES);
export type PartStatus = z.infer<typeof PartStatus>;

/** The forward path. NEEDS_REVISION sits outside it. */
export const WORKFLOW: readonly PartStatus[] = [
  "DRAFT",
  "AI_GENERATED",
  "SOURCE_CHECKED",
  "EDITOR_REVIEW",
  "SCHOLAR_REVIEW",
  "APPROVED",
  "PUBLISHED",
];

/** Position on the forward path; NEEDS_REVISION ranks below everything. */
export function statusRank(status: PartStatus): number {
  return status === "NEEDS_REVISION" ? -1 : WORKFLOW.indexOf(status);
}

/**
 * Allowed transitions. Every step is a single move; nothing can jump to PUBLISHED.
 * Who may make each move is enforced separately: AI may only produce DRAFT/AI_GENERATED.
 */
export const TRANSITIONS: Readonly<Record<PartStatus, readonly PartStatus[]>> = {
  DRAFT: ["AI_GENERATED", "SOURCE_CHECKED"],
  AI_GENERATED: ["SOURCE_CHECKED", "NEEDS_REVISION"],
  SOURCE_CHECKED: ["EDITOR_REVIEW", "NEEDS_REVISION"],
  EDITOR_REVIEW: ["SCHOLAR_REVIEW", "APPROVED", "NEEDS_REVISION"],
  SCHOLAR_REVIEW: ["APPROVED", "NEEDS_REVISION"],
  APPROVED: ["PUBLISHED", "NEEDS_REVISION"],
  PUBLISHED: ["NEEDS_REVISION"],
  NEEDS_REVISION: ["DRAFT", "AI_GENERATED", "SOURCE_CHECKED"],
};

/** Statuses an automated (AI) actor is allowed to set. Everything else is a human editorial act. */
export const AI_SETTABLE: readonly PartStatus[] = ["DRAFT", "AI_GENERATED"];

export function canTransition(from: PartStatus, to: PartStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
