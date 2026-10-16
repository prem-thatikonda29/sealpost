"use client";

import { useState, useEffect } from "react";

const sections = [
  { id: "hero", label: "Home" },
  { id: "demo", label: "Demo" },
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How It Works" },
  { id: "quickstart", label: "Quickstart" },
  { id: "configuration", label: "Configuration" },
];

export default function Sidebar() {
  const [activeSection, setActiveSection] = useState("hero");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sections.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (!element) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(id);
            }
          });
        },
        { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
      );

      observer.observe(element);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  return (
    <nav
      className="fixed left-8 top-1/2 -translate-y-1/2 w-[180px] z-40 max-md:hidden"
      aria-label="Table of contents"
    >
      <ul className="space-y-1">
        {sections.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={`block py-1 px-2 text-[13px] transition-colors duration-150 ${
                activeSection === id
                  ? "text-text font-medium"
                  : "text-text-faint hover:text-text-muted hover:translate-x-0.5"
              }`}
              aria-current={activeSection === id ? "true" : undefined}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
