"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "magtinformation:disclaimer-accepted-v1";

export function Disclaimer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && accept()}>
      <DialogContent showClose={false} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Før du fortsætter</DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <div className="space-y-3 text-sm leading-relaxed text-[var(--color-ink)]">
            <p>
              <strong>Magtinformation</strong> er et uafhængigt projekt der
              viser data fra Folketingets åbne API (oda.ft.dk) og udleder
              statistik herfra. Tallene præsenteres så loyalt som muligt, men
              er <strong>ikke en officiel kilde</strong>.
            </p>
            <p>
              Datasættet kan indeholde fejl, mangler eller forsinkelser, og
              afledte beregninger (fx fremmøde, partienhed, demografi) hviler
              på antagelser der står beskrevet på{" "}
              <Link
                href="/om"
                onClick={accept}
                className="underline underline-offset-2"
              >
                om‑siden
              </Link>
              .
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
        </DialogDescription>
        <DialogFooter>
          <Button asChild variant="ghost" size="sm" onClick={accept}>
            <Link href="/om">Læs metode og privatliv</Link>
          </Button>
          <Button onClick={accept} autoFocus>
            Jeg forstår — fortsæt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
