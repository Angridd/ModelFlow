import Link from "next/link";

export type Crumb = {
  label: string;
  href?: string;
};

/**
 * Fil d'Ariane partagé (server component, sans hook).
 * `tone="light"` pour un fond sombre (hero projet).
 */
export function Breadcrumbs({
  items,
  tone = "default",
}: {
  items: Crumb[];
  tone?: "default" | "light";
}) {
  return (
    <nav
      aria-label="Fil d'Ariane"
      className={`breadcrumbs${tone === "light" ? " breadcrumbs-light" : ""}`}
    >
      <ol>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {item.href && !isLast ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span
                  className="breadcrumbs-current"
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
