"use client";

import { usePage } from "../context";
import { Section } from "../Section";
import { aboutOf } from "./helpers";

/**
 * About: prose (68 characters wide at most), the facts a buyer checks as a
 * definition grid, and who is hosting. Draws when ANY of the three exists — an
 * event with no description but a venue policy still has something to say.
 */
export function AboutSection() {
  const ctx = usePage();
  const { labels, layout } = ctx;
  const about = aboutOf(ctx);
  if (!about) return null;
  const { description, info, org } = about;
  const cols = layout === "phone" ? 1 : layout === "tablet" ? 2 : 3;

  return (
    <Section id="about" title={labels.about}>
      {description && (
        <div className="pg-body max-w-[68ch] space-y-4">
          {description.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
      )}

      {info.length > 0 && (
        <dl
          className="grid gap-x-8 gap-y-5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, marginTop: description ? 28 : 0 }}
        >
          {info.map((row) => (
            <div key={row.id} className="min-w-0">
              <dt className="pg-muted text-[13px] leading-5">{row.label}</dt>
              <dd className="mt-0.5 text-[15px] font-medium leading-6" style={{ overflowWrap: "anywhere" }}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {org && (
        <div className="max-w-[68ch]" style={{ marginTop: description || info.length > 0 ? 28 : 0 }}>
          <p className="text-[15px] font-semibold leading-6">
            {labels.hostedBy} {org.name}
          </p>
          {org.blurb && <p className="pg-meta mt-1">{org.blurb}</p>}
        </div>
      )}
    </Section>
  );
}
