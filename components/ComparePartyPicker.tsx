"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PartyBadge } from "@/components/PartyBadge";
import { buttonVariants } from "@/components/ui/button";
import type { Party } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  parties: Party[];
  initialA?: string;
  initialB?: string;
  initialGov?: string;
  governments: { slug: string; name: string }[];
};

export function ComparePartyPicker({
  parties,
  initialA = "",
  initialB = "",
  initialGov = "",
  governments,
}: Props) {
  const router = useRouter();
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [gov, setGov] = useState(initialGov);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!a || !b || a === b) return;
    const params = new URLSearchParams({ a, b });
    if (gov) params.set("gov", gov);
    router.push(`/parties/sammenlign?${params.toString()}`);
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <Picker label="Parti A" value={a} onChange={setA} parties={parties} />
      <Picker label="Parti B" value={b} onChange={setB} parties={parties} />
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--color-muted)]">Periode</span>
        <select
          value={gov}
          onChange={(e) => setGov(e.target.value)}
          className="rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm"
        >
          <option value="">Alle perioder</option>
          {governments.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={!a || !b || a === b}
        className={cn(
          buttonVariants({ size: "default" }),
          "self-end disabled:opacity-40",
        )}
      >
        Sammenlign
      </button>
    </form>
  );
}

function Picker({
  label,
  value,
  onChange,
  parties,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  parties: Party[];
}) {
  const sorted = [...parties].sort((a, b) => a.left_order - b.left_order);
  const selected = parties.find((p) => p.short === value);
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-[var(--color-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <PartyBadge party={selected} size="sm" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm"
        >
          <option value="">Vælg parti…</option>
          {sorted.map((p) => (
            <option key={p.short} value={p.short}>
              {p.navn}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
