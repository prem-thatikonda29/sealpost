"use client";

import CodeBlock from "./CodeBlock";
import { useReveal } from "./useReveal";

const places = [
  {
    where: ".env",
    what: "Gmail credentials: GMAIL_USER and GMAIL_APP_PASSWORD",
    detail: "The only credentials you need to send",
  },
  {
    where: "Event",
    what: "Template, name position, font, email subject and body",
    detail: "Made under Events → New Event",
  },
  {
    where: "Tier",
    what: "CSV, column mapping, per-tier email overrides",
    detail: "Uploaded and mapped on the Run page",
  },
];

export default function Configuration() {
  const ref = useReveal();

  return (
    <section id="configuration" className="py-24 md:py-32">
      <div ref={ref} className="reveal">
        <h2 className="font-serif text-3xl md:text-4xl font-normal text-text tracking-[-0.02em]">
          Configuration
        </h2>
        <p className="mt-3 text-text-muted max-w-[50ch] leading-relaxed">
          Everything a run needs lives in three places, and none of them are
          config files.
        </p>
        <div className="mt-10 overflow-x-auto border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-4 text-[11px] font-mono uppercase tracking-[0.1em] text-text-faint">
                  Where
                </th>
                <th className="py-2 px-4 text-[11px] font-mono uppercase tracking-[0.1em] text-text-faint">
                  What
                </th>
                <th className="py-2 px-4 text-[11px] font-mono uppercase tracking-[0.1em] text-text-faint">
                  Where you set it
                </th>
              </tr>
            </thead>
            <tbody>
              {places.map((place) => (
                <tr
                  key={place.where}
                  className="border-b border-border last:border-b-0 transition-colors duration-150 hover:bg-surface-raised"
                >
                  <td className="py-2 px-4 text-[13px] font-mono text-accent-terra-text">
                    {place.where}
                  </td>
                  <td className="py-2 px-4 text-[13px] text-text-muted">
                    {place.what}
                  </td>
                  <td className="py-2 px-4 text-[13px] text-text-muted">
                    {place.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-10">
          <h3 className="text-sm font-semibold text-text mb-3">
            Gmail credentials
          </h3>
          <CodeBlock
            code={`GMAIL_USER=your-email@gmail.com\nGMAIL_APP_PASSWORD=your-16-char-app-password`}
            label=".env"
          />
        </div>
      </div>
    </section>
  );
}
