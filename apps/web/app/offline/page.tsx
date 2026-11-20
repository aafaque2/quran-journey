import type { Metadata } from "next";
import Link from "next/link";
import { SavedParts } from "@/components/pwa";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

/** Shown by the service worker when a page is requested offline and was never saved on this device. */
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 sm:px-6">
      <p className="text-sm font-medium text-gold">No connection</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold">You&apos;re offline</h1>
      <p className="mt-4 leading-relaxed text-ink-2">
        This page hasn&apos;t been saved on this device yet. Parts you have opened before, or saved from Settings, are still here.
      </p>
      <SavedParts />
      <p className="mt-8 text-sm">
        <Link href="/" className="text-accent underline-offset-2 hover:underline">
          Back to the journey
        </Link>
      </p>
    </div>
  );
}
