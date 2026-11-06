import fs from "node:fs";
import path from "node:path";

/** Walks up from `start` to the workspace root (the folder holding pnpm-workspace.yaml). */
export function findRepoRoot(start: string = process.cwd()): string {
  let dir = path.resolve(/*turbopackIgnore: true*/ start);
  for (;;) {
    if (fs.existsSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`Could not find the repo root (pnpm-workspace.yaml) above ${start}`);
    dir = parent;
  }
}

/** The content/ directory. Override with CONTENT_DIR (used by tests). */
export function contentDir(): string {
  return process.env.CONTENT_DIR ? path.resolve(/*turbopackIgnore: true*/ process.env.CONTENT_DIR) : path.join(/*turbopackIgnore: true*/ findRepoRoot(), "content");
}
