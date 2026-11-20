import { NextResponse } from "next/server";
import { z } from "zod";
import { ReportInput } from "@quran-journey/schema";
import { reportStorage, saveReport } from "@/lib/reports";

const MAX_BODY = 10_000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 8;

// Best-effort, per-instance rate limit (serverless instances don't share it, which is acceptable for
// a small pilot: it stops one browser or script from flooding the review queue).
const recent = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 5_000) recent.clear();
  return hits.length > MAX_PER_WINDOW;
}

/** Receives "Report an issue" submissions (product spec §10) into the review queue. */
export async function POST(request: Request) {
  // Only our own pages may post here.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  if (rateLimited(ip)) return NextResponse.json({ error: "Too many reports from here just now. Please try again later." }, { status: 429 });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "That report is too long." }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "The report could not be read." }, { status: 400 });
  }

  // Honeypot: a field people never see. Bots that fill it get a polite success and nothing is stored.
  if (body && typeof body === "object" && "website" in body && (body as { website?: unknown }).website) {
    return NextResponse.json({ id: "ok" }, { status: 201 });
  }

  const parsed = ReportInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });

  try {
    const report = await saveReport(parsed.data);
    return NextResponse.json({ id: report.id }, { status: 201 });
  } catch (error) {
    console.error("Could not store report", error);
    // With file storage, a failure means no database is configured (serverless file systems are
    // read-only); a database error is more likely to be temporary.
    const message =
      reportStorage() === "file"
        ? "Reports can't be stored on this deployment yet."
        : "Your report couldn't be saved just now. Please try again in a moment.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
