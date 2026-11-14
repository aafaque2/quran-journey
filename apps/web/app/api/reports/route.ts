import { NextResponse } from "next/server";
import { z } from "zod";
import { ReportInput } from "@quran-journey/schema";
import { saveReport } from "@/lib/reports";

const MAX_BODY = 10_000;

/** Receives "Report an issue" submissions (product spec §10) into the review queue. */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "That report is too long." }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "The report could not be read." }, { status: 400 });
  }

  const parsed = ReportInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });

  try {
    const report = await saveReport(parsed.data);
    return NextResponse.json({ id: report.id }, { status: 201 });
  } catch (error) {
    console.error("Could not store report", error);
    return NextResponse.json({ error: "Reports can't be stored on this deployment yet." }, { status: 503 });
  }
}
