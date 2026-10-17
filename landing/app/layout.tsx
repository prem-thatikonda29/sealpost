import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const title = "Sealpost - Hackathon Certificates in Minutes";
// Kept under ~125 characters so social previews don't truncate it.
const description =
  "Generate personalized PDF certificates and email them to participants, with list cleaning, send limits and a delivery report.";
const ogImage = {
  url: "/brand/og-image.png",
  width: 1200,
  height: 630,
  alt: "Sealpost - Hackathon Certificates in Minutes",
};

export const metadata: Metadata = {
  // Social cards need absolute image URLs; this resolves the relative ones.
  metadataBase: new URL("https://sealpost.vercel.app"),
  title,
  description,
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Sealpost",
    title,
    description,
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Sentient (variable, upright + italic), delivered by Fontshare's API.
            Its licence (ITF FFL) forbids putting the font files in a public
            repository, so this stays an API link rather than a bundled file. */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=sentient@1,2&display=swap"
        />
      </head>
      <body className="min-h-full font-sans">
        <MobileNav />
        <Sidebar />
        {children}
      </body>
    </html>
  );
}
