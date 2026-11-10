/**
 * `pnpm content:status <partNumber|part-id> <STATUS> --by "Your Name" [--note "…"]`
 *
 * A HUMAN editorial action (AGENTS.md rule 6). It only runs in an interactive terminal and asks for
 * confirmation, so automated agents cannot advance review status. Each change appends a named,
 * timestamped event to the Part's review history; commit the file afterwards so git keeps the audit trail.
 */
import fs from "node:fs";
import readline from "node:readline/promises";
import { parseArgs } from "node:util";
import { loadContent } from "@quran-journey/content";
import { applyTransition } from "./transition";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { by: { type: "string" }, note: { type: "string" } },
});
const [partArg, target] = positionals;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!partArg || !target)
  fail('Usage: pnpm content:status <partNumber|part-id> <STATUS> --by "Your Name" [--note "…"]');
if (!process.stdin.isTTY)
  fail("content:status is a human editorial action and must be run in an interactive terminal (AGENTS.md rule 6).");

const content = loadContent();
const part = content.parts.find((p) => p.id === partArg || String(p.partNumber) === partArg);
if (!part) fail(`No Part "${partArg}". Known: ${content.parts.map((p) => `${p.partNumber} (${p.id})`).join(", ")}`);
const file = content.partFiles.get(part.id);
if (!file) fail(`Could not locate the file for ${part.id}`);

const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
const result = applyTransition(raw, target, values.by ?? "", values.note, new Date());
if (!result.ok) fail(`Refused: ${result.error}`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(
  `Part ${part.partNumber} "${part.title}": ${part.status} -> ${String(result.updated.status)} as "${values.by}". Type "yes" to record: `,
);
rl.close();
if (answer.trim().toLowerCase() !== "yes") fail("Cancelled. Nothing changed.");

fs.writeFileSync(file, `${JSON.stringify(result.updated, null, 2)}\n`);
console.log(`Recorded. ${part.id} is now ${String(result.updated.status)}. Commit ${file} to keep the review trail.`);
