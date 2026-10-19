"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePage } from "../context";
import { Section } from "../Section";
import { clean, hostOf } from "./helpers";

const initial = (name: string) => Array.from(clean(name))[0]?.toUpperCase() ?? "";

/**
 * Host — meet your host: a photo (or an initials disc) + name + role + bio,
 * horizontal on desktop (docs/page-style.md §7).
 */
export function HostSection() {
  const ctx = usePage();
  const t = useTranslations("eventPage");
  const host = hostOf(ctx);
  const [broken, setBroken] = useState(false);
  if (!host) return null;
  const showImg = !!host.photoUrl && !broken;
  const side = ctx.layout !== "phone";
  return (
    <Section id="host" title={t("sections.host")}>
      <div className={side ? "flex items-start gap-5" : "flex flex-col gap-4"}>
        <div
          className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full"
          style={{ background: "var(--ps-panel)", border: "1px solid var(--ps-line)" }}
        >
          {showImg ? (
            // eslint-disable-next-line @next/next/no-img-element -- bundled/local assets
            <img src={host.photoUrl} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[22px] font-semibold" style={{ color: "var(--ps-ink)" }}>
              {initial(host.name)}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[17px] font-semibold leading-6" style={{ color: "var(--ps-fg)" }}>
            {host.name}
          </p>
          {host.role && <p className="pg-meta pg-muted">{host.role}</p>}
          {host.bio && <p className="pg-body mt-2 max-w-[60ch]">{host.bio}</p>}
        </div>
      </div>
    </Section>
  );
}
