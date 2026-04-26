"use client";

import { useEffect, useState } from "react";

export type TabSpec = {
  id: string;
  label: string;
  count?: number | null;
};

type Props = {
  tabs: TabSpec[];
  defaultTab: string;
  panels: { id: string; node: React.ReactNode }[];
};

export function MemberTabs({ tabs, defaultTab, panels }: Props) {
  const [active, setActive] = useState(defaultTab);

  // Sync with URL hash on mount + when user navigates back/forward.
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (h && tabs.some((t) => t.id === h)) setActive(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  const select = (id: string) => {
    setActive(id);
    if (typeof window !== "undefined") {
      // Update hash without scrolling.
      const url = `${window.location.pathname}${window.location.search}#${id}`;
      window.history.replaceState(null, "", url);
    }
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Sektioner"
        className="-mx-6 flex gap-1 overflow-x-auto border-b border-[var(--color-line)] px-6"
      >
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`tab-${t.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${t.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => select(t.id)}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-sm transition ${
                isActive
                  ? "border-[var(--color-ink)] font-medium text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {t.label}
              {t.count != null && (
                <span
                  className={`ml-1.5 text-xs tabular-nums ${
                    isActive
                      ? "text-[var(--color-muted)]"
                      : "text-[var(--color-muted)]"
                  }`}
                >
                  {t.count.toLocaleString("da-DK")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {panels.map(({ id, node }) => (
          <div
            key={id}
            id={`panel-${id}`}
            role="tabpanel"
            aria-labelledby={`tab-${id}`}
            hidden={id !== active}
          >
            {node}
          </div>
        ))}
      </div>
    </div>
  );
}
