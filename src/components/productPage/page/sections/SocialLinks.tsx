"use client";

import { useTranslations } from "next-intl";
import { externalHref, linkPlatform } from "@/lib/externalLink";
import type { ExternalLink } from "@/lib/api/events";
import { BrandIcon, linkPlatformName } from "./BrandIcon";

/**
 * A row of round icon links to a host's accounts and sites. The addresses are
 * typed by the operator on a public page, so each goes through `externalHref`
 * and one that is not a web address simply is not drawn.
 */
export function SocialLinks({ links }: { links: ExternalLink[] | undefined }) {
  const t = useTranslations("eventPage");
  const items = (links ?? []).flatMap((l) => {
    const href = externalHref(l.url);
    if (!href) return [];
    const platform = linkPlatform(href);
    return [{ id: l.id, href, platform, name: linkPlatformName(platform, href, t("links.website")) }];
  });
  if (items.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label={t("links.label")}>
      {items.map((l) => (
        <li key={l.id}>
          <a
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={l.name}
            title={l.name}
            className="grid size-11 place-items-center rounded-full outline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--pg-accent)]"
            style={{ border: "1px solid var(--pg-line)", background: "var(--pg-card)", color: "var(--pg-fg)" }}
          >
            <BrandIcon platform={l.platform} size={20} />
          </a>
        </li>
      ))}
    </ul>
  );
}
