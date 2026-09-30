// English and Bangla must carry the same keys and the same {placeholders}.
// A rewrite that renames {days} in one language shows a raw "{days}" in the
// other, and a missing key shows the key's path — both on a live screen.
//
//   node scripts/check-i18n.mjs            every namespace
//   node scripts/check-i18n.mjs catalog    one namespace
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../src/messages/", import.meta.url);
const only = process.argv[2];
const flat = (o, p = "", out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? `${p}.${k}` : k;
    if (v && typeof v === "object") flat(v, key, out);
    else out[key] = String(v);
  }
  return out;
};
/* Top-level ICU arguments only: {name}, {count, plural, ...} → name, count.
   Inner words of a plural branch are not arguments. */
const args = (s) => {
  const out = new Set();
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") {
      if (depth === 0) {
        const m = /^\{\s*([A-Za-z_][\w]*)/.exec(s.slice(i));
        if (m) out.add(m[1]);
      }
      depth++;
    } else if (s[i] === "}") depth = Math.max(0, depth - 1);
  }
  return [...out].sort().join(",");
};

let problems = 0;
for (const file of readdirSync(new URL("en/", dir))) {
  const ns = file.replace(/\.json$/, "");
  if (only && ns !== only) continue;
  const en = flat(JSON.parse(readFileSync(new URL(`en/${file}`, dir), "utf8")));
  const bn = flat(JSON.parse(readFileSync(new URL(`bn/${file}`, dir), "utf8")));
  for (const k of Object.keys(en)) {
    if (!(k in bn)) { console.log(`${ns}: missing in bn — ${k}`); problems++; continue; }
    if (args(en[k]) !== args(bn[k])) { console.log(`${ns}: placeholders differ — ${k}  en{${args(en[k])}} bn{${args(bn[k])}}`); problems++; }
  }
  for (const k of Object.keys(bn)) if (!(k in en)) { console.log(`${ns}: extra in bn — ${k}`); problems++; }
}
console.log(problems ? `\n${problems} problem(s)` : "i18n: 0 missing / 0 extra / placeholders match");
process.exit(problems ? 1 : 0);
