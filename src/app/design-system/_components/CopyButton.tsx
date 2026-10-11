"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Copy `text` to the clipboard, and say so.
 *
 * The state change is announced through a polite live region rather than only
 * by swapping the icon: a glyph is not read out, and a button that silently
 * "does nothing" for someone on a screen reader is a button that gets pressed
 * three times. The label names what is copied ("Copy --color-card") so a column
 * of identical icons is a column of distinct controls. 44px on a phone, where
 * these are pressed with a thumb; 28px from md, beside the text they copy.
 */
export function CopyButton({
  text,
  label,
  className,
  children,
}: {
  text: string;
  /** What this copies, for the accessible name: "name", "value", "import line". */
  label: string;
  className?: string;
  /** Visible text after the icon ("Copy"). Omit for an icon-only button. */
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // A blocked clipboard (an insecure origin, a denied permission) must not
      // look like success. Select-and-copy still works from the text itself.
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <>
      <Button
        variant="tertiary"
        size={children != null ? "sm" : "icon"}
        onClick={copy}
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
        icon={copied ? <Check size={14} strokeWidth={1.75} aria-hidden className="text-success" /> : <Copy size={14} strokeWidth={1.5} aria-hidden />}
        className={cn("shrink-0 text-muted hover:text-fg", className)}
      >
        {children != null ? (copied ? "Copied" : children) : null}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? `Copied ${label}` : ""}
      </span>
    </>
  );
}
