import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Study Agent",
  description: "A learning dashboard and chat assistant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <nav className="border-b border-slate-800 bg-slate-950/95">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
              Study Agent
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="rounded-full px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800/80"
              >
                Chat
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full bg-slate-800 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-700"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </nav>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
