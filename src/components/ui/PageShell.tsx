// Standard page frame for OS screens: title, optional description, actions slot.
export function PageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-major py-major">
      <div className="flex flex-col gap-tight sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="type-h1 text-2xl">{title}</h1>
          {description && (
            <p className="type-body mt-inline max-w-2xl text-[13px] text-neutral-600">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-tight">{actions}</div>
        )}
      </div>
      <div className="mt-major">{children}</div>
    </div>
  );
}
