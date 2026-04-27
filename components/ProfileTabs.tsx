"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export function ProfileTabs({ tabs, defaultTab, panels }: Props) {
  const [active, setActive] = useState(defaultTab);

  // Sync with URL hash so deep-linked tabs work (e.g. /members/12#stemmer).
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (h && tabs.some((t) => t.id === h)) setActive(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  const onChange = (value: string) => {
    setActive(value);
    if (typeof window !== "undefined") {
      const url = `${window.location.pathname}${window.location.search}#${value}`;
      window.history.replaceState(null, "", url);
    }
  };

  return (
    <Tabs value={active} onValueChange={onChange}>
      <TabsList className="-mx-6 overflow-x-auto px-6">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>
            {t.label}
            {t.count != null && (
              <span className="ml-1.5 text-xs tabular-nums text-[var(--color-muted)]">
                {t.count.toLocaleString("da-DK")}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {panels.map(({ id, node }) => (
        <TabsContent key={id} value={id}>
          {node}
        </TabsContent>
      ))}
    </Tabs>
  );
}
