/* Links an operator types onto a public page: a host's social accounts, a sponsor's
   site. They reach the page as text and leave it as an href, so this is the one
   place that decides what may be followed. Only http and https: a `javascript:`
   address on a published page would run in every visitor's browser. */

/** A link as typed ("instagram.com/x", "https://x.com/y") ready for an href, or null if it isn't a web address. */
export function externalHref(raw: string | undefined | null): string | null {
  const typed = raw?.trim();
  if (!typed || /\s/.test(typed)) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(typed) && !/^[^/]+:\d+(\/|$)/.test(typed);
  try {
    const url = new URL(hasScheme ? typed : `https://${typed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.includes(".") ? url.href : null;
  } catch {
    return null;
  }
}

export type LinkPlatform = "facebook" | "instagram" | "x" | "youtube" | "linkedin" | "tiktok" | "whatsapp" | "website";

const PLATFORMS: [RegExp, LinkPlatform][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(x\.com|twitter\.com)$/, "x"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
];

/** Which service a link goes to, from its address, so nobody has to choose it from a list. */
export function linkPlatform(href: string): LinkPlatform {
  let host: string;
  try {
    host = new URL(href).hostname.toLowerCase();
  } catch {
    return "website";
  }
  return PLATFORMS.find(([re]) => re.test(host))?.[1] ?? "website";
}
