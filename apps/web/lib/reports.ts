import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Report, type ReportInput } from "@quran-journey/schema";

/**
 * Where "Report an issue" submissions are kept.
 *
 * - Supabase (Postgres), when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set. Needed on serverless
 *   hosts such as Vercel, which have no persistent disk. Table: supabase/migrations/0001_reports.sql.
 * - Otherwise an append-only JSON-lines file under apps/web/.data (git-ignored): fine locally and
 *   on a single self-hosted server.
 *
 * The service-role key stays on the server: this module is server-only and the table has RLS on
 * with no public policies, so browsers can never read reports (they may contain contact details).
 */

const FILE = path.join(process.cwd(), ".data", "reports.jsonl");

function supabase(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

export function reportStorage(): "supabase" | "file" {
  return supabase() ? "supabase" : "file";
}

interface ReportRow {
  id: string;
  created_at: string;
  status: Report["status"];
  part_number: number;
  section: string | null;
  category: string;
  message: string;
  contact: string | null;
}

export async function saveReport(input: ReportInput): Promise<Report> {
  const report: Report = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "open", input };
  const db = supabase();
  if (db) {
    const row: ReportRow = {
      id: report.id,
      created_at: report.createdAt,
      status: report.status,
      part_number: input.partNumber,
      section: input.section ?? null,
      category: input.category,
      message: input.message,
      contact: input.contact ?? null,
    };
    const res = await fetch(`${db.url}/rest/v1/reports`, {
      method: "POST",
      headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase insert failed: HTTP ${res.status} ${await res.text()}`);
    return report;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.appendFile(FILE, `${JSON.stringify(report)}\n`, "utf8");
  return report;
}

export async function listReports(): Promise<Report[]> {
  const db = supabase();
  if (db) {
    const res = await fetch(`${db.url}/rest/v1/reports?select=*&order=created_at.desc&limit=500`, {
      headers: { apikey: db.key, Authorization: `Bearer ${db.key}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase select failed: HTTP ${res.status}`);
    const rows = (await res.json()) as ReportRow[];
    return rows.flatMap((r) => {
      const parsed = Report.safeParse({
        id: r.id,
        createdAt: new Date(r.created_at).toISOString(),
        status: r.status,
        input: {
          partNumber: r.part_number,
          category: r.category,
          message: r.message,
          ...(r.section ? { section: r.section } : {}),
          ...(r.contact ? { contact: r.contact } : {}),
        },
      });
      return parsed.success ? [parsed.data] : [];
    });
  }
  let text: string;
  try {
    text = await fs.readFile(FILE, "utf8");
  } catch {
    return [];
  }
  return text
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = Report.safeParse(JSON.parse(line));
        return parsed.success ? [parsed.data] : [];
      } catch {
        return [];
      }
    })
    .reverse();
}
