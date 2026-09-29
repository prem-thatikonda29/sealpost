# Product

## Register

product

The repo carries two surfaces. `frontend/` is the primary surface and is product-register: design serves the task. `landing/` is brand-register and is the **source of visual identity** — its palette, type system, and geometry are the committed brand, and `frontend/` adopts them. The landing page is not a place to make new design decisions; it is the reference to conform to.

## Users

Hackathon and event organizers — often students or community leads, not professional developers. They run certificate generation for a few hundred to a few thousand participants, usually once or twice per event, and often under time pressure on the day results are announced.

Context of use: a laptop, in a browser, mid-event. They are assembling a run: pick a template, place the name field, upload a participant CSV, write the email, send, then watch it go out and deal with whatever fails. They come back weeks later for the next event and need to recognize the tool instantly.

Job to be done: get N personalized certificates into N inboxes, know exactly which ones failed and why, and re-run the failures without duplicating sends to people who already got one.

## Product Purpose

Browser-based certificate generation and delivery. Replaces a Python CLI that required editing config files and reading terminal output. The web UI exists so that the whole flow — template upload, visual name placement, CSV mapping, email authoring, live per-row send progress, bounce detection, and CSV export — is legible to someone who has never opened a terminal.

Success looks like: an organizer finishes an event without needing the README, and when 12 of 800 sends fail, they can see which 12, why, and fix it in one pass.

## Brand Personality

Composed, editorial, unhurried. The voice is plain and specific — "12 invalid domains", not "some issues occurred". Warm and human rather than clinical, but never cute: this tool sends real email to real people and a failed run is genuinely stressful, so the tone stays steady under error conditions.

Emotional goal: quiet confidence. The interface should feel like a well-made paper tool — a good form, a good ledger — not like a SaaS dashboard.

## Anti-references

- **The saturated SaaS dashboard.** Purple-to-blue gradients, glowing stat cards, floating glass panels, emoji, drop shadows on everything. Explicitly not this.
- **Terminal cosplay.** The tool replaced a CLI; it must not dress up as one. No fake window chrome, no green-on-black, no blinking cursors as decoration.
- **Pure grayscale default.** The current `frontend/` ships stock shadcn neutral tokens. That is the drift state this document exists to correct — indistinguishable from ten thousand other shadcn apps.
- **Display typography applied to UI.** The landing's serif is a display voice. Serif in buttons, labels, table headers, or form controls is a defect, not a flourish.
- **AI-scaffold landing patterns imported wholesale.** Mono-caps eyebrows above every section, numbered `01/02/03` markers, identical icon-heading-text card grids. The landing page has some of these by virtue of being a landing page; the app is not a landing page.

## Design Principles

1. **One identity, two densities.** The app and the landing page must read as the same product at a glance. The app keeps that identity while compressing spacing, tightening the type scale, and favoring scanability over breathing room.

2. **Serif is a title voice, never a UI voice.** Newsreader appears on page titles and the wordmark. Every label, button, table header, status, and data value is sans or mono. This is the line that keeps the app feeling like a tool.

3. **Color carries state, never decoration.** The four brand accents (terra, sage, amber, rose) each own a fixed semantic role across all screens. A green "sent" badge on one page and a sage "sent" badge on another is a bug.

4. **Errors are the product.** The failure paths — invalid domains, bounces, partial sends — get the most careful treatment in the interface. A run that goes perfectly needs very little UI; a run that goes wrong is where the tool earns its keep.

5. **Readable before pretty.** Every text token clears WCAG AA against every surface it lands on, including the small muted metadata that dense tools are tempted to render in light gray. Legibility is not negotiable for the sake of the palette's softness.

## Accessibility & Inclusion

- **WCAG 2.1 AA.** Body and secondary text ≥4.5:1; large text and non-text UI indicators ≥3:1. The landing palette fails this in three places as authored (`text-muted` 3.49, `text-faint` 2.01, terra-on-terra 3.75); the app adopts repaired values on the same hue ramps. See DESIGN.md.
- **Contrast is checked against the actual surface**, not the canvas. Cards, table headers, and tinted badge fills are all distinct backgrounds.
- **Reduced motion is required.** All transitions collapse to instant or crossfade under `prefers-reduced-motion: reduce`.
- **Status is never color alone.** Every status badge carries its text label; the colored dot in the progress view is paired with a sentence.
- **Keyboard-complete.** Every control reachable and operable by keyboard with a visible focus ring; the canvas position picker is a known gap (mouse-only) and is called out in DESIGN.md rather than silently accepted.
- **No email address or participant name is truncated without a title or a way to see the full value.** This is real data about real people.
