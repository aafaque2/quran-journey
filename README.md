# Qur'an Journey (working title)

A guided, sequential path through the Qur'an in short, connected **Parts**. Each Part shows:
- the Arabic text and a translation of its meaning;
- what is happening in the passage;
- what named scholars explain, and where they differ;
- takeaways and reflection;

and each connects to the Part before and after. Rules for AI agents working in this repo: [`AGENTS.md`](AGENTS.md).

**Pilot scope:** Al-Fatihah and Al-Baqarah 2:1–66, in 10 Parts. All ten are `AI_GENERATED` drafts awaiting human review.

**Reading your way** ([`docs/personalisation.md`](docs/personalisation.md)): a depth switch on every page (**Read · Understand · Study**), a section rail you can reorder, a first-visit setup at `/welcome`, `/settings`, and light/dark mode. Readers choose the Arabic script (Uthmani or Simple) and one or more translations (Saheeh International, Rowwad, Junagarhi Urdu, al-Omari Hindi). All of it is stored on the device only.

**On phones:** the site installs like an app (home-screen icon, full-screen), and every Part a reader has opened stays readable offline. Settings → *On your phone* saves all Parts at once.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

| Command | What it does |
|---|---|
| `pnpm schema:validate` | Raw-layer integrity, schema and cross-file rules for all content |
| `pnpm test` | 45 tests, including negative tests that prove each content rule actually fires |
| `pnpm build` | Production build (shows only reviewed Parts by default, see below) |
| `pnpm raw:fetch` | Re-download Qur'an text / translation verbatim and re-pin their hashes |
| `pnpm content:status <part> <STATUS> --by "Name"` | Record a review step (human-only, interactive terminal) |

## How content is organised

```
content/
  raw/           RAW LAYER: verbatim downloads + manifest.json (license + sha256). Never edited.
  journey.json   which Parts, in which order, over which raw datasets
  works.json     bibliography: every tafsir / hadith work cited, with its rights status
  parts/*.json   EDITORIAL LAYER: one file per Part (validated by packages/schema)
```

Every claim in a Part is tagged with one of five types: `established`, `scholarly_interpretation`, `scholarly_disagreement`, `editorial_synthesis` or `reflection`. Every claim carries sources. The validator rejects:
- claims with no sources;
- an "established" claim that doesn't cite the Qur'an;
- a disagreement with fewer than two attributed views;
- verbatim excerpts from copyrighted works;
- gaps or overlaps between Parts;
- an AI actor moving a Part past `AI_GENERATED`;
- approval of sensitive Parts (belief, law, hadith, history, other faiths) without a scholar's sign-off.

## Reviewing a Part

1. Run `pnpm dev`, open **http://localhost:3000/internal-review**. It needs `INTERNAL_REVIEW=true` in `apps/web/.env.local`, which is already set locally. The page shows validation results, issue reports and every claim grouped by type, with its sources.
2. Check claims against the sources. Each source chip opens to show the exact location, and the Arabic excerpt for public-domain works. Fix text by editing `content/parts/000N-*.json`, then run `pnpm schema:validate`.
3. Record the step: `pnpm content:status 1 SOURCE_CHECKED --by "Your Name" --note "checked all citations"`. The order is `SOURCE_CHECKED → EDITOR_REVIEW → SCHOLAR_REVIEW → APPROVED → PUBLISHED`.
4. Commit the file. Git history is the audit trail.

## Sharing the pilot with friends

The production build hides anything below `EDITOR_REVIEW` (`CONTENT_VISIBILITY=reviewed`).

To let a closed group test unreviewed drafts, build with `CONTENT_VISIBILITY=drafts`. That is a deliberate editorial choice: every Part keeps its review-status banner, and every page is marked `noindex` so search engines leave the drafts out.

Issue reports are written to `apps/web/.data/reports.jsonl` locally, or to Supabase/Postgres when `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set (needed on serverless hosts such as Vercel; table in `supabase/migrations/`). Configuration: [`apps/web/.env.example`](apps/web/.env.example).

## Deploying

The app is set up for **Vercel** (pre-rendered pages on the CDN, two small server routes) with **Supabase** for issue reports.

1. **Supabase:** create a project and run `supabase/migrations/0001_reports.sql` in its SQL editor.
2. **Vercel:** import the repository with **Root Directory `apps/web`**. [`apps/web/vercel.json`](apps/web/vercel.json) runs the server routes in Mumbai (`bom1`) and calls `/api/keepalive` once a day, so a free Supabase project is never paused for inactivity.
3. Set the environment variables listed in [`apps/web/.env.example`](apps/web/.env.example), then deploy. Parts are pre-rendered, so redeploy after a review-status change.

Any Node host works too (`pnpm build && pnpm start`); without Supabase, reports are written to `apps/web/.data/reports.jsonl`.

## Sources & licensing (read before any public launch)

- **Qur'an text:** Tanzil Project, Uthmani v1.1, CC BY 3.0. Verbatim only, credit Tanzil with a link (done in the footer). Its notice is kept inside the stored file.
- **Qur'an text, Simple script:** Tanzil Project, Simple v1.1, same terms as above.
- **Translations:** Saheeh International (default), Rowwad Translation Center, Muhammad Junagarhi (Urdu) and Azizul Haq al-Omari (Hindi), all via QuranEnc.com. Republish only unmodified, credit the publisher + QuranEnc + version, and **keep them updated** (`pnpm raw:fetch --force` when QuranEnc publishes a new version). Commercial use isn't addressed by their terms; ask them before monetising. Which translations and scripts are offered is set in `content/journey.json`.
- **Tafsir:**
  - Ibn Kathir, al-Tabari and al-Qurtubi (Arabic originals) are public domain; short Arabic excerpts are quoted for verification.
  - Al-Sa'di (d. 1956), Tafheem-ul-Qur'an and Ma'arif al-Qur'an are treated as copyrighted: cited and summarized only. **Get written permission for Tafheem and Ma'arif before a public launch.**
- **Recitation audio:** not included. Set `NEXT_PUBLIC_RECITATION_URL_TEMPLATE` only to a reciter source you are licensed to use. Qur'an audio is never synthesized.

## Not built yet

- `pnpm pipeline:generate`: the LLM drafting script.
- Accounts and cross-device sync.
- Narration audio.
- Recitation audio.
