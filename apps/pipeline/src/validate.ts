/**
 * `pnpm schema:validate [file.json ...]`
 *
 * With no arguments: validates the whole content/ tree — raw-layer integrity, every Part against the
 * Zod schema, and the cross-file rules (contiguity, citations, excerpt rights, review gates).
 * With file arguments: also schema-checks those Part files (e.g. fresh LLM output not yet in content/).
 * Exits 1 on any error. Invalid output fails loudly; nothing is coerced.
 */
import path from "node:path";
import { parseArgs } from "node:util";
import { ContentError, loadContent, parsePartFile, validateContent } from "@quran-journey/content";

const { positionals } = parseArgs({ allowPositionals: true, options: {} });
let failed = false;

for (const file of positionals) {
  const abs = path.resolve(process.env.INIT_CWD ?? process.cwd(), file);
  const { problems } = parsePartFile(abs);
  if (problems.length) {
    failed = true;
    console.error(`ERROR  ${file}\n${problems.join("\n")}`);
  } else {
    console.log(`OK     ${file} matches the JourneyPart schema`);
  }
}

try {
  const content = loadContent();
  const issues = validateContent(content);
  const files = content.manifest.datasets.reduce((n, d) => n + d.files.length, 0);
  console.log(`OK     raw layer: ${content.manifest.datasets.length} datasets, ${files} files${content.integrity.length ? " (INTEGRITY PROBLEMS BELOW)" : ", hashes intact"}`);
  console.log(`OK     schema: ${content.parts.length} Parts, ${content.works.size} works, journey "${content.journey.title}"`);
  for (const i of issues) {
    if (i.level === "error") failed = true;
    (i.level === "error" ? console.error : console.warn)(`${i.level === "error" ? "ERROR" : "WARN "}  ${i.where}: ${i.message}`);
  }
  const statuses = content.parts.map((p) => `${p.id}=${p.status}`).join(", ");
  console.log(`INFO   statuses: ${statuses}`);
} catch (e) {
  failed = true;
  console.error(e instanceof ContentError ? `ERROR  ${e.message}` : e);
}

if (failed) {
  console.error("\nValidation failed.");
  process.exit(1);
}
console.log("\nAll content valid.");
