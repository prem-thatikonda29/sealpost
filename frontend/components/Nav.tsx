"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/events", label: "Events" },
  { href: "/run", label: "Run" },
  { href: "/history", label: "History" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/events" className="font-semibold text-sm tracking-tight">
          Cert Sender
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm transition-colors",
                pathname.startsWith(l.href)
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
