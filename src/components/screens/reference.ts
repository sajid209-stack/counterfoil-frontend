/**
 * The code on an error page: something short a person can read to support and
 * we can find in the logs.
 *
 * Next hands server errors a `digest` (a hash that matches the server log), so
 * that is used when there is one. A client error has none, so one is made from
 * the message — same error, same code — rather than from the clock, which would
 * give a different code every time someone reloads and tries again.
 *
 * Letters and digits only, no 0/O/1/I to misread over the phone.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function errorReference(error?: { digest?: string; message?: string } | null): string {
  const seed = error?.digest || error?.message || "unknown";
  // FNV-1a: tiny, stable, no dependency.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[h % ALPHABET.length];
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  }
  return `CF-${out.slice(0, 3)}-${out.slice(3)}`;
}
