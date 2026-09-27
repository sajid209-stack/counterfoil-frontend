/**
 * One substitution rule for every message the operator writes.
 *
 * The SMS has had this since the ticket wording became theirs; the e-mail now
 * uses the same one, so a placeholder typed into a subject line behaves
 * exactly as it does in a text message. Two renderers would be two sets of
 * rules about what `{code}` means.
 *
 * An unknown placeholder passes through untouched, so a typo is visible in the
 * preview rather than silently dropped into a customer's inbox.
 */
export function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

/** What a placeholder is, for the chips that insert it. */
export interface Placeholder {
  key: string;
  means: string;
}
