"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Government, Party } from "@/lib/types";

type Props = {
  parties: Party[];
  governments: Government[];
  q: string;
  party: string;
  status: string;
  sex: string;
  education: string;
  gov: string;
  sort: string;
};

const STATUS_OPTIONS = [
  { value: "current", label: "Nuværende MF'er" },
  { value: "former", label: "Tidligere MF'er" },
  { value: "all", label: "Alle (begge)" },
];

const SEX_OPTIONS = [
  { value: "", label: "Alle" },
  { value: "Kvinde", label: "Kvinde" },
  { value: "Mand", label: "Mand" },
];

const EDU_OPTIONS = [
  { value: "", label: "Alle" },
  { value: "LVU", label: "Lang videregående (LVU)" },
  { value: "MVU", label: "Mellemlang videregående (MVU)" },
  { value: "KVU", label: "Kort videregående (KVU)" },
  { value: "Erhvervsfaglig", label: "Erhvervsfaglig" },
  { value: "Gymnasial", label: "Gymnasial" },
  { value: "Grundskole", label: "Grundskole" },
];

const SORT_OPTIONS = [
  { value: "name", label: "Navn (A–Å)" },
  { value: "party", label: "Parti" },
  { value: "age", label: "Alder (yngst først)" },
  { value: "ageDesc", label: "Alder (ældst først)" },
  { value: "attendance", label: "Fremmøde (lavest)" },
  { value: "attendanceDesc", label: "Fremmøde (højest)" },
  { value: "deviation", label: "Afvigelse (højest)" },
];

export function MembersFilter({
  parties,
  governments,
  q,
  party,
  status,
  sex,
  education,
  gov,
  sort,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(q);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const build = (overrides: Partial<Props>) => {
    const params = new URLSearchParams();
    const v = (k: keyof Props, fallback: string) =>
      (overrides[k] as string | undefined) ?? fallback;
    const setIf = (k: string, val: string, def = "") => {
      if (val && val !== def) params.set(k, val);
    };
    setIf("q", v("q", q));
    setIf("party", v("party", party));
    setIf("status", v("status", status), "current");
    setIf("sex", v("sex", sex));
    setIf("education", v("education", education));
    setIf("gov", v("gov", gov));
    setIf("sort", v("sort", sort), "name");
    const s = params.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  const go = (overrides: Partial<Props>) => {
    router.push(build(overrides));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    go({ q: searchInput });
  };

  const anyFilter =
    q || party || sex || education || gov || (status && status !== "current") || (sort && sort !== "name");

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Søg på navn…"
          className="w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm focus:border-[var(--color-ink)] focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-sm hover:bg-[var(--color-soft)]"
        >
          Søg
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Status"
          value={status || "current"}
          onChange={(v) => go({ status: v })}
          options={STATUS_OPTIONS}
        />
        <Select
          label="Parti"
          value={party}
          onChange={(v) => go({ party: v })}
          options={[
            { value: "", label: "Alle partier" },
            ...parties.map((p) => ({ value: p.short, label: p.navn })),
          ]}
        />
        <Select
          label="Køn"
          value={sex}
          onChange={(v) => go({ sex: v })}
          options={SEX_OPTIONS}
        />
        <Select
          label="Uddannelsesniveau"
          value={education}
          onChange={(v) => go({ education: v })}
          options={EDU_OPTIONS}
        />
        <Select
          label="Aktiv under regering"
          value={gov}
          onChange={(v) => go({ gov: v })}
          options={[
            { value: "", label: "Alle perioder" },
            ...governments.map((g) => ({ value: g.slug, label: g.name })),
          ]}
        />
        <Select
          label="Sortér"
          value={sort || "name"}
          onChange={(v) => go({ sort: v })}
          options={SORT_OPTIONS}
        />
        <div className="flex items-end">
          {anyFilter && (
            <button
              type="button"
              onClick={() => router.push(pathname)}
              className="rounded border border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:bg-[var(--color-soft)]"
            >
              Nulstil filtre
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-[var(--color-muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
