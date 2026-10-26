export function AuthHeading({ title, lead, eyebrow }: { title: string; lead?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <header className="flex flex-col items-center gap-1.5 text-center">
      {eyebrow}
      <h1 className="text-xl font-semibold tracking-title text-fg">{title}</h1>
      {lead && <p className="text-sm text-muted">{lead}</p>}
    </header>
  );
}

/** Compact sign-in scale: 40px controls on a mouse, 44px under a coarse pointer. */
export const authButtonClass = "h-10 text-base max-sm:h-11 [@media(pointer:coarse)]:h-11";

/* A link that reads as a link: brand text colour, 44px target on touch. */
export const linkClass = "inline-flex items-center text-sm font-medium text-brand-foreground underline-offset-4 hover:underline max-sm:min-h-11 [@media(pointer:coarse)]:min-h-11";
export const quietLinkClass = "inline-flex items-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline max-sm:min-h-11 [@media(pointer:coarse)]:min-h-11";
