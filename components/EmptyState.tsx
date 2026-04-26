type Props = {
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "soft" | "dashed";
};

export function EmptyState({ title, body, action, variant = "dashed" }: Props) {
  const wrapper =
    variant === "soft"
      ? "rounded-lg bg-[var(--color-soft)] p-6"
      : "rounded-lg border border-dashed border-[var(--color-line)] p-6";
  return (
    <div className={`${wrapper} text-sm`}>
      <div className="font-medium text-[var(--color-ink)]">{title}</div>
      {body && (
        <div className="mt-1 text-[var(--color-muted)]">{body}</div>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
