#!/usr/bin/env node
// Design-system compliance checker (docs/design-system.md §12 Exceptions, §13 Enforcement).
//
//   node scripts/check-design-tokens.mjs                  every rule, summary + first 30 lines per rule
//   node scripts/check-design-tokens.mjs --all            every line of every rule
//   node scripts/check-design-tokens.mjs --rule arb-text  one rule (repeat the flag, or comma-separate)
//   node scripts/check-design-tokens.mjs --json           machine-readable output (all violations, exempt ones marked)
//   node scripts/check-design-tokens.mjs --strict         warnings fail the run too
//   node scripts/check-design-tokens.mjs --show-exempt    also list exempt violations and why
//   node scripts/check-design-tokens.mjs --no-exempt      ignore the allowlist and ds-exception markers (audit)
//   node scripts/check-design-tokens.mjs --css <file>     read this stylesheet for theme-sync / dead-token
//   node scripts/check-design-tokens.mjs --src <dir>      scan another directory instead of src/ (testing)
//
// Exit code 1 when any NON-exempt ERROR exists (among the selected rules). Warnings never fail unless --strict.
// Plain node ESM, no dependencies. Exemptions live in scripts/design-tokens.allow.json so they are reviewable;
// a single line is exempted with `// ds-exception: <reason>` or `{/* ds-exception: <reason> */}` on that line or
// on a comment-only line directly above it. A marker without a reason exempts nothing and is itself an error.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOW_FILE = join(ROOT, "scripts", "design-tokens.allow.json");

// ───────────────────────────── rules ─────────────────────────────
const RULES = {
  "arb-text": { sev: "error", hint: "arbitrary font size -> use a text-* step (2xs..display)" },
  "arb-radius": { sev: "error", hint: "arbitrary radius -> rounded-xs/sm/md/lg/full or rounded-card/control/inner/sheet" },
  "arb-shadow": { sev: "error", hint: "arbitrary shadow -> shadow-sm/md/lg/card/float" },
  "arb-duration": { sev: "error", hint: "arbitrary motion -> duration-quick/standard/considered, ease-counterfoil" },
  "arb-z": { sev: "error", hint: "arbitrary z-index -> a named layer / z-10..z-50" },
  "arb-space": { sev: "error", hint: "arbitrary spacing -> a spacing token or a Tailwind step (error: off the 4px grid, warning: on-grid, use a token/step)" },
  "raw-colour": { sev: "error", hint: "raw colour literal -> a --color-* token" },
  "faint-content": { sev: "warning", hint: "text-faint is only for placeholder:/disabled: (2.09:1)" },
  "mono-money": { sev: "warning", hint: "font-mono next to formatted money -> DM Mono is for identifiers only" },
  "theme-sync": { sev: "error", hint: ".dark and .light/.paper/.sf must assign the same custom properties" },
  "dead-token": { sev: "warning", hint: "@theme token that no file in src uses" },
  "exception-reason": { sev: "error", hint: "ds-exception marker needs a reason" },
};
const RULE_NAMES = Object.keys(RULES);

// ───────────────────────────── cli ─────────────────────────────
const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const values = (n) => argv.flatMap((a, i) => (a === n && argv[i + 1] ? argv[i + 1].split(",") : []));
if (has("--help") || has("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 15).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(0);
}
const OPT = {
  all: has("--all"),
  json: has("--json"),
  strict: has("--strict"),
  showExempt: has("--show-exempt"),
  noExempt: has("--no-exempt"),
  css: values("--css")[0],
  src: values("--src")[0], // test hook: scan another directory (paths are then relative to its parent)
};
const SRC = OPT.src ? resolve(ROOT, OPT.src) : join(ROOT, "src");
const BASE = dirname(SRC);
const selected = values("--rule").length ? values("--rule") : RULE_NAMES;
for (const r of selected) {
  if (!RULES[r]) {
    console.error(`Unknown rule "${r}". Rules: ${RULE_NAMES.join(", ")}`);
    process.exit(2);
  }
}
const on = (rule) => selected.includes(rule);

// ───────────────────────────── allowlist ─────────────────────────────
const globRe = (g) =>
  new RegExp(
    "^" +
      g
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "\u0000")
        .replace(/\*/g, "[^/]*")
        .replace(/\u0000/g, ".*") +
      "$",
  );
let ALLOW = { exemptPaths: [], exemptMatches: [], deadTokenIgnore: [] };
if (existsSync(ALLOW_FILE)) ALLOW = { ...ALLOW, ...JSON.parse(readFileSync(ALLOW_FILE, "utf8")) };
const allowErrors = [];
const need = (entry, where) => {
  if (!entry.reason || !String(entry.reason).trim()) allowErrors.push(`${where}: every exemption needs a reason`);
};
const pathExempt = ALLOW.exemptPaths.map((e, i) => {
  need(e, `exemptPaths[${i}] ${e.path}`);
  return { re: globRe(e.path), rules: e.rules ?? ["*"], reason: e.reason };
});
const matchExempt = ALLOW.exemptMatches.map((e, i) => {
  need(e, `exemptMatches[${i}] ${e.rule}`);
  return { rule: e.rule, re: new RegExp(e.match), reason: e.reason, paths: e.paths ? e.paths.map(globRe) : null };
});
const deadIgnore = ALLOW.deadTokenIgnore.map((e, i) => {
  need(e, `deadTokenIgnore[${i}]`);
  return { re: new RegExp(e.match), reason: e.reason };
});
if (allowErrors.length) {
  console.error(allowErrors.join("\n"));
  process.exit(2);
}

// ───────────────────────────── source preparation ─────────────────────────────
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      walk(p, out);
    } else if (/\.(ts|tsx|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

/* Blank out comments (keeping every newline, so offsets and line numbers survive). Strings and template
   literals are tracked so a "//" inside a URL or a class string is not taken for a comment; template
   literals nest (`${ cond ? `a` : `b` }`), so there is a small stack. A quote ends at end of line, which
   contains the damage of an apostrophe in JSX text ("Don't") to that one line. */
function blankComments(src) {
  const out = src.split("");
  const n = src.length;
  const stack = [];
  const blank = (a, b) => {
    for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = " ";
  };
  let i = 0;
  while (i < n) {
    const top = stack[stack.length - 1];
    const c = src[i];
    const d = src[i + 1];
    if (top && top.type === "tpl") {
      if (c === "\\") i += 2;
      else if (c === "`") (stack.pop(), i++);
      else if (c === "$" && d === "{") (stack.push({ type: "expr", depth: 0 }), (i += 2));
      else i++;
      continue;
    }
    if (c === "/" && d === "/") {
      let j = src.indexOf("\n", i);
      if (j < 0) j = n;
      blank(i, j);
      i = j;
    } else if (c === "/" && d === "*") {
      let j = src.indexOf("*/", i + 2);
      j = j < 0 ? n : j + 2;
      blank(i, j);
      i = j;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") {
        if (src[j] === "\\") j++;
        j++;
      }
      i = j + 1;
    } else if (c === "`") {
      stack.push({ type: "tpl" });
      i++;
    } else {
      if (top && top.type === "expr") {
        if (c === "{") top.depth++;
        else if (c === "}") {
          if (top.depth === 0) stack.pop();
          else top.depth--;
        }
      }
      i++;
    }
  }
  return out.join("");
}
const blankCssComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

const files = walk(SRC).map((abs) => {
  const rel = relative(BASE, abs).split(sep).join("/");
  const raw = readFileSync(abs, "utf8").replace(/\r/g, "");
  const css = rel.endsWith(".css");
  return { rel, abs, raw, css, code: css ? blankCssComments(raw) : blankComments(raw) };
});

const violations = [];
const lineTable = new WeakMap();
function lineOf(file, idx) {
  let starts = lineTable.get(file);
  if (!starts) {
    starts = [0];
    for (let k = 0; k < file.code.length; k++) if (file.code[k] === "\n") starts.push(k + 1);
    lineTable.set(file, starts);
  }
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= idx) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: idx - starts[lo] + 1 };
}
const seen = new Set();
function add(file, rule, idx, match, severity = RULES[rule].sev, note) {
  const { line, col } = lineOf(file, idx);
  const key = `${rule}|${file.rel}|${line}|${col}`;
  if (seen.has(key)) return;
  seen.add(key);
  violations.push({ rule, severity, file: file.rel, line, col, match, note, exempt: null });
}

// ───────────────────────────── ds-exception markers ─────────────────────────────
const markerCache = new Map();
function markersOf(file) {
  let m = markerCache.get(file.rel);
  if (m) return m;
  m = new Map();
  file.raw.split("\n").forEach((text, i) => {
    const at = text.indexOf("ds-exception:");
    if (at < 0) return;
    const reason = text
      .slice(at + "ds-exception:".length)
      .replace(/\*\/\s*\}?\s*$/, "")
      .replace(/\}\s*$/, "")
      .trim();
    const t = text.trim();
    const commentOnly = /^(\/\/|\/\*|\{\/\*|\*)/.test(t);
    m.set(i + 1, { reason, commentOnly });
  });
  markerCache.set(file.rel, m);
  return m;
}

// ───────────────────────────── per-file rules ─────────────────────────────
const SPACE_PROP =
  "(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left|start|end)";
const RE = {
  text: /(?<![\w-])text-\[(-?\d*\.?\d+)(px|rem|em)\]/g,
  radius: /(?<![\w-])rounded(?:-(?:[trblse]|tl|tr|bl|br|ss|se|ee|es))?-\[[^\]\s]+\]/g,
  shadow: /(?<![\w-])(?:drop-|inset-|text-)?shadow-\[[^\]\s]+\]/g,
  duration: /(?<![\w-])(?:duration|ease)-\[[^\]\s]+\]/g,
  z: /(?<![\w-])-?z-\[[^\]\s]+\]/g,
  space: new RegExp(`(?<![\\w-])-?${SPACE_PROP}-\\[([^\\]\\s]*)\\]`, "g"),
  colourClass: /(?<![\w-])(?:bg|text|border|ring|fill|stroke|from|to|via)-\[(?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|oklch\()[^\]\s]*\]/g,
  hex: /(?<![\w&#/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9A-Za-z])/g,
  colourFn: /(?<![\w-])(?:rgba?|hsla?|oklch|oklab)\(\s*(?!var\()/g,
  faint: /(?<![\w-])text-faint(?![\w-])/g,
};
const FAINT_OK = /^(?:(?:group|peer)-)?(?:placeholder|disabled|aria-disabled|data-disabled|data-\[disabled\])$/;

function scanClasses(file) {
  const { code } = file;
  for (const m of code.matchAll(RE.text)) add(file, "arb-text", m.index, m[0]);
  for (const m of code.matchAll(RE.radius)) add(file, "arb-radius", m.index, m[0]);
  for (const m of code.matchAll(RE.shadow)) add(file, "arb-shadow", m.index, m[0]);
  for (const m of code.matchAll(RE.duration)) add(file, "arb-duration", m.index, m[0]);
  for (const m of code.matchAll(RE.z)) add(file, "arb-z", m.index, m[0]);
  for (const m of code.matchAll(RE.space)) {
    const v = /^(-?\d*\.?\d+)(px|rem)$/.exec(m[1]); // calc(), var(), % are layout maths, not spacing steps
    if (!v) continue;
    const px = parseFloat(v[1]) * (v[2] === "rem" ? 16 : 1);
    const onGrid = Math.abs(px / 4 - Math.round(px / 4)) < 1e-6;
    add(file, "arb-space", m.index, m[0], onGrid ? "warning" : "error", onGrid ? `${px}px is on the 4px grid` : `${px}px is off the 4px grid`);
  }
  if (!file.css) scanColours(file);
  for (const m of code.matchAll(RE.faint)) {
    let s = m.index;
    while (s > 0 && !/[\s"'`{}()]/.test(code[s - 1])) s--;
    const prefix = code.slice(s, m.index);
    if (prefix.split(":").some((seg) => FAINT_OK.test(seg))) continue;
    // a string that is itself guarded by a disabled flag: `o.disabled && "text-faint"`, `disabled ? "text-faint" : …`
    const before = code.slice(code.lastIndexOf("\n", m.index) + 1, m.index);
    if (/[dD]isabled\w*\s*&&[^|]*$/.test(before) || /[dD]isabled\w*\s*\?[^:]*$/.test(before)) continue;
    add(file, "faint-content", m.index, prefix + m[0]);
  }
  if (!file.css) scanMonoMoney(file);
}

function scanColours(file) {
  const { code } = file;
  const spans = [];
  for (const m of code.matchAll(RE.colourClass)) {
    spans.push([m.index, m.index + m[0].length]);
    add(file, "raw-colour", m.index, m[0]);
  }
  const inClass = (i) => spans.some(([a, b]) => i >= a && i < b);
  for (const m of code.matchAll(RE.hex)) {
    if (inClass(m.index)) continue;
    const h = m[0].slice(1);
    if (/^\d+$/.test(h) && (h.length === 4 || h.length === 8)) continue; // "#1042" is an order number, not a colour
    add(file, "raw-colour", m.index, m[0]);
  }
  for (const m of code.matchAll(RE.colourFn)) {
    if (inClass(m.index)) continue;
    add(file, "raw-colour", m.index, m[0].trim());
  }
}

/* JSX open tag helpers, for mono-money. tagEnd scans from "<" to the ">" that closes the tag, skipping
   braces and strings (attribute values contain "=>" and comparisons). */
function tagEnd(code, start) {
  let depth = 0;
  let quote = null;
  for (let i = start + 1; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth <= 0) return { end: i, selfClosing: code[i - 1] === "/" };
  }
  return { end: code.length, selfClosing: true };
}
const MONEY = /\bformat(?:Money\w*|PriceShort)\s*\(/;
function scanMonoMoney(file) {
  const { code } = file;
  if (!code.includes("font-mono")) return;
  const openers = [...code.matchAll(/<([A-Za-z][\w.]*)(?=[\s/>])/g)];
  for (const m of code.matchAll(/(?<![\w-])font-mono(?![\w-])/g)) {
    const p = m.index;
    let tag = null;
    for (let k = openers.length - 1, tries = 0; k >= 0 && tries < 60; k--) {
      if (openers[k].index >= p) continue;
      tries++;
      const te = tagEnd(code, openers[k].index);
      if (te.end >= p) {
        tag = { name: openers[k][1], ...te };
        break;
      }
    }
    if (!tag || tag.selfClosing) continue;
    const re = /<(\/?)([A-Za-z][\w.]*)(?=[\s/>])/g;
    re.lastIndex = tag.end + 1;
    let depth = 1;
    let close = -1;
    for (let t = re.exec(code); t; t = re.exec(code)) {
      if (t[2] !== tag.name) continue;
      if (t[1]) {
        if (--depth === 0) {
          close = t.index;
          break;
        }
      } else if (!tagEnd(code, t.index).selfClosing) depth++;
    }
    if (close < 0) continue;
    if (MONEY.test(code.slice(tag.end + 1, close))) add(file, "mono-money", p, "font-mono", undefined, `<${tag.name}> formats money`);
  }
}

// ───────────────────────────── stylesheet rules ─────────────────────────────
function parseCss(css) {
  const blocks = [];
  const stack = [];
  let buf = "";
  let stmtStart = -1;
  let paren = 0;
  let quote = null;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      buf += c;
      if (c === "\\") buf += css[++i] ?? "";
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      if (stmtStart < 0) stmtStart = i;
      buf += c;
      continue;
    }
    if (c === "(") paren++;
    else if (c === ")") paren = Math.max(0, paren - 1);
    if (paren === 0 && c === "{") {
      const b = { selector: buf.trim(), decls: [], at: buf.trim().startsWith("@") };
      blocks.push(b);
      stack.push(b);
      buf = "";
      stmtStart = -1;
      continue;
    }
    if (paren === 0 && (c === ";" || c === "}")) {
      const stmt = buf.trim();
      const top = stack[stack.length - 1];
      if (stmt && top) {
        const m = /^(--[\w-]+)\s*:\s*([\s\S]*)$/.exec(stmt);
        if (m) top.decls.push({ name: m[1], value: m[2].trim(), idx: stmtStart });
      }
      buf = "";
      stmtStart = -1;
      if (c === "}") stack.pop();
      continue;
    }
    if (stmtStart < 0 && !/\s/.test(c)) stmtStart = i;
    buf += c;
  }
  return blocks;
}

function scanThemeSync(sheet) {
  const blocks = parseCss(sheet.code);
  const sels = (b) => (b.at ? [] : b.selector.split(",").map((s) => s.trim()));
  const dark = blocks.filter((b) => sels(b).some((s) => /^(?:html|:root)?\.dark$/.test(s)));
  const light = blocks.filter((b) => sels(b).some((s) => /^(?:html|:root)?\.light$/.test(s)));
  if (!dark.length) {
    add(sheet, "theme-sync", 0, ".dark", undefined, "no `.dark { … }` block with custom properties found — dark mode overrides nothing");
    return;
  }
  if (!light.length) {
    add(sheet, "theme-sync", 0, ".light", undefined, "no `.light, .paper, .sf { … }` block found — a light island inside a dark page has no token set");
    return;
  }
  const collect = (list) => {
    const m = new Map();
    for (const b of list) for (const d of b.decls) if (!m.has(d.name)) m.set(d.name, d.idx);
    return m;
  };
  const d = collect(dark);
  const l = collect(light);
  for (const [name, idx] of d) if (!l.has(name)) add(sheet, "theme-sync", idx, name, undefined, "assigned in .dark but missing from the .light/.paper/.sf block");
  for (const [name, idx] of l) if (!d.has(name)) add(sheet, "theme-sync", idx, name, undefined, "assigned in the .light/.paper/.sf block but missing from .dark");
}

function scanDeadTokens(sheet) {
  const blocks = parseCss(sheet.code);
  const defs = [];
  for (const b of blocks) {
    if (!/^@theme\b/.test(b.selector)) continue;
    for (const d of b.decls) {
      const m = /^--(color|radius|shadow|text)-(.+)$/.exec(d.name);
      if (m && !m[2].includes("--")) defs.push({ name: d.name, kind: m[1], key: m[2], idx: d.idx });
    }
  }
  // Every "--x" in src that is not being assigned, and every class-ish word.
  const refs = new Set();
  const words = new Set();
  for (const f of files) {
    for (const m of f.code.matchAll(/(--[A-Za-z0-9_-]+)(\s*:)?/g)) if (!m[2]) refs.add(m[1]);
    for (const m of f.code.matchAll(/[A-Za-z0-9_-]+/g)) words.add(m[0]);
  }
  const PREFIX = {
    color: ["bg", "text", "border", "border-t", "border-r", "border-b", "border-l", "border-x", "border-y", "border-s", "border-e", "divide", "outline", "ring", "ring-offset", "inset-ring", "fill", "stroke", "from", "via", "to", "decoration", "accent", "caret", "shadow", "inset-shadow", "drop-shadow", "placeholder"],
    radius: ["rounded", ...["t", "r", "b", "l", "s", "e", "tl", "tr", "bl", "br", "ss", "se", "es", "ee"].map((s) => `rounded-${s}`)],
    shadow: ["shadow", "drop-shadow", "inset-shadow"],
    text: ["text"],
  };
  for (const d of defs) {
    const used = refs.has(d.name) || PREFIX[d.kind].some((p) => words.has(`${p}-${d.key}`));
    if (!used) add(sheet, "dead-token", d.idx, d.name, undefined, "defined in @theme, no utility or var() uses it");
  }
}

for (const f of files) scanClasses(f);
let sheet = files.find((f) => f.rel === "src/app/globals.css");
if (OPT.css) {
  const raw = readFileSync(resolve(ROOT, OPT.css), "utf8").replace(/\r/g, "");
  sheet = { rel: OPT.css, raw, css: true, code: blankCssComments(raw) };
}
if (sheet) {
  if (on("theme-sync")) scanThemeSync(sheet);
  if (on("dead-token")) scanDeadTokens(sheet);
} else if (on("theme-sync")) {
  violations.push({ rule: "theme-sync", severity: "error", file: "src/app/globals.css", line: 1, col: 1, match: "globals.css", note: "stylesheet not found", exempt: null });
}

// reasonless markers are errors of their own, wherever they sit in a scanned file
for (const f of files) {
  for (const [line, mk] of markersOf(f)) {
    if (mk.reason) continue;
    const key = `exception-reason|${f.rel}|${line}|1`;
    if (seen.has(key)) continue;
    seen.add(key);
    violations.push({ rule: "exception-reason", severity: "error", file: f.rel, line, col: 1, match: "ds-exception:", note: "marker has no reason", exempt: null });
  }
}

// ───────────────────────────── exemptions ─────────────────────────────
const fileByRel = new Map(files.map((f) => [f.rel, f]));
for (const v of violations) {
  if (OPT.noExempt) break;
  const pe = pathExempt.find((e) => e.re.test(v.file) && (e.rules.includes("*") || e.rules.includes(v.rule)));
  if (pe) {
    v.exempt = `§12 path: ${pe.reason}`;
    continue;
  }
  const me = matchExempt.find((e) => e.rule === v.rule && e.re.test(v.match) && (!e.paths || e.paths.some((p) => p.test(v.file))));
  if (me) {
    v.exempt = `§12 value: ${me.reason}`;
    continue;
  }
  if (v.rule === "dead-token") {
    const di = deadIgnore.find((e) => e.re.test(v.match));
    if (di) {
      v.exempt = `allowlist: ${di.reason}`;
      continue;
    }
  }
  const f = fileByRel.get(v.file);
  if (f && v.rule !== "exception-reason") {
    const mk = markersOf(f);
    const same = mk.get(v.line);
    const above = mk.get(v.line - 1);
    const hit = same?.reason ? same : above?.commentOnly && above.reason ? above : null;
    if (hit) v.exempt = `ds-exception: ${hit.reason}`;
  }
}

// ───────────────────────────── report ─────────────────────────────
const live = violations.filter((v) => on(v.rule));
const stat = Object.fromEntries(selected.map((r) => [r, { errors: 0, warnings: 0, exempt: 0 }]));
for (const v of live) {
  const s = stat[v.rule];
  if (v.exempt) s.exempt++;
  else if (v.severity === "error") s.errors++;
  else s.warnings++;
}
const totals = Object.values(stat).reduce((a, s) => ({ errors: a.errors + s.errors, warnings: a.warnings + s.warnings, exempt: a.exempt + s.exempt }), { errors: 0, warnings: 0, exempt: 0 });
const failed = totals.errors > 0 || (OPT.strict && totals.warnings > 0);

if (OPT.json) {
  const order = (a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1);
  console.log(
    JSON.stringify(
      {
        filesScanned: files.length,
        rules: selected,
        summary: selected.map((r) => ({ rule: r, ...stat[r] })),
        totals,
        failed,
        violations: live.sort(order).map((v) => ({ rule: v.rule, severity: v.severity, file: v.file, line: v.line, column: v.col, match: v.match, note: v.note ?? null, exempt: !!v.exempt, exemptReason: v.exempt })),
      },
      null,
      2,
    ),
  );
  process.exit(failed ? 1 : 0);
}

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => paint(31, s);
const yellow = (s) => paint(33, s);
const dim = (s) => paint(2, s);
const bold = (s) => paint(1, s);

const w = Math.max(...selected.map((r) => r.length), 5);
console.log(bold(`Design-token check`) + dim(` — ${files.length} files in src/ scanned${OPT.noExempt ? " (exemptions ignored)" : ""}`));
console.log("");
console.log(`${"Rule".padEnd(w)}  ${"Errors".padStart(6)}  ${"Warnings".padStart(8)}  ${"Exempt".padStart(6)}`);
console.log(`${"-".repeat(w)}  ${"-".repeat(6)}  ${"-".repeat(8)}  ${"-".repeat(6)}`);
for (const r of selected) {
  const s = stat[r];
  console.log(
    `${r.padEnd(w)}  ${(s.errors ? red : dim)(String(s.errors).padStart(6))}  ${(s.warnings ? yellow : dim)(String(s.warnings).padStart(8))}  ${dim(String(s.exempt).padStart(6))}`,
  );
}
console.log(`${"-".repeat(w)}  ${"-".repeat(6)}  ${"-".repeat(8)}  ${"-".repeat(6)}`);
console.log(`${"Total".padEnd(w)}  ${String(totals.errors).padStart(6)}  ${String(totals.warnings).padStart(8)}  ${String(totals.exempt).padStart(6)}`);

const CAP = 30;
for (const r of selected) {
  const mine = live.filter((v) => v.rule === r && (!v.exempt || OPT.showExempt)).sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
  if (!mine.length) continue;
  const open = mine.filter((v) => !v.exempt).length;
  console.log("");
  console.log(bold(`${r}`) + dim(` — ${RULES[r].hint}`) + `  (${open}${mine.length !== open ? ` + ${mine.length - open} exempt` : ""})`);
  const shown = OPT.all ? mine : mine.slice(0, CAP);
  const pad = Math.min(70, Math.max(...shown.map((v) => `${v.file}:${v.line}`.length)));
  for (const v of shown) {
    const loc = `${v.file}:${v.line}`.padEnd(pad);
    const tag = v.exempt ? dim("exempt ") : v.severity === "warning" ? yellow("warn   ") : red("error  ");
    const tail = v.exempt ? dim(` — ${v.exempt}`) : v.note ? dim(` — ${v.note}`) : "";
    console.log(`  ${loc}  ${tag}${v.match}${tail}`);
  }
  if (!OPT.all && mine.length > CAP) console.log(dim(`  … ${mine.length - CAP} more (use --all)`));
}

console.log("");
if (failed) console.log(red(bold(`FAIL`)) + ` — ${totals.errors} error${totals.errors === 1 ? "" : "s"}${OPT.strict ? `, ${totals.warnings} warning${totals.warnings === 1 ? "" : "s"} (--strict)` : ""}; ${totals.warnings} warning${totals.warnings === 1 ? "" : "s"}, ${totals.exempt} exempt.`);
else console.log(bold(`PASS`) + ` — 0 errors; ${totals.warnings} warning${totals.warnings === 1 ? "" : "s"}, ${totals.exempt} exempt.`);
process.exit(failed ? 1 : 0);
