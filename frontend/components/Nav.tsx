"use client";

import Image from "next/image";
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
    <header className="sticky top-0 z-30 border-b border-border bg-canvas/92 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
        <Link
          href="/events"
          className="flex items-center gap-2 font-serif text-base tracking-[-0.02em] text-foreground shrink-0"
        >
          <Image src="/brand/mark-light.svg" alt="" width={18} height={18} unoptimized />
          Sealpost
        </Link>

        <nav className="flex items-center gap-1" aria-label="Sections">
          {links.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative px-2.5 py-1.5 text-[13px] transition-colors duration-150",
                  active
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {l.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-[9px] h-px bg-foreground"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
