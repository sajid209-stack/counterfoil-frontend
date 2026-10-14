"use client";

import { useTranslations } from "next-intl";
import { Mail, Phone } from "lucide-react";
import { useApiQuery } from "@/lib/useApi";
import { COUNTERFOIL_PRIVACY_URL, COUNTERFOIL_TERMS_URL, getPrivacySettings } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { BackLink, StorefrontChrome } from "../../_components/Chrome";
import { PolicyText } from "./PolicyText";

const linkCls =
  "inline-flex min-h-11 items-center text-brand-foreground underline-offset-4 hover:underline sm:min-h-0";

/**
 * A venue's privacy policy, in the venue's own storefront theme. It shows what
 * the owner wrote in Settings → Privacy policy, who to contact about it, and
 * where Counterfoil's own policies are.
 */
export function PrivacyScreen() {
  const flow = useStorefrontFlow();
  const t = useTranslations("storefront");
  const q = useApiQuery(() => getPrivacySettings(), []);
  const venue = flow.location.name;
  const policy = q.data?.policy.trim() ?? "";

  return (
    <StorefrontChrome storefront={flow.storefront} location={flow.location} poweredBy={t("poweredBy")}>
      <div className="pt-section">
        <BackLink
          label={t("backToVenue", { venue })}
          href={flow.mode === "live" ? `/s/${flow.storefront.slug}` : undefined}
        />
      </div>
      <div className="mx-auto max-w-3xl">
        <h1 className="mt-tight text-4xl font-semibold tracking-figure sm:text-display">{t("privacy.title")}</h1>
        {q.data && policy && (
          <p className="mt-tight text-base text-muted">{t("privacy.updated", { date: formatDay(q.data.updatedOn) })}</p>
        )}

        <div className="mt-major">
          {!q.data ? null : policy ? (
            <PolicyText text={q.data.policy} />
          ) : (
            <p className="text-md text-muted">{t("privacy.empty", { venue })}</p>
          )}
        </div>

        {q.data && (q.data.contactEmail || q.data.contactPhone) && (
          <aside className="mt-major rounded-lg border border-line bg-card p-major shadow-card">
            <h2 className="text-lg font-semibold text-fg">{t("privacy.contactTitle")}</h2>
            <p className="mt-tight text-md text-muted">{t("privacy.contactBody", { venue })}</p>
            <ul className="mt-section flex flex-col gap-inline text-md">
              {q.data.contactEmail && (
                <li className="flex items-center gap-tight">
                  <Mail size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                  <a href={`mailto:${q.data.contactEmail}`} className={`${linkCls} break-all`}>
                    {q.data.contactEmail}
                  </a>
                </li>
              )}
              {q.data.contactPhone && (
                <li className="flex items-center gap-tight">
                  <Phone size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                  <a href={`tel:${q.data.contactPhone}`} className={linkCls}>
                    {q.data.contactPhone}
                  </a>
                </li>
              )}
            </ul>
          </aside>
        )}

        <p className="mt-major text-base text-muted">
          {t("privacy.counterfoilLine", { venue })}{" "}
          <a href={COUNTERFOIL_PRIVACY_URL} target="_blank" rel="noreferrer noopener" className={linkCls}>
            {t("privacy.counterfoilPrivacy")}
          </a>
          {" · "}
          <a href={COUNTERFOIL_TERMS_URL} target="_blank" rel="noreferrer noopener" className={linkCls}>
            {t("privacy.counterfoilTerms")}
          </a>
        </p>
      </div>
    </StorefrontChrome>
  );
}
