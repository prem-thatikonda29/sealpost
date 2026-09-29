"use client";

import CodeBlock from "./CodeBlock";
import { useReveal } from "./useReveal";

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
            <CodeBlock
              code={`git clone https://github.com/prem-thatikonda29/Certificates-Sender.git\ncd Certificates-Sender\npip install -r backend/requirements.txt\ncd frontend && npm install`}
              label="terminal"
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text mb-3">
              Configuration
            </h3>
            <p className="text-[13px] text-text-muted mb-3">
              Create a{" "}
              <code className="font-mono text-accent-terra-text bg-accent-terra px-1.5 py-0.5 text-[12px]">.env</code> file with your
              Gmail credentials:
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
        </div>
      </div>
    </section>
  );
}
