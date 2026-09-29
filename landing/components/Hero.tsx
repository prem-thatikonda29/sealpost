"use client";

import { ArrowRight, Terminal } from "@phosphor-icons/react";
import { useReveal } from "./useReveal";

export default function Hero() {
  const ref = useReveal();

  return (
    <section id="hero" className="min-h-[100dvh] flex items-center">
      <div ref={ref} className="reveal w-full max-w-4xl mx-auto px-6 pt-24 pb-16">
        <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-text-faint mb-6">
          Web App
        </p>
        <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-normal text-text leading-[1.05] tracking-[-0.03em]">
          Send hackathon certificates<br />in minutes
        </h1>
        <p className="mt-6 text-lg text-text-muted leading-relaxed max-w-[50ch]">
          Place names visually, upload a CSV, and watch every send land — or
          fail — in real time.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <a
            href="#quickstart"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-text text-canvas font-medium text-sm
                       hover:bg-text/90 active:scale-[0.98] transition-all duration-150"
            style={{ borderRadius: "4px" }}
          >
            Get Started <ArrowRight className="w-4 h-4" weight="bold" />
          </a>
          <a
            href="https://github.com/prem-thatikonda29/Certificates-Sender"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-text font-medium text-sm
                       hover:border-border-hover active:scale-[0.98] transition-all duration-150"
            style={{ borderRadius: "4px" }}
          >
            <Terminal className="w-4 h-4" weight="regular" /> View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
