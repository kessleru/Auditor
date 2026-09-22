import { Link } from 'react-router';

/** Trilha de navegação: links até o nível atual, que fica marcado com `aria-current`. */
export function Breadcrumb({
  items,
  current,
}: {
  items: { to: string; label: string }[];
  current: string;
}) {
  return (
    <nav aria-label="Trilha de navegação">
      <ol className="flex flex-wrap items-center gap-2 text-label">
        {items.map((item) => (
          <li key={item.to} className="flex items-center gap-2">
            <Link
              to={item.to}
              className="text-accent-text underline underline-offset-2 hover:decoration-2"
            >
              {item.label}
            </Link>
            <span aria-hidden="true" className="text-text-muted">
              /
            </span>
          </li>
        ))}
        <li aria-current="page" className="text-text-muted">
          {current}
        </li>
      </ol>
    </nav>
  );
}
