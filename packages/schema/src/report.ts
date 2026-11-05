import { z } from "zod";

/** Issue categories from product spec §10. */
export const REPORT_CATEGORIES = [
  "quran_text",
  "translation",
  "tafsir_attribution",
  "tafsir_interpretation",
  "historical_context",
  "hadith",
  "missing_source",
  "verse_range",
  "typo",
  "other",
] as const;
export const ReportCategory = z.enum(REPORT_CATEGORIES);
export type ReportCategory = z.infer<typeof ReportCategory>;

/** What a user submits. Layer: user data (neither raw nor editorial). Internal (review queue). */
export const ReportInput = z.object({
  partNumber: z.number().int().positive(),
  /** Which section or claim id the report is about, if known. */
  section: z.string().trim().max(80).optional(),
  category: ReportCategory,
  message: z.string().trim().min(5, "Please describe the issue (at least a few words).").max(2000),
  /** Optional way to follow up. Never shown publicly. */
  contact: z.string().trim().max(200).optional(),
});
export type ReportInput = z.infer<typeof ReportInput>;

export const Report = z.object({
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  status: z.enum(["open", "resolved", "dismissed"]),
  input: ReportInput,
});
export type Report = z.infer<typeof Report>;
