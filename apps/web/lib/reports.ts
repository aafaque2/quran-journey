import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Report, type ReportInput } from "@quran-journey/schema";

// MVP storage: an append-only JSON-lines file under apps/web/.data (git-ignored).
// Fine for local use and a single self-hosted server. Serverless hosts (e.g. Vercel) have no
// persistent disk; swap this for a database table before deploying there.
const FILE = path.join(process.cwd(), ".data", "reports.jsonl");

export async function saveReport(input: ReportInput): Promise<Report> {
  const report: Report = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "open", input };
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.appendFile(FILE, `${JSON.stringify(report)}\n`, "utf8");
  return report;
}

export async function listReports(): Promise<Report[]> {
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
