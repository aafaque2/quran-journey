"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { usePrefs } from "@/lib/prefs-client";

export interface ScholarItem {
  id: string;
  /** Every work cited by the claim and its views. */
  works: string[];
  /** Disagreements always stay in view: hiding one would hide that scholars differ. */
  disagreement: boolean;
  node: ReactNode;
}

/**
 * "What the scholars explain", led by the scholars the reader chose. Preference only changes order
 * and emphasis: other scholars' explanations stay one click away, and every view in a disagreement
 * is always shown (AGENTS.md rule 3).
 */
export function ScholarList({ items, names }: { items: ScholarItem[]; names: Record<string, string> }) {
  const prefs = usePrefs();
  const chosen = (prefs.scholars ?? []).filter((id) => names[id]);
  const first = chosen.length ? items.filter((i) => i.disagreement || i.works.some((w) => chosen.includes(w))) : items;
  const preferred = first.length ? first : items;
  const others = items.filter((i) => !preferred.includes(i));
  const chosenHere = chosen.filter((id) => items.some((i) => i.works.includes(id)));

  return (
    <div>
      <p className="mb-6 text-sm text-ink-3">
        {chosen.length === 0 ? (
          <>Showing every scholar&apos;s explanation. </>
        ) : chosenHere.length ? (
          <>Your chosen scholars come first: {chosenHere.map((id) => names[id]).join(", ")}. </>
        ) : (
          <>None of your chosen scholars is cited here, so every explanation is shown. </>
        )}
        <Link href="/settings#scholars" className="text-accent underline-offset-2 hover:underline">
          {chosen.length === 0 ? "Choose whose explanations come first" : "Change"}
        </Link>
      </p>
      <div className="space-y-10">
        {preferred.map((i) => (
          <Fragment key={i.id}>{i.node}</Fragment>
        ))}
      </div>
      {others.length > 0 && (
        <details className="more-scholars mt-10 rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <summary className="cursor-pointer select-none font-medium text-ink-2">
            More from other scholars ({others.length})
          </summary>
          <div className="mt-6 space-y-10">
            {others.map((i) => (
              <Fragment key={i.id}>{i.node}</Fragment>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
