import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Folketinget — afstemninger",
  description: "Afstemninger, regeringer og medlemmer i det danske Folketing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da">
      <body className="min-h-screen">
        <header className="border-b border-[var(--color-line)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-base font-semibold tracking-tight">
              Folketinget · afstemninger
            </Link>
            <nav className="flex gap-6 text-sm text-[var(--color-muted)]">
              <Link href="/">Forside</Link>
              <Link href="/votes">Afstemninger</Link>
              <Link href="/parties">Partier</Link>
              <Link href="/members">Medlemmer</Link>
              <Link href="/analyse/koalitioner">Analyse</Link>
            </nav>
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
