"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/votes", label: "Afstemninger", match: /^\/votes/ },
  { href: "/topics", label: "Emner", match: /^\/topics/ },
  { href: "/parties", label: "Partier", match: /^\/parties/ },
  { href: "/members", label: "Medlemmer", match: /^\/members/ },
  {
    href: "/analyse",
    label: "Analyse",
    match: /^\/(analyse|partiskiftere|governments)/,
  },
];

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Hovedmenu"
      className="-mx-1 flex flex-wrap gap-x-1 gap-y-1 text-sm"
    >
      {ITEMS.map((item) => {
        const active = item.match.test(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2 py-1 transition no-underline hover:no-underline ${
              active
                ? "bg-[var(--color-soft)] text-[var(--color-ink)]"
                : "text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-ink)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
