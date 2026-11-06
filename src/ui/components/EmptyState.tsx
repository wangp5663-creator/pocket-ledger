interface EmptyStateProps {
  title: string;
  hint?: string;
}

export function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        ◎
      </div>
      <p>{title}</p>
      {hint && <p className="muted">{hint}</p>}
    </div>
  );
}
