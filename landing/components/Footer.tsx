"use client";

import { ArrowRight, Terminal } from "@phosphor-icons/react";
import { useReveal } from "./useReveal";

export default function Footer() {
  const ref = useReveal();

  return (
    <>
      <section className="py-24 md:py-32">
        <div ref={ref} className="reveal text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-normal text-text tracking-[-0.02em]">
            Ready to send certificates?
          </h2>
          <p className="mt-3 text-text-muted max-w-[50ch] mx-auto leading-relaxed">
            Get started in under a minute. No account required.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#quickstart"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-text text-canvas font-medium text-sm
                         hover:bg-text/90 active:scale-[0.98] transition-all duration-150"
              style={{ borderRadius: "4px" }}
            >
              Get Started <ArrowRight className="w-4 h-4" weight="bold" />
            </a>
            <a
              href="https://github.com/prem-thatikonda29/sealpost"
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
      <footer className="border-t border-border py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-text-faint">
          <span className="font-medium text-text-muted">Sealpost</span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/prem-thatikonda29/sealpost"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-muted transition-colors duration-150"
            >
              GitHub
            </a>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </>
  );
}
