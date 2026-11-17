# Reading preferences: depth, section order, setup and themes

How readers shape a Part to the time and attention they have, without changing what the content says.

## Principles

- **Nothing is hidden.** Sections outside the reader's depth stay on the page, collapsed below a "Go deeper" line.
- **Emphasis, never substance.** Preferences change order and emphasis only. A scholarly disagreement always shows every view, whatever scholars the reader prefers to see first.
- **Private by default.** Preferences live on the device (localStorage) and are never sent anywhere.

## Depth: Read · Understand · Study

A three-way switch in the header of every page.

| Depth | Sections | Typical time per Part |
|---|---|---|
| **Read** | Where we left off · The passage · What this passage is doing · Key insights · Takeaways · What comes next | 3–9 min |
| **Understand** (default) | adds What is happening here · What the scholars explain · Common misunderstandings · Reflect | 7–15 min |
| **Study** | adds Why this passage is one Part · Sources | 8–16 min |

- **Read** keeps the links to the previous and next Parts, because continuity between passages is central to the journey. They take seconds to read.
- **The scholars' explanations belong to Understand.** Each Part's learning objectives depend on them.
- **Study is where deeper material will go:** word-by-word study, cross-referenced verses, source excerpts and claim-level depth (see Roadmap).

Reading times scale each Part's editorial estimate by the share of text in the sections a depth includes. Switching depth keeps the section being read in place on screen.

## Section order

- **Wide screens:** a sticky section rail tracks the scroll position, with a highlight that slides to the current section, and jumps smoothly to any section.
- **Phones:** a sticky bar shows the current section and progress, and opens the same list in a sheet.
- **Reordering:** the pencil turns on drag-and-drop, which also works with the keyboard (Space, the arrow keys, Space). It has Save, Cancel and Reset.
- **Sections beyond the current depth form a separate group.** They can be reordered among themselves but never placed above a section within the depth.
- **One order applies to every Part.**

## Welcome setup and Settings

First-time visitors to `/` are taken to `/welcome`; visitors who open a Part link directly are not. It asks five questions on cards: depth, Arabic script, translations, whose explanations come first, and light or dark.
- A single choice moves on by itself; multiple choices have Next.
- Back and Skip are always available, and a summary at the end allows changes.
- `/settings` holds the same choices, plus section order, verse display, text sizes, progress reset and "Run the welcome setup again".

What each choice means:

- **Script:** Uthmani (default) or Simple (modern spelling, fully vowelled), both verbatim from the Tanzil Project.
- **Translations:** one or more, shown in the order chosen; the first is used in Listen & Understand. Offered: Saheeh International (default), Rowwad Translation Center (English), Muhammad Junagarhi (Urdu) and Azizul Haq al-Omari (Hindi), all verbatim from QuranEnc. The list of choices lives in `content/journey.json`.
- **Scholars first:** Parts synthesise several tafsirs, so this choice decides whose explanations lead in "What the scholars explain". The rest are one click away under "More from other scholars".
- **Appearance:** light, dark, or match the device. The header button switches between light and dark.

## Implementation

- **Storage:** preferences are one localStorage object (`qj.prefs.v1`), parsed defensively by `normalizePrefs` in `apps/web/lib/reading-prefs.ts`.
- **No flash of the wrong layout:**
  - An inline script in `<head>` (`bootScript`) copies preferences onto `<html>` as data attributes and CSS custom properties before first paint.
  - CSS then lays out the depth, the section order (`order: var(--qj-o-<id>)`), script, translations, theme and text sizes.
  - After hydration React re-orders the DOM, so keyboard and screen-reader order match what is seen.
  - A unit test checks that the boot script and React produce the same order at every depth.
- **Server rendering:** every script and translation on offer is rendered on the server and shown or hidden by CSS. If many more translations are added, the ones a reader hasn't chosen should be loaded on demand.
- **Story Mode** plays only the reader's depth, in their script and first translation.

## Roadmap

- **IndoPak script:** widely read in South Asia. It needs a Qur'an text and a font whose licenses are verified; the Digital Khatt IndoPak edition is a candidate.
- **More languages:** QuranEnc also offers Malayalam, Tamil, Telugu and others. Each one is an entry in `apps/pipeline/src/fetch-raw.ts` and `content/journey.json`, plus a suitable font.
- **Claim-level depth:** an editor-set `depth` on individual claims, so Understand can stay concise while Study gains substance.
- **Localised explanations:** at present only the verse translations are multilingual.
- **Accounts:** to sync preferences and progress across devices.
