"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "magtinformation:disclaimer-accepted-v1";

export function Disclaimer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      // localStorage may be blocked — show the modal anyway.
      setOpen(true);
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
    >
      <div className="max-h-full w-full max-w-lg overflow-auto rounded-lg bg-white shadow-xl">
        <div className="space-y-4 p-6">
          <h2
            id="disclaimer-title"
            className="text-lg font-semibold tracking-tight"
          >
            Før du fortsætter
          </h2>
          <div className="space-y-3 text-sm leading-relaxed text-[var(--color-ink)]">
            <p>
              <strong>Magtinformation</strong> er et uafhængigt projekt der
              viser data fra Folketingets åbne API (oda.ft.dk) og udleder
              statistik herfra. Tallene præsenteres så loyalt som muligt, men
              er <strong>ikke en officiel kilde</strong>.
            </p>
            <p>
              Datasættet kan indeholde fejl, mangler eller forsinkelser,
              afledte beregninger (fx fremmøde, partienhed, demografi) hviler
              på antagelser der står beskrevet på de relevante sider, og
              billedet kan ændre sig når Folketinget retter sine egne data.
            </p>
            <p>
              Kort sagt: <strong>brug det som udgangspunkt — ikke som facit</strong>.
              Verificér gerne enkelttal mod{" "}
              <a
                href="https://www.ft.dk"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                ft.dk
              </a>{" "}
              før du citerer dem offentligt.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <a
              href="https://oda.ft.dk"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[var(--color-muted)] underline-offset-2 hover:underline"
            >
              Om dataet (oda.ft.dk)
            </a>
            <button
              type="button"
              onClick={accept}
              className="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Jeg forstår — fortsæt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
