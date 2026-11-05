import { describe, expect, it } from "vitest";
import { Claim, JourneyPart, Misunderstanding, PART_STATUSES, ReportInput, canTransition } from "./index";

const quran = (locator: string) => ({ work: "quran", locator });
const tafsir = { work: "tafsir-x", locator: "on 1:1" };
const claim = (over: Record<string, unknown> = {}) => ({
  id: "c",
  category: "editorial_synthesis",
  text: "Some text.",
  sources: [quran("1:1")],
  ...over,
});
const event = (from: string | null, to: string, actor = "human") => ({
  at: "2026-11-13T00:00:00.000Z",
  by: actor === "ai" ? "some-model" : "A Reviewer",
  actor,
  from,
  to,
});

function makePart(over: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: "part-0001",
    partNumber: 1,
    surah: 1,
    startAyah: 1,
    endAyah: 7,
    title: "A title",
    estimatedMinutes: 10,
    learningObjectives: ["Learn something useful."],
    summary: claim({ id: "summary" }),
    context: [],
    connectionToPrevious: null,
    connectionToNext: null,
    tafsirInsights: [claim({ id: "insight", category: "scholarly_interpretation", sources: [tafsir] })],
    keyInsights: [],
    takeaways: [claim({ id: "t1" }), claim({ id: "t2" }), claim({ id: "t3" })],
    commonMisunderstandings: [],
    reflectionQuestions: ["What will you reflect on today?"],
    segmentationRationale: { text: "A complete surah that forms one prayer from its start to its end.", basis: "classical", sources: [quran("1:1-7")] },
    audioScript: null,
    status: "AI_GENERATED",
    review: { generatedBy: "some-model", history: [event(null, "AI_GENERATED", "ai")] },
    ...over,
  };
}

describe("status workflow (AGENTS.md rule 6)", () => {
  it("matches the statuses in AGENTS.md exactly", () => {
    expect(PART_STATUSES).toEqual([
      "DRAFT",
      "AI_GENERATED",
      "SOURCE_CHECKED",
      "EDITOR_REVIEW",
      "SCHOLAR_REVIEW",
      "APPROVED",
      "PUBLISHED",
      "NEEDS_REVISION",
    ]);
  });

  it("never allows a jump straight to PUBLISHED", () => {
    expect(canTransition("AI_GENERATED", "PUBLISHED")).toBe(false);
    expect(canTransition("EDITOR_REVIEW", "PUBLISHED")).toBe(false);
    expect(canTransition("APPROVED", "PUBLISHED")).toBe(true);
  });

  it("rejects an AI actor moving a Part beyond AI_GENERATED", () => {
    const part = makePart({
      status: "SOURCE_CHECKED",
      review: { generatedBy: "m", history: [event(null, "AI_GENERATED", "ai"), event("AI_GENERATED", "SOURCE_CHECKED", "ai")] },
    });
    expect(JourneyPart.safeParse(part).success).toBe(false);
  });

  it("rejects a status that doesn't match the end of the review history", () => {
    expect(JourneyPart.safeParse(makePart({ status: "PUBLISHED" })).success).toBe(false);
  });

  it("rejects illegal jumps inside the history", () => {
    const part = makePart({
      status: "APPROVED",
      review: { generatedBy: "m", history: [event(null, "AI_GENERATED", "ai"), event("AI_GENERATED", "APPROVED")] },
    });
    expect(JourneyPart.safeParse(part).success).toBe(false);
  });

  it("requires a scholar's sign-off before sensitive content is APPROVED", () => {
    const sensitive = [claim({ id: "insight", category: "scholarly_interpretation", sources: [tafsir], sensitive: ["aqeedah"] })];
    const chain = [
      event(null, "AI_GENERATED", "ai"),
      event("AI_GENERATED", "SOURCE_CHECKED"),
      event("SOURCE_CHECKED", "EDITOR_REVIEW"),
    ];
    const skipped = makePart({
      tafsirInsights: sensitive,
      status: "APPROVED",
      review: { generatedBy: "m", history: [...chain, event("EDITOR_REVIEW", "APPROVED")] },
    });
    const viaScholar = makePart({
      tafsirInsights: sensitive,
      status: "APPROVED",
      review: { generatedBy: "m", history: [...chain, event("EDITOR_REVIEW", "SCHOLAR_REVIEW"), event("SCHOLAR_REVIEW", "APPROVED")] },
    });
    expect(JourneyPart.safeParse(skipped).success).toBe(false);
    expect(JourneyPart.safeParse(viaScholar).success).toBe(true);
  });
});

describe("claims and sources (AGENTS.md rules 2–3)", () => {
  it("accepts a minimal valid Part", () => {
    const result = JourneyPart.safeParse(makePart());
    expect(result.error?.issues).toBeUndefined();
  });

  it("requires sources on every non-reflection claim", () => {
    expect(Claim.safeParse(claim({ sources: [] })).success).toBe(false);
    expect(Claim.safeParse(claim({ category: "reflection", sources: [] })).success).toBe(true);
  });

  it("requires 'established' claims to cite the Qur'an", () => {
    expect(Claim.safeParse(claim({ category: "established", sources: [tafsir] })).success).toBe(false);
    expect(Claim.safeParse(claim({ category: "established", sources: [quran("1:5")] })).success).toBe(true);
  });

  it("requires interpretation to cite scholarship, not just a verse", () => {
    expect(Claim.safeParse(claim({ category: "scholarly_interpretation", sources: [quran("1:5")] })).success).toBe(false);
  });

  it("requires at least two attributed views for a disagreement, and only there", () => {
    const view = { holder: "Someone", text: "A view.", sources: [tafsir] };
    expect(Claim.safeParse(claim({ category: "scholarly_disagreement", sources: [], views: [view] })).success).toBe(false);
    expect(Claim.safeParse(claim({ category: "scholarly_disagreement", sources: [], views: [view, view] })).success).toBe(true);
    expect(Claim.safeParse(claim({ views: [view, view] })).success).toBe(false);
  });

  it("keeps each field to its allowed categories", () => {
    const part = makePart({ tafsirInsights: [claim({ id: "insight" })] }); // editorial_synthesis is not tafsir
    expect(JourneyPart.safeParse(part).success).toBe(false);
  });
});

describe("misunderstandings (AGENTS.md rule 4)", () => {
  it("accepts an empty list", () => {
    expect(JourneyPart.safeParse(makePart({ commonMisunderstandings: [] })).success).toBe(true);
  });

  it("requires a source that itself identifies the misreading", () => {
    const m = { id: "m", misreading: "A misreading.", clarification: claim({ id: "fix" }), addressedBy: [] };
    expect(Misunderstanding.safeParse(m).success).toBe(false);
    expect(Misunderstanding.safeParse({ ...m, addressedBy: [tafsir] }).success).toBe(true);
  });
});

describe("segmentation and takeaways (AGENTS.md rule 5, spec §8)", () => {
  it("requires a segmentation rationale", () => {
    const { segmentationRationale: _omit, ...rest } = makePart();
    expect(JourneyPart.safeParse(rest).success).toBe(false);
  });

  it("requires a classical basis to cite its source", () => {
    const part = makePart({ segmentationRationale: { text: "x".repeat(50), basis: "classical", sources: [] } });
    expect(JourneyPart.safeParse(part).success).toBe(false);
  });

  it("keeps takeaways to 3–5 short items", () => {
    const t = (id: string, text = "Short.") => claim({ id, text });
    expect(JourneyPart.safeParse(makePart({ takeaways: [t("a"), t("b")] })).success).toBe(false);
    expect(JourneyPart.safeParse(makePart({ takeaways: ["a", "b", "c", "d", "e", "f"].map((i) => t(i)) })).success).toBe(false);
    expect(JourneyPart.safeParse(makePart({ takeaways: [t("a"), t("b"), t("c", "x".repeat(201))] })).success).toBe(false);
  });
});

describe("issue reports (spec §10)", () => {
  it("validates user reports", () => {
    expect(ReportInput.safeParse({ partNumber: 1, category: "typo", message: "There is a typo in the summary." }).success).toBe(true);
    expect(ReportInput.safeParse({ partNumber: 1, category: "typo", message: "x" }).success).toBe(false);
    expect(ReportInput.safeParse({ partNumber: 1, category: "nonsense", message: "Something is off here." }).success).toBe(false);
  });
});
