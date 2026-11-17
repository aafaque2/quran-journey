import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings-panel";
import { getCatalog } from "@/lib/content";

export const metadata: Metadata = { title: "Settings", description: "Reading depth, section order, script, translations and appearance." };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-serif text-3xl font-semibold sm:text-4xl">Settings</h1>
      <p className="mt-2 text-ink-2">Saved on this device only. Nothing here is sent anywhere.</p>
      <div className="mt-8">
        <SettingsPanel catalog={getCatalog()} />
      </div>
    </div>
  );
}
