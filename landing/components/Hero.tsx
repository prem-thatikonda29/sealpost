import { ArrowDown, ArrowRight } from "@phosphor-icons/react/dist/ssr";

const SEAL_TEXT = "SEALPOST · CERTIFICATES FOR EVERY PARTICIPANT · ";

/**
 * A postal-style seal. The ring of text turns slowly; the centre mark stamps in
 * once on load. Decorative, so it is hidden from assistive tech.
 */
function Seal() {
  return (
    <div
      aria-hidden="true"
      className="seal-stamp hidden md:block absolute right-6 bottom-6 w-[150px] lg:w-[176px] text-accent-terra-text"
    >
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <path id="seal-ring" d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0" />
        </defs>
        <circle cx="100" cy="100" r="98" className="fill-accent-terra" />
        <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
        <circle cx="100" cy="100" r="52" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
        <g className="seal-ring">
          <text fontSize="13" letterSpacing="3.2" fill="currentColor" fontFamily="var(--font-geist-mono)">
            <textPath href="#seal-ring" textLength="455">{SEAL_TEXT}</textPath>
          </text>
        </g>
        <path
          d="M78 102 L94 118 L124 82"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function Hero() {
  return (
    <section id="hero">
      <div className="relative w-full max-w-4xl mx-auto px-6 pt-28 md:pt-32 pb-12 md:pb-14">
        <p
          className="hero-in text-[11px] font-mono uppercase tracking-[0.15em] text-text-faint mb-6"
          style={{ "--d": "0ms" } as React.CSSProperties}
        >
          Web App
        </p>
        <h1
          className="hero-in font-serif text-5xl md:text-6xl lg:text-7xl font-normal text-text leading-[1.05] tracking-[-0.03em]"
          style={{ "--d": "80ms" } as React.CSSProperties}
        >
          Send hackathon certificates<br />
          <span className="relative inline-block italic text-accent-terra-text">
            in minutes
            <svg
              aria-hidden="true"
              viewBox="0 0 200 12"
              preserveAspectRatio="none"
              className="absolute left-0 -bottom-[0.06em] w-full h-[0.16em] overflow-visible"
            >
              <path
                d="M2 8 C 40 2, 90 12, 130 5 S 190 7, 198 4"
                pathLength={1}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="draw-underline"
              />
            </svg>
          </span>
        </h1>
        <p
          className="hero-in mt-6 text-lg text-text-muted leading-relaxed max-w-[50ch]"
          style={{ "--d": "180ms" } as React.CSSProperties}
        >
          Place names visually, upload a CSV, and watch every send land or fail
          as it happens.
        </p>
        <div
          className="hero-in mt-8 flex flex-col sm:flex-row sm:items-center gap-3"
          style={{ "--d": "260ms" } as React.CSSProperties}
        >
          <a
            href="#quickstart"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-text text-canvas font-medium text-sm
                       hover:bg-text/90 active:scale-[0.98] transition-all duration-150"
            style={{ borderRadius: "4px" }}
          >
            Get Started <ArrowRight className="w-4 h-4" weight="bold" />
          </a>
          <a
            href="#demo"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-border text-text font-medium text-sm
                       hover:border-border-hover active:scale-[0.98] transition-all duration-150"
            style={{ borderRadius: "4px" }}
          >
            Watch the demo <ArrowDown className="w-4 h-4" weight="bold" />
          </a>
          <a
            href="https://github.com/prem-thatikonda29/sealpost"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-text-muted hover:text-text underline underline-offset-4 decoration-border-hover
                       transition-colors duration-150 sm:ml-2"
          >
            GitHub
          </a>
        </div>
        <Seal />
      </div>
    </section>
  );
}
