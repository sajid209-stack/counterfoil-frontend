// Type-scale / tracking / radius codemod (2026-10-11).
//
// Moves src/** onto the named scale in docs/design-system.md §4 and §6:
//   A. named sizes  text-xs|sm|base|lg|xl|2xl|3xl|4xl   -> by OLD px to the new class
//   B. arbitrary    text-[13px] / text-[0.8125rem]       -> scale class   (main code only)
//   C. tracking     tracking-[-0.4px] ...                -> tracking-title / tracking-figure (main only)
//   D. radius       rounded-[12px] ...                   -> rounded-md ... (main only)
//
// ONE regex pass per file, with a mapping function, so a replacement is never
// re-replaced (text-sm -> text-base must not then become text-md).
//
// Exception dirs (a fixed canvas / each event template's own type) get rule A only,
// and 30px / 36px are written as exact arbitraries there so nothing changes size.
//
// Usage: node scripts/codemods/type-scale.mjs [--dry]
// Not idempotent by design (text-sm means 14px BEFORE and 13px AFTER). Run it once.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SRC = path.join(ROOT, "src");
const DRY = process.argv.includes("--dry");

const EXCEPTION = ["src/app/deck/", "src/lib/events/", "src/components/events/", "src/app/e/"];
const SKIP = new Set(["src/app/globals.css"]);

// A. old named size -> px it rendered at
const OLD_PX = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36 };
// px -> new named class (A and B share the target scale)
const NAMED = { 12: "xs", 14: "base", 16: "md", 18: "lg", 20: "xl", 24: "2xl" };
// B. arbitrary px -> class
const ARB = {
  11: "2xs", 12: "xs", 13: "sm", 14: "base", 15: "md", 16: "md", 17: "md", 18: "lg", 19: "xl", 20: "xl",
  22: "2xl", 24: "2xl", 26: "2xl", 28: "3xl", 30: "3xl", 32: "4xl", 36: "4xl", 38: "display", 40: "display", 48: "5xl",
};
// C. tracking
const TRACK = {
  "-0.4px": "title", "-0.2px": "title", "-0.02em": "title", "-0.015em": "title",
  "-0.025em": "figure", "-0.5px": "figure", "-0.03em": "figure",
};
// D. radius
const RADIUS = { 2: "xs", 3: "xs", 6: "sm", 12: "md", 16: "lg", 14: "go-sm", 18: "go", 28: "go-lg" };

const RE = new RegExp(
  "(?<![\\w-])(?:" +
    "text-(?:(xs|sm|base|lg|xl|2xl|3xl|4xl)(?![\\w-])|\\[(\\d+(?:\\.\\d+)?)(px|rem)\\])" + // 1 named | 2,3 arbitrary
    "|tracking-\\[(-?\\d*\\.?\\d+(?:px|em))\\]" + // 4
    "|rounded(-(?:tl|tr|bl|br|ss|se|ee|es|t|r|b|l|s|e))?-\\[(\\d+)px\\]" + // 5 side, 6 px
    ")",
  "g",
);

const counts = new Map();
const unmapped = [];
const bump = (k) => counts.set(k, (counts.get(k) ?? 0) + 1);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

let filesChanged = 0;
for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  if (SKIP.has(rel)) continue;
  const exception = EXCEPTION.some((d) => rel.startsWith(d));
  const src = fs.readFileSync(file, "utf8");
  const lineOf = (i) => src.slice(0, i).split("\n").length;

  const out = src.replace(RE, (m, named, num, unit, track, side, rpx, offset) => {
    if (named) {
      const px = OLD_PX[named];
      let to;
      if (NAMED[px]) to = `text-${NAMED[px]}`;
      else if (exception) to = `text-[${px}px]`;
      else to = px === 30 ? "text-3xl" : "text-4xl";
      bump(`A ${exception ? "[exc] " : ""}text-${named} (${px}px) -> ${to}`);
      return to;
    }
    if (num !== undefined) {
      if (exception) return m;
      const px = Math.round(parseFloat(num) * (unit === "rem" ? 16 : 1) * 1000) / 1000;
      const to = ARB[px];
      if (!to) {
        unmapped.push(`${rel}:${lineOf(offset)}  ${m} (${px}px)`);
        return m;
      }
      bump(`B ${m.replace(/^text-/, "")} (${px}px) -> text-${to}`);
      return `text-${to}`;
    }
    if (track !== undefined) {
      if (exception) return m;
      const to = TRACK[track];
      if (!to) {
        unmapped.push(`${rel}:${lineOf(offset)}  ${m}`);
        return m;
      }
      bump(`C tracking-[${track}] -> tracking-${to}`);
      return `tracking-${to}`;
    }
    if (rpx !== undefined) {
      if (exception) return m;
      const to = RADIUS[rpx];
      if (!to) {
        unmapped.push(`${rel}:${lineOf(offset)}  ${m}`);
        return m;
      }
      const base = `rounded${side ?? ""}`;
      bump(`D ${base}-[${rpx}px] -> ${base}-${to}`);
      return `${base}-${to}`;
    }
    return m;
  });

  if (out !== src) {
    filesChanged++;
    if (!DRY) fs.writeFileSync(file, out, "utf8");
  }
}

console.log(`${DRY ? "[dry run] " : ""}files changed: ${filesChanged}`);
console.log("\n== replacements ==");
let total = 0;
for (const [k, v] of [...counts].sort()) {
  console.log(String(v).padStart(5), k);
  total += v;
}
console.log(String(total).padStart(5), "TOTAL");
console.log(`\n== left alone: unmapped arbitrary text sizes / tracking / radii (${unmapped.length}) ==`);
for (const u of unmapped) console.log(u);
