/*
 * Passwords and till PINs for team members — the rules, and the mock's vault.
 *
 * The rules are pure so the form can say what is wrong while someone types and
 * the api can refuse the same thing in the same words. The vault is the mock
 * backend's stand-in for a credential store: it holds a FAKE hash per person
 * (never the text), apart from the Staff records, so nothing that renders can
 * read a password back. A real backend replaces `vault` and `verifyPin`.
 */

/** Today's demo PIN: what everyone without a PIN of their own signs in with. */
export const DEMO_PIN = "1234";
export const MIN_PASSWORD = 8;

const COMMON = new Set([
  "password", "password1", "passw0rd", "12345678", "123456789", "1234567890", "qwertyui", "qwertyuiop",
  "iloveyou", "11111111", "00000000", "abcd1234", "welcome1", "letmein1", "admin123", "bangladesh",
]);

export type PasswordContext = { email?: string | null; phone?: string | null; name?: string | null };

const digits = (s: string) => s.replace(/\D/g, "");

export type PasswordIssue =
  | { code: "short"; min: number; have: number }
  | { code: "email" }
  | { code: "phone" }
  | { code: "common" };

/**
 * Why a password is refused, as a code a screen can say in the reader's own
 * language — or null when it is acceptable. The api formats the same codes in
 * English (`passwordProblem`) for its own refusals.
 */
export function passwordIssue(pw: string, who: PasswordContext = {}): PasswordIssue | null {
  if (pw.length < MIN_PASSWORD) return { code: "short", min: MIN_PASSWORD, have: pw.length };
  const lower = pw.trim().toLowerCase();
  const email = who.email?.trim().toLowerCase();
  if (email && (lower === email || lower === email.split("@")[0])) return { code: "email" };
  const phone = digits(who.phone ?? "");
  if (phone.length >= 6 && digits(pw) === phone) return { code: "phone" };
  if (COMMON.has(lower) || /^(.)\1+$/.test(pw)) return { code: "common" };
  return null;
}

/** The reason a password is refused, in words — or null when it is acceptable. */
export function passwordProblem(pw: string, who: PasswordContext = {}): string | null {
  const i = passwordIssue(pw, who);
  if (!i) return null;
  switch (i.code) {
    case "short": return `Use at least ${i.min} characters. This has ${i.have}.`;
    case "email": return "Don't use their email address as the password.";
    case "phone": return "Don't use their phone number as the password.";
    default: return "That password is too easy to guess. Mix words, numbers and a capital letter.";
  }
}

export type StrengthKey = "empty" | "weak" | "fair" | "good" | "strong";

/** 0 to 4, and the plain word for it. Presentation only: the rules above decide what is accepted. */
export function passwordStrength(pw: string): { level: 0 | 1 | 2 | 3 | 4; key: StrengthKey } {
  if (!pw) return { level: 0, key: "empty" };
  if (pw.length < MIN_PASSWORD || COMMON.has(pw.toLowerCase()) || /^(.)\1+$/.test(pw)) return { level: 1, key: "weak" };
  let score = 0;
  if (pw.length >= 10) score += 1;
  if (pw.length >= 14) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw) && /[a-zA-Z]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 1) return { level: 2, key: "fair" };
  if (score <= 3) return { level: 3, key: "good" };
  return { level: 4, key: "strong" };
}

export type PinIssue = "digits" | "length" | "repeat" | "run";

/** A PIN's problem as a code, or null. 4 to 6 digits, nothing guessable. */
export function pinIssue(pin: string): PinIssue | null {
  if (!/^\d+$/.test(pin)) return "digits";
  if (pin.length < 4 || pin.length > 6) return "length";
  if (/^(\d)\1+$/.test(pin)) return "repeat";
  const d = pin.split("").map(Number);
  const step = (n: number) => d.every((x, i) => i === 0 || x - d[i - 1] === n);
  if (step(1) || step(-1)) return "run";
  return null;
}

const PIN_WORDS: Record<PinIssue, string> = {
  digits: "A PIN is digits only, 4 to 6 of them.",
  length: "Use 4 to 6 digits.",
  repeat: "Repeated digits like 1111 are too easy to guess.",
  run: "Runs of digits like 1234 are too easy to guess.",
};

/** A PIN's problem in words, or null. */
export function pinProblem(pin: string): string | null {
  const i = pinIssue(pin);
  return i ? PIN_WORDS[i] : null;
}

/** A random PIN that passes `pinProblem`. */
export function generatePin(length = 4): string {
  for (let i = 0; i < 200; i++) {
    let p = "";
    for (let k = 0; k < length; k++) p += String(Math.floor(Math.random() * 10));
    if (!pinProblem(p)) return p;
  }
  return length === 6 ? "482915" : length === 5 ? "73952" : "4829";
}

// ── the mock's vault ───────────────────────────────────────────────────────
// Not a real hash: enough that the stored value is not the text and that two
// people with the same PIN do not share one. Module-private on purpose.
const fake = (id: string, secret: string) => {
  let h = 5381;
  for (const ch of `${id}\u0000${secret}`) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return `fake$${(h >>> 0).toString(36)}`;
};

const vault = new Map<string, { password?: string; pin?: string }>();

export function storeSecrets(id: string, s: { password?: string; pin?: string }) {
  const cur = vault.get(id) ?? {};
  vault.set(id, {
    password: s.password !== undefined ? fake(id, s.password) : cur.password,
    pin: s.pin !== undefined ? fake(id, s.pin) : cur.pin,
  });
}

/** Does this PIN open this person's till? Anyone without a PIN of their own uses the demo one. */
export function verifyPin(id: string, pin: string): boolean {
  const own = vault.get(id)?.pin;
  return own ? own === fake(id, pin) : pin === DEMO_PIN;
}

/** Mock sign-in check for a password, for tests of the vault only. */
export function verifyPassword(id: string, pw: string): boolean {
  const own = vault.get(id)?.password;
  return !!own && own === fake(id, pw);
}
