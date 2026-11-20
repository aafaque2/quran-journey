import { NextResponse } from "next/server";
import { touchReportStore } from "@/lib/reports";

export const dynamic = "force-dynamic";

/**
 * Called once a day by Vercel Cron (apps/web/vercel.json). A free Supabase project is paused after
 * about a week without database activity, which would make "Report an issue" fail; one tiny read
 * a day prevents that. When CRON_SECRET is set, Vercel sends it as a Bearer token and nothing else
 * can trigger this route.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  try {
    const store = await touchReportStore();
    return NextResponse.json({ ok: true, store });
  } catch (error) {
    console.error("Keep-alive failed", error);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
