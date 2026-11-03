import { z } from "zod";

/**
 * What kind of statement a piece of text is (AGENTS.md rule 3). Never collapse these.
 * Layer: editorial. User-visible as a badge on every claim.
 */
export const CONTENT_CATEGORIES = [
  "established", // the Qur'an itself clearly states it
  "scholarly_interpretation", // a named tafsir/scholar explains it
  "scholarly_disagreement", // recognized scholars hold different views
  "editorial_synthesis", // the platform's own summary of cited sources
  "reflection", // personal, explicitly non-authoritative
] as const;
export const ContentCategory = z.enum(CONTENT_CATEGORIES);
export type ContentCategory = z.infer<typeof ContentCategory>;

/**
 * Topics that make SCHOLAR_REVIEW a hard gate before APPROVED (product spec §7.1, §7.5).
 * Layer: editorial metadata. Internal (shown only in the review tool).
 */
export const SENSITIVE_TOPICS = [
  "aqeedah",
  "fiqh",
  "hadith",
  "sabab_al_nuzul",
  "historical",
  "interfaith",
] as const;
export const SensitiveTopic = z.enum(SENSITIVE_TOPICS);
export type SensitiveTopic = z.infer<typeof SensitiveTopic>;

export const ClaimId = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ids must be kebab-case (a-z, 0-9, -)");

/** A pointer from editorial text to a cited work. Layer: editorial. User-visible as a source chip. */
export const Citation = z.object({
  /** Id of an entry in content/works.json ("quran" for the Qur'an itself). Editorial; user-visible. */
  work: z.string().min(1),
  /** Where in the work: "2:8" for the Qur'an, "on 2:8" for a tafsir, "Al-Baqarah, note 10". Editorial; user-visible. */
  locator: z.string().min(1),
  /**
   * Short verbatim snippet in the original language, so reviewers can verify fast.
   * Allowed only for public-domain works (enforced by the content validator). Editorial; user-visible on expand.
   */
  excerpt: z.string().max(700).optional(),
  /** Transmission/context note, e.g. "reported from Mujahid via Ibn Abi Najih". Editorial; user-visible. */
  note: z.string().max(300).optional(),
});
export type Citation = z.infer<typeof Citation>;

/** One attributed position inside a scholarly disagreement. Layer: editorial. User-visible. */
export const View = z.object({
  /** Who holds this view, e.g. "Ibn Abbas (via Ali ibn Abi Talha)". Editorial; user-visible. */
  holder: z.string().min(1),
  /** The view, summarized. Editorial; user-visible. */
  text: z.string().min(1),
  /** Where the view is reported. Editorial; user-visible. */
  sources: z.array(Citation).min(1),
});
export type View = z.infer<typeof View>;

/** Any non-trivial statement shown to users. Layer: editorial. User-visible. */
export const Claim = z
  .object({
    /** Stable id, referenced by issue reports and review notes. Editorial; internal. */
    id: ClaimId,
    /** AGENTS.md rule 3. Editorial; user-visible badge. */
    category: ContentCategory,
    /** The statement itself. Editorial; user-visible. */
    text: z.string().min(1),
    /** AGENTS.md rule 2: every non-trivial claim is traceable. Editorial; user-visible. */
    sources: z.array(Citation).default([]),
    /** Only for scholarly_disagreement: at least two attributed views, never flattened. Editorial; user-visible. */
    views: z.array(View).optional(),
    /** Marks content needing scholar sign-off before APPROVED. Editorial; internal. */
    sensitive: z.array(SensitiveTopic).optional(),
  })
  .superRefine((claim, ctx) => {
    const citesQuran = claim.sources.some((s) => s.work === "quran");
    const citesScholarship = claim.sources.some((s) => s.work !== "quran");
    switch (claim.category) {
      case "established":
        if (!citesQuran)
          ctx.addIssue({
            code: "custom",
            path: ["sources"],
            message: "an 'established' claim must cite the Qur'an verse(s) that state it",
          });
        break;
      case "scholarly_interpretation":
        if (!citesScholarship)
          ctx.addIssue({
            code: "custom",
            path: ["sources"],
            message: "a 'scholarly_interpretation' claim must cite at least one named scholarly work",
          });
        break;
      case "scholarly_disagreement":
        if (!claim.views || claim.views.length < 2)
          ctx.addIssue({
            code: "custom",
            path: ["views"],
            message: "a 'scholarly_disagreement' claim must list at least two attributed views",
          });
        break;
      case "editorial_synthesis":
        if (claim.sources.length === 0)
          ctx.addIssue({
            code: "custom",
            path: ["sources"],
            message: "an 'editorial_synthesis' claim must cite what it synthesizes",
          });
        break;
      case "reflection":
        break;
    }
    if (claim.views && claim.category !== "scholarly_disagreement")
      ctx.addIssue({
        code: "custom",
        path: ["views"],
        message: "'views' is only allowed on scholarly_disagreement claims",
      });
  });
export type Claim = z.infer<typeof Claim>;

/**
 * A genuine, sourced misreading. AGENTS.md rule 4: an empty list is normal and expected;
 * never add one to fill the section. Layer: editorial. User-visible.
 */
export const Misunderstanding = z.object({
  /** Stable id. Editorial; internal. */
  id: ClaimId,
  /** The mistaken reading, stated fairly. Editorial; user-visible. */
  misreading: z.string().min(1),
  /** The sourced correction. Editorial; user-visible. */
  clarification: Claim,
  /** A source that itself identifies this misreading, proving the problem isn't invented. Editorial; user-visible. */
  addressedBy: z.array(Citation).min(1),
});
export type Misunderstanding = z.infer<typeof Misunderstanding>;

/**
 * Why this verse range is one coherent unit (AGENTS.md rule 5). Layer: editorial. User-visible
 * ("Why this passage is one Part").
 */
export const SegmentationRationale = z
  .object({
    /** Human-readable justification, not just a range. Editorial; user-visible. */
    text: z.string().min(40),
    /** Whether the boundary comes from classical scholarship, an editorial choice, or both. Editorial; user-visible. */
    basis: z.enum(["classical", "editorial", "classical_and_editorial"]),
    /** Where the boundary comes from. Editorial; user-visible. */
    sources: z.array(Citation),
  })
  .superRefine((r, ctx) => {
    if (r.basis !== "editorial" && r.sources.length === 0)
      ctx.addIssue({
        code: "custom",
        path: ["sources"],
        message: "a classical basis must cite where the boundary comes from",
      });
  });
export type SegmentationRationale = z.infer<typeof SegmentationRationale>;
