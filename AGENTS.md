# AGENTS.md — Qur'an Guided Learning Platform

This file is read automatically by opencode (and other AGENTS.md-aware agents) at the start of every session in this repo. It is the persistent contract for how work gets done here. Full product/content reasoning lives in `docs/product-spec.md` — read it before any task touching content, schema, or segmentation; this file is the condensed, always-loaded ruleset.

> The planning documents this file refers to (`docs/product-spec.md`, `docs/implementation-guide.md`) are private and kept outside version control.

## What this project is

A guided, sequential Qur'an-understanding platform. Users move through **Learning Parts** (curated passages, not raw verse browsing) that combine Qur'an text, translation, context, tafsir insights, takeaways, and reflection, each explicitly connected to the one before and after. Full detail: `docs/product-spec.md`.

## Non-negotiable content rules

These apply to any code, schema, or content this agent touches — violating them is a bug, not a style preference.

1. **Raw source layer vs. editorial layer are separate and one-directional.** Qur'an Arabic text, translations, tafsir source text, and structural metadata (juz/hizb/ruku/manzil) live in the raw layer and are **never** written to by AI-generated code or content scripts. AI/editorial content (summaries, insights, connections, narration) only ever writes to the editorial layer, which always references back to raw-layer IDs — never duplicates or paraphrases raw text into itself without a source pointer.
2. **Every non-trivial claim needs a source.** Any generated `tafsirInsights`, `keyInsights`, `context`, or `commonMisunderstandings` entry must carry a `sources[]` reference. Content without a traceable source should fail validation, not ship.
3. **No invented certainty.** Generated content must be tagged as one of: `established` (Qur'an itself states X), `scholarly_interpretation` (a named tafsir explains X), `scholarly_disagreement` (multiple recognized views exist), `editorial_synthesis` (platform-authored summary of sources), or `reflection` (personal, explicitly non-authoritative). Never collapse these into one undifferentiated blob of text in the UI or the data model.
4. **`commonMisunderstandings: []` is a valid, expected, and common output.** Never generate a filler entry to make the array non-empty.
5. **Every `JourneyPart` needs a `segmentationRationale`** — a human-readable justification for why this verse range is one coherent unit, not just the range itself.
6. **Content status is a first-class field**, not a convention: `DRAFT → AI_GENERATED → SOURCE_CHECKED → EDITOR_REVIEW → SCHOLAR_REVIEW → APPROVED → PUBLISHED` (or `NEEDS_REVISION` at any point). Nothing reaches `PUBLISHED` through code alone — publishing is a human/editorial action, never something a script does automatically after generation.
7. **Never fabricate historical context or sabab al-nuzul.** If a script or prompt can't find a sourced answer, the correct output is an empty/flagged field, not a plausible-sounding guess.

If a task seems to require bending any of these seven rules to "make the feature work," stop and flag it instead of working around it.

## Tech stack (see `docs/implementation-guide.md` for full rationale)

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4, mobile-first (`apps/web`)
- **Data layer (MVP):** content lives in git, not a database.
  - Raw layer = `content/raw/`: downloaded verbatim by `pnpm raw:fetch`, sha256-pinned in `content/raw/manifest.json`. The validator fails on any byte change.
  - Editorial layer = `content/parts/*.json` + `content/works.json` (bibliography) + `content/journey.json`. Parts reference verses by surah + ayah range and never copy verse text.
  - User progress and reading preferences are per-device (localStorage). Issue reports go to `apps/web/.data/reports.jsonl`.
  - Postgres/Supabase is the planned next step for reports and accounts, not yet used.
- **Shared schema:** Zod schemas in `packages/schema` are the single source of truth — used to validate both LLM pipeline output and app-level types. Don't hand-roll parallel TypeScript interfaces that can drift from these. Cross-file rules (contiguity, citations, excerpt rights, raw integrity) live in `packages/content/src/validate.ts`.
- **Content pipeline:** standalone scripts in `apps/pipeline`, run offline/manually, never part of the user-facing runtime request path
- **Hosting:** not deployed yet. Static pages work anywhere; issue reports need persistent storage (a self-hosted server, or a database before using serverless hosting such as Vercel).

## Conventions

- Arabic and translation text are always visually and semantically distinct in the UI — never merge them into one string or one styled block.
- RTL handling: Arabic verse text renders `dir="rtl"`; surrounding UI chrome stays LTR. Test both independently.
- Prefer editing/extending existing components over creating near-duplicate ones — check `apps/web/components` before adding new UI.
- Every new content-facing field added to the schema needs a one-line comment explaining what layer it belongs to (raw vs. editorial) and whether it's user-visible.
- Commit messages: short, imperative, scoped (`content-pipeline: add source-citation validation`).

## Commands

- Install: `pnpm install`
- Dev server: `pnpm dev` (http://localhost:3000; shows unreviewed drafts with a status banner. `/internal-review` needs `INTERNAL_REVIEW=true` in `apps/web/.env.local`)
- Production build: `pnpm build` (shows only Parts at `EDITOR_REVIEW` or beyond unless `CONTENT_VISIBILITY` is set; see `apps/web/.env.example`)
- Validate all content (raw integrity + schema + cross-file rules): `pnpm schema:validate`
- Validate a generated Part file against the schema: `pnpm schema:validate <file>`
- Fetch/refresh raw source data (verbatim, hashed): `pnpm raw:fetch [--suras=1,2] [--force]`
- Tests: `pnpm test` · Typecheck: `pnpm typecheck`
- Change a Part's review status: `pnpm content:status <part> <STATUS> --by "Name"`. **Human-only:** it refuses to run without an interactive terminal. Agents must never run it or edit `status`/`review.history` by hand (rule 6).
- Not built yet: `pnpm pipeline:generate` (the LLM drafting script). The four pilot Parts were drafted in a Claude Code session from the cited sources.

(Update this section as real scripts are added — keep it accurate, this is what the agent will actually run.)

## When in doubt

Ask, don't assume, for anything touching: segmentation boundaries, tafsir attribution, translation choice, or what counts as "established" vs. "scholarly interpretation." These are content/editorial calls, not engineering calls — flag them rather than silently picking an answer.
