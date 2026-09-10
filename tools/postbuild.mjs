/**
 * Assemble the deployable docroot after `next build`.
 *
 * `next build` only emits the static export into `out/`. The server-side pieces
 * live outside it and were previously copied by hand, so a plain build-and-upload
 * shipped WITHOUT the security headers, the CSP, the SPA 404 mapping, and the
 * Authorization-header rewrite that cross-device sync depends on.
 *
 * Copying them here makes `out/` a complete, correct docroot every time.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "out");

if (!existsSync(out)) {
  console.error("postbuild: out/ not found — run `next build` first.");
  process.exit(1);
}

/** [source, destination-within-out] */
const assets = [
  ["server/htaccess.conf", ".htaccess"],
  ["server/api.php", "api.php"]
];

let copied = 0;
for (const [from, to] of assets) {
  const src = join(root, from);
  if (!existsSync(src)) {
    console.error(`postbuild: missing ${from} — deploy would be incomplete.`);
    process.exit(1);
  }
  const dest = join(out, to);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`postbuild: ${from} -> out/${to}`);
  copied += 1;
}
console.log(`postbuild: ${copied} deploy asset(s) in place.`);
