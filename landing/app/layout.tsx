import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Newsreader } from "next/font/google";
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

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Sealpost - Hackathon Certificates in Minutes",
  description:
    "A Python CLI tool that generates personalized PDF certificates and emails them to participants.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <MobileNav />
        <Sidebar />
        {children}
      </body>
    </html>
  );
}
