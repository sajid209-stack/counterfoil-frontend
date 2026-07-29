export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-tight rounded-md border border-dashed border-neutral-200 px-section py-hero text-center">
      {icon && <div className="text-neutral-400">{icon}</div>}
      <p className="type-h2 text-base">{title}</p>
      {message && (
        <p className="type-body max-w-sm text-[13px] text-neutral-400">{message}</p>
      )}
      {action && <div className="mt-tight">{action}</div>}
    </div>
  );
}
