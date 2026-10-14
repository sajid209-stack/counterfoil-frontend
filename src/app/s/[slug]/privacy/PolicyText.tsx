import { Fragment } from "react";

/** One part of a policy: an optional heading and the paragraphs under it. */
interface Part {
  heading?: string;
  paragraphs: string[];
}

/**
 * Plain text in, parts out. A blank line starts a new part. Inside a part, a
 * first line that is short and does not end like a sentence is its heading, so
 * an operator can write in a textarea and still get a page with structure.
 */
export function parsePolicy(text: string): Part[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const [first, ...rest] = lines;
      const looksLikeHeading = first.length <= 48 && !/[.!?:,;]$/.test(first);
      if (looksLikeHeading) return { heading: first, paragraphs: rest };
      return { paragraphs: lines };
    });
}

/**
 * A venue's privacy policy as a customer reads it. The same component draws the
 * public page and the preview in Settings, so what an operator checks is what a
 * customer gets. It uses only the storefront's own tokens, so it takes the
 * venue's theme wherever it sits.
 */
export function PolicyText({ text }: { text: string }) {
  const parts = parsePolicy(text);
  return (
    <div className="flex flex-col gap-section">
      {parts.map((part, i) => (
        <Fragment key={i}>
          <section>
            {part.heading && <h2 className="text-lg font-semibold text-fg">{part.heading}</h2>}
            {part.paragraphs.map((p, j) => (
              <p key={j} className={`text-md leading-relaxed text-fg ${part.heading || j > 0 ? "mt-tight" : ""}`}>
                {p}
              </p>
            ))}
          </section>
        </Fragment>
      ))}
    </div>
  );
}
