import { Link } from 'react-router-dom';

interface EntryLinkProps {
  to: string;
  title: string;
  detail?: string;
  tone?: 'default' | 'plan';
}

export function EntryLink({ to, title, detail, tone = 'default' }: EntryLinkProps) {
  return (
    <Link className={`card entry-link${tone === 'plan' ? ' entry-link--plan' : ''}`} to={to}>
      <span className="entry-link__text">
        <strong>
          {title}
          <span className="entry-link__chevron" aria-hidden="true">
            ›
          </span>
        </strong>
        {detail && <span className="muted">{detail}</span>}
      </span>
    </Link>
  );
}
