export function AuthHeading({ title, lead, eyebrow }: { title: string; lead?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-tight">
      {eyebrow}
      <h1 className="text-2xl font-semibold tracking-title text-fg">{title}</h1>
      {lead && <p className="text-base text-muted">{lead}</p>}
    </header>
  );
}

/* A link that reads as a link: brand text colour, 44px target on touch. */
export const linkClass = "inline-flex min-h-11 items-center text-sm font-medium text-brand-foreground underline-offset-4 hover:underline md:min-h-0";
export const quietLinkClass = "inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline md:min-h-0";
