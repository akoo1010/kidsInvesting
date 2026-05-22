import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { PortfolioProvider } from "@/lib/portfolio";
import { ParentLockProvider } from "@/lib/parentLock";
import { SyncProvider } from "@/lib/sync";
import { NavBar } from "@/components/NavBar";
import { ProfileGate } from "@/components/ProfileGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wall Street Cubs — learn investing with real prices",
  description:
    "A friendly investing playground for kids. Practice with virtual money using real stock prices.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ParentLockProvider>
          <PortfolioProvider>
            <SyncProvider>
              <NavBar />
              <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col">
                <ProfileGate>{children}</ProfileGate>
              </main>
              <footer className="text-center text-xs text-slate-600 py-6 px-4">
                Practice money only. Real prices are delayed and provided for learning.
              </footer>
            </SyncProvider>
          </PortfolioProvider>
        </ParentLockProvider>
      </body>
    </html>
  );
}
