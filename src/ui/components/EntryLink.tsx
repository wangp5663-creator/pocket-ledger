import { Link } from 'react-router-dom';

interface EntryLinkProps {
  to: string;
  title: string;
  detail?: string;
}

export function EntryLink({ to, title, detail }: EntryLinkProps) {
  return (
    <Link className="card entry-link" to={to}>
      <span className="entry-link__text">
        <strong>{title}</strong>
        {detail && <span className="muted">{detail}</span>}
      </span>
      <span className="entry-link__chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
