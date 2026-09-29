import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Toaster } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* Display voice only — page titles and the wordmark. Never UI, labels, or data.
   See the serif boundary in DESIGN.md. */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Cert Sender",
  description: "Certificate generation and email sending",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased min-h-screen`}
      >
        {/* Mounted at the root so any screen can report an outcome, and so a
            toast outlives the navigation a save triggers. */}
        <Toaster>
          <Nav />
          <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
        </Toaster>
      </body>
    </html>
  );
}
