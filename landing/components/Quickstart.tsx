"use client";

import CodeBlock from "./CodeBlock";
import { useReveal } from "./useReveal";

const firstRun = [
  {
    title: "Create an event.",
    detail:
      "Events → New Event: upload a template, click to place the name, pick a font, write the email subject and body.",
  },
  {
    title: "Upload and map.",
    detail:
      "On the Run page, check the tiers you want, upload each tier's CSV, and map its columns.",
  },
  {
    title: "Review the list.",
    detail:
      "Tidy-ups are applied for you. Fix or remove anything flagged (repeats, invalid addresses, missing names, domain typos), then use the cleaned list.",
  },
  {
    title: "Check, then send.",
    detail:
      "Optionally validate email domains, or generate everything first as a dry run. Then start the job and watch each row land.",
  },
  {
    title: "Follow up.",
    detail:
      "Bounces are checked against your Gmail inbox about 30 seconds later. In History, re-send to anyone who missed out, download the delivery report, or delete the job.",
  },
];

export default function Quickstart() {
  const ref = useReveal();

  return (
    <section id="quickstart" className="py-24 md:py-32">
      <div ref={ref} className="reveal">
        <h2 className="font-serif text-3xl md:text-4xl font-normal text-text tracking-[-0.02em]">
          Quickstart
        </h2>
        <p className="mt-3 text-text-muted max-w-[50ch] leading-relaxed">
          Get up and running in under a minute.
        </p>
        <div className="mt-10 space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-text mb-3">
              Installation
            </h3>
            <p className="text-[13px] text-text-muted mb-3">
              You need Python 3.11+ and Node.js 20+.
            </p>
            <CodeBlock
              code={`git clone https://github.com/prem-thatikonda29/sealpost.git\ncd sealpost\ncp .env.example .env\npip install -r backend/requirements.txt\ncd frontend && npm install && cd ..`}
              label="terminal"
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text mb-3">
              Configuration
            </h3>
            <p className="text-[13px] text-text-muted mb-3">
              Open the{" "}
              <code className="font-mono text-accent-terra-text bg-accent-terra px-1.5 py-0.5 text-[12px]">.env</code> you just copied and add your
              Gmail credentials. The password is an App Password (Google
              Account → Security → 2-Step Verification → App passwords), not
              your login:
            </p>
            <CodeBlock
              code={`GMAIL_USER=your-email@gmail.com\nGMAIL_APP_PASSWORD=your-16-char-app-password`}
              label=".env"
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text mb-3">Run</h3>
            <CodeBlock
              code={`bash start.sh\n\n# backend  http://localhost:8000\n# frontend http://localhost:3000`}
              label="terminal"
            />
            <p className="text-[13px] text-text-muted mt-3">
              Open{" "}
              <code className="font-mono text-accent-terra-text bg-accent-terra px-1.5 py-0.5 text-[12px]">
                http://localhost:3000
              </code>{" "}
              and start there. Events, runs, and history all live in the
              browser.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text mb-3">
              Your first run
            </h3>
            <ol className="space-y-3">
              {firstRun.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-text-faint pt-0.5">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="text-[13px] text-text-muted leading-relaxed">
                    <span className="font-semibold text-text">{step.title}</span>{" "}
                    {step.detail}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
