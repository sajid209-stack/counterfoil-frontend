"use client";

import { usePage } from "../context";
import { Section } from "../Section";
import { textBlockOf } from "./helpers";

/**
 * Text — a free block: heading + paragraphs, preserving line breaks, max
 * 68ch (docs/page-style.md §7). Drawn without the standard section heading
 * when the operator wrote none, so an untitled block isn't stuck with a
 * generic word nobody chose.
 */
export function TextSection() {
  const ctx = usePage();
  const block = textBlockOf(ctx);
  if (!block) return null;
  const paragraphs = block.body.split(/\n{2,}/);
  const body = (
    <div className="pg-body max-w-[68ch] space-y-4">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
  if (!block.title) {
    return (
      <section id="pg-text" className="pg-section">
        {body}
      </section>
    );
  }
  return <Section id="text" title={block.title}>{body}</Section>;
}
