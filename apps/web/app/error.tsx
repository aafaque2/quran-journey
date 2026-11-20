"use client";

import Link from "next/link";

/** Shown if a page fails to render. Nothing technical is exposed to the reader. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <p className="text-sm font-medium text-gold">Something went wrong</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold">This page couldn&apos;t be shown</h1>
      <p className="mt-4 leading-relaxed text-ink-2">Please try again. If it keeps happening, the journey itself is still here.</p>
      <div className="mt-8 flex justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Back to the journey
        </Link>
      </div>
    </div>
  );
}
