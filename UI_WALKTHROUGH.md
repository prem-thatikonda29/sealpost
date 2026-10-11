# Sealpost: UI walkthrough

A guide to what is on screen, where to click, and what happens next. It is written for an agent that will read the live UI and produce a product motion video, so it describes screens, controls, states and transitions, and notes which moments are worth showing.

## What the product is

Sealpost is a browser tool for institutions and competitions. It turns a certificate template and a participant list into personalised certificates, then emails each one and shows live, per-person delivery results. A run that partly fails can be retried without emailing anyone twice.

The core story, in four beats:

1. **Design once.** Upload a template, click where the name goes.
2. **Load the people.** Upload a CSV, map its columns, check the addresses.
3. **Send and watch.** Live progress for every person.
4. **Fix what failed.** History, bounce detection, re-send only the failures.

## Run it locally

Both servers must be running.

| Part | URL |
|---|---|
| Frontend (the app) | http://localhost:3000, which redirects to `/events` |
| Backend API docs | http://localhost:8000/docs |

Start both from the repo root with `bash start.sh`. The app is light-theme only and works best at a laptop width of about 1280px or wider.

**Be careful what you send to.** A real send uses the Gmail account in `.env` and delivers real email. Never send to real participants or invented addresses while recording. Use only the recipient lists in `demo/`, which are built so that every email lands in the project owner's own inbox (see "Proof run" below). `Generate all and download` is a separate, no-email mode that is good for the early beats.

## Demo assets (use these)

- **Templates:** the `templates/` folder holds sample certificate images (`winner_template.jpg`, `runner_up_template.jpg`, `participant_template.jpg`, `top_10_template.jpg`, `2nd_runner_up_template.jpg`). Use one JPEG or PNG for the video.
- **Participants, for the no-email beats:** `demo/participants.csv`, 8 rows with columns `Name` and `Email`. Row 7 (`Vihaan Choudhury`) has a deliberately mistyped domain, `gmial.com`, so the invalid-domain warning appears. Use it with **Generate all and download** only; its addresses are not the owner's.
- **Participants, for the real send:** `demo/live-send.csv`, 7 rows, columns `Name` and `Email`. Five addresses use Gmail "plus" addressing (`name+aarav@gmail.com`), so they all arrive in the owner's own inbox, each personalised with its own first name. One row (`Vihaan Choudhury`) has the mistyped `gmial.com` domain, which the app flags as invalid and does not send to. One row (`Sanya Kapoor`) uses a mailbox that does not exist, so Gmail returns a bounce, which the app detects. Expected result: **5 sent, 1 invalid, 1 bounced**.

## Visual identity

Use these when composing the video so it matches the product.

- **Mood:** composed, editorial, unhurried. A well-made paper tool, like a ledger. It is **not** a glossy SaaS dashboard: no gradients, glow, glass or emoji.
- **Palette (light only):**
  - Canvas background `#f5f0eb`; cards `#fdfbf9`; raised surfaces `#faf7f4`.
  - Ink (text, primary buttons) `#2c2520`; muted text `#6e6258`; hairline borders `#e5ded5`.
  - Four status accents, each with a fixed meaning: **sage green** = success (`#d9e2d4` / text `#4a6340`), **amber** = warning (`#f0e4cc` / `#7a5c1e`), **terracotta** = bounced (`#e8d5cc` / `#8a4a33`), **rose** = failure (`#eadadd` / `#8a4a5c`).
- **Type:** serif (Newsreader) for the wordmark and empty-state headings; Geist sans for UI; Geist mono for numbers, labels and small caps-style labels.
- **Shape:** sharp 4px corners, 1px hairline borders. No heavy shadows.
- **Motion that already exists in the app:** a smooth ease-out for panel reveals and the progress bar, a spinner on in-flight row badges, a pulsing dot while checking bounces, and a small `▸` that rotates when a disclosure opens. Everything else is instant, so a video can add motion without contradicting the product.

## Global layout

A sticky top bar, 56px tall, with a thin bottom border.

- **Left:** the wordmark **Sealpost** (serif).
- **Next to it:** three links, **Events**, **Run**, **History**. The current page is darker with a thin underline.
- **Below:** a centered content column, up to about 1024px wide (Run is narrower, about 672px). Each page starts with a large page title, a one-line grey subtitle, and optional action buttons on the right.

Toast messages (success and error) appear for saves and deletes.

## The flow, screen by screen

### 1. Events: where certificates are designed (`/events`)

An **event** is one certificate design (template plus name placement plus styling). Create one per award tier: winners, runners-up, participants.

- **Empty state:** serif heading "No events yet", a short explanation, and a **Create your first event** button.
- **With events:** a two-column grid of hairline-divided cards. Each card shows the event name, an optional description, a status badge (**Ready** in green, or amber **No template** / **No position**), a mono line like `48px · bold · #000000` and `max 800px`, and buttons **Edit**, **Run →** and a red **Delete** (which opens a confirm dialog).
- **Header action:** **+ New Event**.

### 2. New Event: the editor (`/events/new`, and `/events/{id}` to edit)

The most visual screen and the best one to feature.

- **Top:** fields for **Event name** and **Description**, and a **Save event** button.
- **A split editor below:**
  - **Left, the canvas.**
    - **Upload template** button (becomes **Replace template**) and the image's pixel size.
    - The template image sits in the canvas. **Click anywhere on it to place the name.** The sample name appears centered at that point, and `x … · y …` coordinates update live at the top right.
    - **Dashed vertical guides** show the maximum text width.
    - Arrow keys nudge the name; Shift moves 10px steps.
    - If the name is wider than the limit, a line explains it is being shrunk (`48px → 36px`).
    - A **▸ Check exact output** disclosure renders the real server-side certificate image.
  - **Right, "Text & style" sidebar (about 256px wide):** **Preview name**, **Font** (a searchable picker over a bundled font library, with an upload-your-own option), **Font size**, **Style** (three small buttons: **Aa**, **B**, *I*; a button is greyed out if the chosen font has no such face), **Font color** (a hex field plus swatches) and **Max width**.
- **Good motion moments:** the template appearing, the click that drops the name onto the certificate, the name restyling live as the font or color changes, and the dashed guides.
- **Saving:** a "Saving…" button state, then a toast and a return to the Events grid.

### 3. Run: send a batch (`/run`)

All setup happens in one narrow column.

1. **Tier checklist.** Every saved event is a row with a checkbox, its name, and badges. **Tick one or more.** Ticking a row slides open its details panel (an animated reveal).
2. **Inside a ticked tier:**
   - **Participants CSV.** A **Choose CSV** button, then the file name and row count.
   - **Name column / Email column** dropdowns, auto-detected. A file with separate first and last name columns offers a combined "First Name + Last Name" option. The email column can be set to "No email column".
   - **Check email domains** button. It runs a mail-record check and shows a badge: **All domains valid** (green) or **N invalid domains** (amber). The preview table gets a **Domain** column showing Valid or a reason per row.
   - **Preview table** of the first 100 rows (`#`, Name, Email, Domain).
     - **Emails are masked by default** as `************`. An **eye icon in the Email column header** toggles them visible and hidden. This is worth showing: it is a privacy feature that works on a shared screen.
   - **Use this CSV — N rows** button. The tier's badge then shows a green **N rows**.
   - **Email for this tier.** **Subject** and **Body** fields. `{name}` in the body becomes the recipient's first name.
3. **Run options card.**
   - **Generate all and download** checkbox. This is a dry run that creates every certificate, sends nothing, and offers a zip at the end. **Use this when recording.**
   - **Batch size** (0 sends everything in one batch).
4. **Start button.** A full-width dark button. Its label changes with state: "Select at least one tier", then "Start — {event name}", "Start 2 tiers", or "Generate 8 certificates" when generate-only is ticked.
5. **Duplicate warning dialog.** Before any job starts, the app checks whether these people were already sent this certificate. Only if some were (so not on a fresh database), a dialog asks "Some of these people already have this certificate" with the counts and sample emails (masked by default, with its own eye toggle), plus **Send anyway** and cancel.

Amber and rose inline notices appear for problems: an event missing a template or position, or no email column selected.

### 4. Live progress (same page, after Start)

The setup form is replaced by one card per running tier, titled with the event name.

- **Progress bar** with a status line and counters. A real send goes `Checking addresses…`, `Generating and sending`, `Checking for bounces…`, `Complete`. A generate-only run goes straight to `Generating certificates`, then `Complete`. Counters read like `5 / 8 · 62%`.
- **Row log table** (`#`, Name, Email, Status, Note). Each row's status badge changes live, from a spinning grey **Generating** or **Sending** to a final one: green **Sent** or **Generated**, amber **Invalid domain**, terracotta **Bounced**, rose **Failed**. The Email column has the same eye toggle.
- **Bounce phase (send mode):** a pulsing terracotta dot with "Polling the Gmail inbox for bounce notifications — up to 30s."
- **Outcome:** a four-cell strip of large mono numbers, **Sent** (or **Generated**), **Failed**, **Invalid**, **Bounced**, each in its status color. In generate-only mode a **Download N certificates (.zip)** button appears.
- **Generate-only runs skip the server-side address check** (nothing is being sent, so addresses don't matter), so with the demo CSV expect **8 Generated, 0 Invalid**. The mistyped-domain warning shows up earlier, in the CSV preview's **Check email domains** step. It only shows as an **Invalid domain** row status in a real send.

### 5. History: the record of every run (`/history`)

- **Empty state:** "No jobs yet" with a **Go to Run** link.
- **List:** one row per past run, with the event name, a timestamp (and an italic "dry run" tag), a mono summary like `7/8 sent · 1 invalid`, and a status badge (Done, Running, Failed). The header has a **Clear history** button with a confirm dialog.
- **Open a job (`/history/{id}`):**
  - **Top:** a back link **← History**, the job name and time, and buttons **Download .zip**, **Export all N**, **Export N undelivered**, and a red **Delete**.
  - **Summary strip:** the same four large numbers.
  - **Re-send panel** (appears only when a real send had failures): a plain-language note such as "N people did not receive a certificate", an amber box for addresses that need correcting (with an **Export these N** button), a prefilled **Subject** and **Body** to edit, and a **Re-send to N people** button. Starting it shows the live progress UI again. A generate-only job has nothing to re-send, so this panel will not appear for one.
  - **Row table:** `#`, Name, Email (with the eye toggle), Status, Note.

## Proof run: a real send, then History

This is the part that shows it actually works. It sends real email, but only to the owner's own inbox.

1. **Run** → tick an event (use one with a template and a placed name) → **Choose CSV** → select `demo/live-send.csv`.
2. Click **Check email domains**. The `gmial.com` row gets an amber warning and the badge reads **1 invalid domain**.
3. Leave **Generate all and download** unticked. Write a short subject and body, for example "Your certificate" and "Hi {name}, your certificate is attached."
4. Press the **Start — {event name}** button. This is the money shot. Watch it go through:
   - `Checking addresses…`, where the bad domain becomes an amber **Invalid domain** row.
   - `Generating and sending`, with rows turning from a spinning grey **Sending** badge to green **Sent**.
   - `Checking for bounces…` with the pulsing terracotta dot (up to 30 seconds). The nonexistent mailbox flips to a terracotta **Bounced** row.
   - **Complete**, with the outcome strip showing **Sent 5, Failed 0, Invalid 1, Bounced 1**.
5. **Show the result in the inbox.** Switch to the owner's Gmail. Five emails have arrived, each greeting a different first name and carrying a PDF certificate with that person's name on it. Open one so the attachment is visible. This is the proof that generation and delivery both worked.
6. **History** → the new job is at the top of the list (`5/7 sent · 1 bounced · 1 invalid`, Done badge). Open it:
   - The four-number summary strip, then the row table with each row's status. Toggle the eye to reveal and hide the addresses.
   - The amber **Re-send** box listing the addresses that cannot be retried (the invalid domain and the bounce), with **Export these 2**. This is the "we tell you exactly who missed out and why" moment.
   - **Download .zip** and **Export all 7** / **Export 2 undelivered**.
7. Optional: go back to **Run** and start the same list again. The **Some of these people already have this certificate** dialog appears first, which shows the duplicate protection. Cancel it.

Notes:
- The **Re-send to N people** button only appears when a row has a retryable failure (a transient send error). This list produces address problems only, not retryable ones, so you will see the amber box and not the button. Do not promise the button in the video unless a retryable failure has actually occurred.
- Gmail may take a few seconds to deliver and to generate the bounce. If the bounce row does not appear inside the 30-second window, the row stays as Sent in this job. Rerun, or leave it out of the video.
- This costs real sends from the owner's Gmail account, and `demo/live-send.csv` contains the owner's address, so it is gitignored. Do not publish it or show the full address in the final video; keep the eye toggle in the masked state.

## Suggested storyboard for the video

| Beat | Screen | What to show | Key visual |
|---|---|---|---|
| 1 | Events | Empty state, then **+ New Event** | The serif heading and calm empty state |
| 2 | New Event | Upload a template, click to place the name, switch font and color | The name snapping onto the certificate; dashed width guides |
| 3 | Run | Tick a tier, choose the CSV, columns auto-fill | The panel sliding open; the preview table |
| 4 | Run | Toggle the eye to reveal then hide emails; **Check email domains** | `************` becoming addresses and back; the amber "1 invalid domain" badge |
| 5 | Run | Switch to `demo/live-send.csv`, write the email, press **Start** | The button label changing; the run starting |
| 6 | Live progress | Checking, sending, rows flipping to green, bounce check, outcome | Spinner badges resolving; the pulsing bounce dot; **5 Sent, 1 Invalid, 1 Bounced** |
| 7 | Gmail inbox | Five certificates received, one opened | The PDF attachment with the person's name on it. The proof it works |
| 8 | History | Open the job: summary strip, row table, the amber "needs fixing" box, exports | The big four-number strip; the eye toggle; **Export 2 undelivered** |
| 9 | Optional | Start the same list again | The duplicate warning dialog |
| 10 | Close | Return to Events or the wordmark | **Sealpost** in serif on the warm canvas |

An optional extra beat before 5: tick **Generate all and download** with `demo/participants.csv` to show the zip download.

## Things to avoid in the video

- Showing real participant emails. Keep the demo CSV and the masked state.
- Sending real mail to anyone other than the owner's own inbox, or using any list except `demo/live-send.csv` for a real send.
- Showing the owner's full email address on screen.
- Adding gradients, glows, dark mode or emoji. They contradict the product's look.
