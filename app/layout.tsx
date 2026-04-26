import type { Metadata } from "next";
import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import { HeaderMeta } from "@/components/HeaderMeta";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
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
        <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
            <Link
              href="/"
              className="text-base font-semibold tracking-tight no-underline hover:no-underline"
              aria-label="Til forsiden"
            >
              Magtinformation
            </Link>
            <SiteNav />
            <div className="ml-auto flex w-full items-center gap-4 sm:w-auto">
              <HeaderMeta />
              <div className="w-full sm:w-auto">
                <SiteSearch />
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
