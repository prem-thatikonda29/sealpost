"use client";

import { useReveal } from "./useReveal";

const steps = [
  {
    number: "01",
    title: "Create an event",
    description:
      "Upload your certificate design, click where the name goes, pick a font, and write the email",
  },
  {
    number: "02",
    title: "Upload your list",
    description:
      "Upload a spreadsheet for each group, like winners or participants, and tell Sealpost which column is the name and which is the email",
  },
  {
    number: "03",
    title: "Check the list",
    description:
      "Small fixes are made for you. Repeats, wrong emails and typos are pointed out so you can fix or remove them",
  },
  {
    number: "04",
    title: "Send and watch",
    description:
      "See every email go out live, re-send to just the people who missed out, and download a report",
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
          Four steps from a spreadsheet to delivered certificates.
        </p>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
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
                <div className="hidden lg:block absolute top-2 left-[calc(100%+8px)] w-6 border-t border-dashed border-border" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-12">
          <div className="bg-surface border border-border overflow-hidden transition-colors duration-150 hover:border-border-hover">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <span className="text-[11px] text-text-faint font-mono">
                history · when someone doesn&apos;t get theirs
              </span>
            </div>
            <pre className="p-4 overflow-x-auto">
              <code className="text-[13px] font-mono text-text leading-relaxed">
                <span className="text-accent-amber-text">invalid</span>
                {"   sam@gmial.com      "}
                <span className="text-text-muted">
                  Typo in the address. Caught before sending, nothing went out
                </span>
                {"\n"}
                <span className="text-accent-rose-text">failed</span>
                {"    priya@college.edu  "}
                <span className="text-text-muted">
                  Gmail refused it. Retry from History
                </span>
                {"\n"}
                <span className="text-accent-rose-text">failed</span>
                {"    arjun@college.edu  "}
                <span className="text-text-muted">
                  Daily limit reached. Re-send tomorrow from History
                </span>
                {"\n"}
                <span className="text-accent-terra-text">bounced</span>
                {"   neha@oldmail.com   "}
                <span className="text-text-muted">
                  Email came back. Fix the address, then re-send
                </span>
                {"\n"}
                <span className="text-text-muted">skipped</span>
                {"   ravi@college.edu   "}
                <span className="text-text-muted">
                  Listed twice. Emailed once
                </span>
                {"\n"}
                <span className="text-accent-sage-text">
                  {"\n  573 of 588 delivered · 15 need attention · re-send goes to just those 15"}
                </span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
