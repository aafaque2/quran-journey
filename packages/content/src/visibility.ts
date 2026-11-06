import { statusRank, type PartStatus } from "@quran-journey/schema";

/**
 * Which Parts the public app shows.
 * - drafts:    everything, each with a prominent review-status banner (local development, pilot testing)
 * - reviewed:  EDITOR_REVIEW and beyond (the friends-and-family pilot)
 * - published: PUBLISHED only (a real public launch)
 */
export type Visibility = "drafts" | "reviewed" | "published";

export function resolveVisibility(value: string | undefined, nodeEnv: string | undefined): Visibility {
  if (value === "drafts" || value === "reviewed" || value === "published") return value;
  return nodeEnv === "production" ? "reviewed" : "drafts";
}

export function isVisible(status: PartStatus, visibility: Visibility): boolean {
  if (visibility === "drafts") return true;
  if (visibility === "published") return status === "PUBLISHED";
  return statusRank(status) >= statusRank("EDITOR_REVIEW");
}
