// Working title: change it here (the name "Quran Journey" is already used by other apps).
export const SITE = {
  name: "Qur'an Journey",
  tagline: "Don't just finish the Qur'an. Understand it.",
  description:
    "A guided path through the Qur'an in short, connected Parts: the text, its context, what the scholars explain, and room to reflect.",
} as const;

/** The public origin, e.g. https://example.org (no trailing slash). Used for canonical URLs, Open Graph and the sitemap. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "") || null;
