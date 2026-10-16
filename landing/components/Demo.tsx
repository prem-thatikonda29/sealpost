"use client";

import { useEffect, useRef } from "react";
import { useReveal } from "./useReveal";

export default function Demo() {
  const ref = useReveal();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Play while the video is mostly on screen, pause when it leaves. Autoplay
  // only works muted, so sound is opt-in through the controls. A viewer who
  // pauses it themselves is left alone, and reduced-motion users get no autoplay.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let pausedByUser = false;
    let pausedByScroll = false;

    const onPause = () => {
      if (!pausedByScroll && !video.ended) pausedByUser = true;
      pausedByScroll = false;
    };
    video.addEventListener("pause", onPause);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!pausedByUser) video.play().catch(() => {});
        } else if (!video.paused) {
          pausedByScroll = true;
          video.pause();
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(video);

    return () => {
      observer.disconnect();
      video.removeEventListener("pause", onPause);
    };
  }, []);

  return (
    <section id="demo" className="pb-24 md:pb-32">
      <div ref={ref} className="reveal max-w-4xl mx-auto px-6">
        <h2 className="font-serif text-3xl md:text-4xl font-normal text-text tracking-[-0.02em]">
          See it run
        </h2>
        <p className="mt-3 text-text-muted max-w-[50ch] leading-relaxed">
          A full run in under a minute: design the certificate, load and check
          a list, then watch every send land.
        </p>
        <figure className="mt-10 bg-surface border border-border overflow-hidden shadow-[6px_6px_0_0_var(--color-accent-terra)] transition-colors duration-150 hover:border-border-hover">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-raised">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-border-hover" />
              <span className="w-2.5 h-2.5 rounded-full bg-border-hover" />
              <span className="w-2.5 h-2.5 rounded-full bg-border-hover" />
            </div>
            <span className="flex-1 text-center text-[11px] font-mono text-text-faint">
              Sealpost
            </span>
            <span className="w-[42px] max-sm:hidden" aria-hidden="true" />
          </div>
          <video
            ref={videoRef}
            className="block w-full aspect-video bg-canvas"
            controls
            muted
            loop
            playsInline
            preload="metadata"
            poster="/demo/sealpost-demo-poster.jpg"
            aria-label="Sealpost demo: design a certificate, check a participant list, send, and review the results"
          >
            <source src="/demo/sealpost-demo.mp4" type="video/mp4" />
            Your browser can&apos;t play this video.{" "}
            <a href="/demo/sealpost-demo.mp4">Download the demo</a>.
          </video>
          <figcaption className="px-4 py-2 border-t border-border bg-surface-raised text-[11px] font-mono text-text-faint">
            Plays muted. Use the speaker icon for sound.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
