"use client";

import { useRef, useState, type FormEvent } from "react";
import { REPORT_LABEL } from "@/lib/format";
import { CloseIcon, FlagIcon } from "./icons";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string; draft: string };

/** "Report an issue" (product spec §10): every report lands in the review queue. */
export function ReportIssue({ partNumber, sections }: { partNumber: number; sections: { value: string; label: string }[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });

  const open = () => {
    setState({ kind: "idle" });
    dialog.current?.showModal();
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      partNumber,
      category: String(form.get("category") ?? ""),
      section: String(form.get("section") ?? "") || undefined,
      message: String(form.get("message") ?? ""),
      contact: String(form.get("contact") ?? "") || undefined,
      // Honeypot: hidden from people, so only bots fill it (the server then discards the report).
      website: String(form.get("website") ?? "") || undefined,
    };
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `The server answered ${res.status}.`);
      }
      setState({ kind: "sent" });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
        draft: `Part ${partNumber} · ${body.category}${body.section ? ` · ${body.section}` : ""}\n${body.message}`,
      });
    }
  }

  const field = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm text-ink-2 transition hover:border-ink-3 hover:text-ink"
      >
        <FlagIcon className="h-4 w-4" /> Report an issue
      </button>
      <dialog
        ref={dialog}
        className="modal m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl"
        aria-labelledby="report-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id="report-title" className="font-serif text-lg font-semibold">
              Report an issue with Part {partNumber}
            </h2>
            <p className="mt-0.5 text-sm text-ink-3">Every report is read and checked against the sources.</p>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {state.kind === "sent" ? (
          <div className="px-5 py-8 text-center">
            <p className="font-serif text-lg">Jazākum Allāhu khayran.</p>
            <p className="mt-2 text-sm text-ink-2">Your report is in the review queue.</p>
            <button type="button" onClick={() => dialog.current?.close()} className="mt-6 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-ink">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 px-5 py-5">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            <label className="block text-sm">
              <span className="mb-1 block font-medium">What kind of issue?</span>
              <select name="category" required defaultValue="" className={field}>
                <option value="" disabled>
                  Choose a category
                </option>
                {Object.entries(REPORT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Where? (optional)</span>
              <select name="section" defaultValue="" className={field}>
                <option value="">Anywhere in this Part</option>
                {sections.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">What's wrong?</span>
              <textarea name="message" required minLength={5} maxLength={2000} rows={5} className={field} placeholder="Describe what looks wrong, and the correct source if you know it." />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">How can we follow up? (optional)</span>
              <input name="contact" maxLength={200} className={field} placeholder="Email or phone. Never shown publicly." />
            </label>
            {state.kind === "error" && (
              <div className="rounded-lg bg-warn-bg p-3 text-sm text-warn">
                <p>Your report could not be saved: {state.message}</p>
                <p className="mt-2 text-ink-2">Please copy it and send it to the team directly:</p>
                <textarea readOnly value={state.draft} rows={3} className={`${field} mt-2 font-mono text-xs`} />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => dialog.current?.close()} className="rounded-full px-4 py-2 text-sm text-ink-2 hover:text-ink">
                Cancel
              </button>
              <button
                type="submit"
                disabled={state.kind === "sending"}
                className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-60"
              >
                {state.kind === "sending" ? "Sending…" : "Send report"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
