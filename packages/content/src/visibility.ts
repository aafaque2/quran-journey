import { statusRank, type PartStatus } from "@quran-journey/schema";

/**
 * Which Parts the public app shows.
 * - drafts:    everything, each with a prominent review-status banner (local development, pilot testing)
 * - reviewed:  EDITOR_REVIEW and beyond (the friends-and-family pilot)
 * - published: PUBLISHED only (a real public launch)
 */
export type Visibility = "drafts" | "reviewed" | "published";

let warned = false;

/**
 * Reads CONTENT_VISIBILITY. Forgiving about case, spaces and quotes ("Drafts", "'drafts'"), because a
 * value that silently fell back would hide every Part. Anything unrecognised falls back to the safe
 * default (reviewed in production), with one warning in the build log.
 */
export function resolveVisibility(value: string | undefined, nodeEnv: string | undefined): Visibility {
  const v = (value ?? "").trim().replace(/^["']+|["']+$/g, "").trim().toLowerCase();
  if (v === "drafts" || v === "draft") return "drafts";
  if (v === "reviewed" || v === "published") return v;
  if (v && !warned) {
    warned = true;
    console.warn(`CONTENT_VISIBILITY=${JSON.stringify(value)} is not drafts, reviewed or published; using the default.`);
  }
  return nodeEnv === "production" ? "reviewed" : "drafts";
}

export function isVisible(status: PartStatus, visibility: Visibility): boolean {
  if (visibility === "drafts") return true;
  if (visibility === "published") return status === "PUBLISHED";
  return statusRank(status) >= statusRank("EDITOR_REVIEW");
}
