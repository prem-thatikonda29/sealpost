"use client";

import { useReveal } from "./useReveal";

const steps = [
  {
    number: "01",
    title: "Create an event",
    description:
      "Upload a certificate template, click to place the name, pick a font, and write the email",
  },
  {
    number: "02",
    title: "Upload & map your CSV",
    description:
      "Upload a CSV per tier and map its columns. Names-only CSVs and split name columns work too",
  },
  {
    number: "03",
    title: "Send and watch",
    description:
      "Watch every row update live, catch bounces, and re-send only the people who missed out",
  },
];

export default function HowItWorks() {
  const ref = useReveal();

  return (
    <section id="how-it-works" className="py-24 md:py-32">
      <div ref={ref} className="reveal">
        <h2 className="font-serif text-3xl md:text-4xl font-normal text-text tracking-[-0.02em]">
          How It Works
        </h2>
        <p className="mt-3 text-text-muted max-w-[50ch] leading-relaxed">
          Three steps from CSV to delivered certificates.
        </p>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step, index) => (
            <div key={step.number} className="relative py-4 -mx-4 px-4 rounded transition-colors duration-150 hover:bg-surface">
              <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-text-faint">
                {step.number}
              </span>
              <h3 className="mt-2 text-lg font-semibold text-text">
                {step.title}
              </h3>
              <p className="mt-1.5 text-[13px] text-text-muted leading-relaxed">
                {step.description}
              </p>
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-2 left-[calc(100%+16px)] w-8 border-t border-dashed border-border" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-12">
          <div className="bg-surface border border-border overflow-hidden transition-colors duration-150 hover:border-border-hover">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <span className="text-[11px] text-text-faint font-mono">
                history · when a row doesn&apos;t go through
              </span>
            </div>
            <pre className="p-4 overflow-x-auto">
              <code className="text-[13px] font-mono text-text leading-relaxed">
                <span className="text-accent-amber-text">invalid</span>
                {"   sam@gmial.com   "}
                <span className="text-text-muted">
                  caught before the send, nothing went out
                </span>
                {"\n"}
                <span className="text-accent-rose-text">failed</span>
                {"    SMTP refused    "}
                <span className="text-text-muted">
                  retry from the History page
                </span>
                {"\n"}
                <span className="text-accent-rose-text">bounced</span>
                {"   NDR arrived      "}
                <span className="text-text-muted">
                  re-send after fixing the address
                </span>
                {"\n"}
                <span className="text-accent-sage-text">
                  {"\n  573 sent · 15 need attention · re-send targets just those 15"}
                </span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
