import { JourneyPart, PartStatus, canTransition, partIsSensitive, TRANSITIONS } from "@quran-journey/schema";
import { z } from "zod";

export type TransitionResult = { ok: true; updated: Record<string, unknown> } | { ok: false; error: string };

/**
 * Applies one human editorial status change to a Part's raw JSON (kept as authored, so the file diff is
 * just the status line and one history entry). Pure: no I/O.
 */
export function applyTransition(
  raw: Record<string, unknown>,
  targetInput: string,
  by: string,
  note: string | undefined,
  now: Date,
): TransitionResult {
  const parsed = JourneyPart.safeParse(raw);
  if (!parsed.success) return { ok: false, error: `the Part is invalid before the change:\n${z.prettifyError(parsed.error)}` };
  const part = parsed.data;

  const target = PartStatus.safeParse(targetInput.toUpperCase());
  if (!target.success) return { ok: false, error: `unknown status "${targetInput}". Use one of: ${PartStatus.options.join(", ")}` };
  const to = target.data;

  if (!by.trim()) return { ok: false, error: "--by is required: status changes are recorded against a named person" };
  if (!canTransition(part.status, to))
    return { ok: false, error: `${part.status} -> ${to} is not allowed. From ${part.status} you can go to: ${TRANSITIONS[part.status].join(", ")}` };
  if (to === "APPROVED" && part.status !== "SCHOLAR_REVIEW" && partIsSensitive(part))
    return { ok: false, error: "this Part contains sensitive claims (aqeedah/fiqh/hadith/history/interfaith); move it to SCHOLAR_REVIEW and have a scholar approve it" };

  const history = (raw.review as { history: unknown[] }).history;
  const event = { at: now.toISOString(), by: by.trim(), actor: "human", from: part.status, to, ...(note ? { note } : {}) };
  const updated = { ...raw, status: to, review: { ...(raw.review as object), history: [...history, event] } };

  const check = JourneyPart.safeParse(updated);
  if (!check.success) return { ok: false, error: `the change would make the Part invalid:\n${z.prettifyError(check.error)}` };
  return { ok: true, updated };
}
