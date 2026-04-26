import type { Metadata } from "next";
import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import { SiteSearch } from "@/components/SiteSearch";
import "./globals.css";

export const metadata: Metadata = {
  title: "Magtinformation — afstemninger i Folketinget",
  description:
    "Magtinformation: åbne data om Folketingets afstemninger, medlemmer, partier og regeringer.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da">
      <body className="min-h-screen">
        <Disclaimer />
        <header className="border-b border-[var(--color-line)]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
            <Link href="/" className="text-base font-semibold tracking-tight">
              Magtinformation
            </Link>
            <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--color-muted)]">
              <Link href="/">Forside</Link>
              <Link href="/votes">Afstemninger</Link>
              <Link href="/topics">Emner</Link>
              <Link href="/parties">Partier</Link>
              <Link href="/members">Medlemmer</Link>
              <Link href="/partiskiftere">Partiskiftere</Link>
              <Link href="/analyse">Analyse</Link>
            </nav>
            <div className="ml-auto">
              <SiteSearch />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        <footer className="mt-20 border-t border-[var(--color-line)] py-6">
          <div className="mx-auto max-w-5xl px-6 text-xs text-[var(--color-muted)]">
            Data fra Folketingets åbne data — oda.ft.dk
          </div>
        </footer>
      </body>
    </html>
  );
}
