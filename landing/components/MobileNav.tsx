"use client";

import Image from "next/image";
import { List, X } from "@phosphor-icons/react";
import { useState } from "react";

const sections = [
  { id: "hero", label: "Home" },
  { id: "demo", label: "Demo" },
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How It Works" },
  { id: "quickstart", label: "Quickstart" },
  { id: "configuration", label: "Configuration" },
];

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-canvas/80 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <Image src="/brand/lockup-light.svg" alt="Sealpost" width={126} height={26} unoptimized priority />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 text-text-muted hover:text-text"
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="w-4 h-4" weight="bold" /> : <List className="w-4 h-4" weight="regular" />}
        </button>
      </div>
      {isOpen && (
        <nav className="px-4 pb-4 border-t border-border" aria-label="Mobile navigation">
          <ul className="space-y-0.5 pt-2">
            {sections.map(({ id, label }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  onClick={() => setIsOpen(false)}
                  className="block py-1.5 px-2 text-sm text-text-muted hover:text-text hover:translate-x-0.5 transition-all duration-150"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
