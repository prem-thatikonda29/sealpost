# Setup Guide: README + Landing Page Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show one canonical web-app setup guide on both the root README and the landing page, and clear every remaining CLI-era claim from the landing.

**Architecture:** Content-only refresh. The README gets targeted section rewrites (Features, Setup clone block, First-time flow, API table). The five landing components keep their section IDs, layout, and styling; only their content arrays and blocks change. No backend/frontend app code is touched.

**Tech Stack:** Markdown (README), Next.js 16 + Tailwind v4 + `@phosphor-icons/react` (landing components).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-30-setup-guide-readme-landing-design.md`
- Landing section IDs unchanged: `#hero`, `#features`, `#how-it-works`, `#quickstart`, `#configuration` (Sidebar/MobileNav/Footer anchor links must keep working).
- No structural/visual changes on the landing: same components, same class names on containers, same `useReveal()` wrappers. Content swaps only.
- No terminal cosplay on the landing: no `$` prompt, no fake window chrome for app behavior (`PRODUCT.md` → Anti-references).
- Accent text tokens available: `text-accent-terra-text`, `text-accent-sage-text`, `text-accent-amber-text`, `text-accent-rose-text` (defined in `landing/app/globals.css:13-20`).
- Canonical setup commands (must appear identically in README and landing Quickstart):
  ```
  git clone https://github.com/prem-thatikonda29/Certificates-Sender.git
  cd Certificates-Sender
  cp .env.example .env
  pip install -r backend/requirements.txt
  cd frontend && npm install
  bash start.sh
  ```
- Env vars are `GMAIL_USER` and `GMAIL_APP_PASSWORD` — never `EMAIL`/`PASSWORD`.
- Verification gate for every task: `npm run build` + `npm run lint` in `landing/` (Task 7 runs both at the end; no test framework exists for docs/content).

---

### Task 1: Root README.md refresh

**Files:**
- Modify: `README.md` (whole file — Features, Setup clone block, First-time flow, API table; Running/Runtime directories sections stay)

**Interfaces:**
- Produces: the canonical setup guide text that Task 4 mirrors verbatim in `landing/components/Quickstart.tsx`.

- [ ] **Step 1: Replace the Features section**

Replace the existing `## Features` block (lines 5-11) with:

```markdown
## Features

- **Visual name positioning** — Figma-style canvas editor: click on the template to set the exact center point, with live text overlay and marked max-text-width guides
- **Tier checklist with column mapping** — per-tier CSV upload on the Run page; names-only CSVs and split name columns are mapped for you
- **Email pre-validation** — DNS MX check before sending catches bad domains (typos like `@gmial.com`), plus a warning before re-sending to people who already have the certificate
- **Live per-row progress** — sent / failed / invalid domain statuses update in real time; after sending, bounce detection polls your Gmail inbox for NDRs
- **Re-send failures** — retry only the rows that missed out, with a message you can rewrite
- **Generate all and download** — a dry run that actually generates every certificate, downloaded as a zip
- **Job history** — per-row status, CSV export, delete a job or clear the history along with its certificates
- **Bundled font library** — pick from bundled fonts or upload your own
```

- [ ] **Step 2: Fix the clone block in Setup**

Replace:

```markdown
```bash
git clone <repo-url>
cd cert-sender
cp .env.example .env
```
```

with:

```markdown
```bash
git clone https://github.com/prem-thatikonda29/Certificates-Sender.git
cd Certificates-Sender
cp .env.example .env
```
```

Leave the `.env` contents block and the Gmail App Password note as they are.

- [ ] **Step 3: Rewrite the First-time flow**

Replace the `## First-time flow` section (the numbered list) with:

```markdown
## First-time flow

1. Go to `http://localhost:3000`
2. **Events → New Event** — upload a template image, click on it to place the name, choose a font, write the email subject/body
3. **Run** — check the tiers you want to run, upload each tier's CSV, map columns, optionally validate emails, start the job
4. Watch live progress — sent / invalid / failed rows update in real time
5. After ~30s, bounce check runs automatically against your Gmail inbox
6. **History** — view any past job, re-send to the people who missed out, export CSV, or delete the job with its certificates
```

- [ ] **Step 4: Replace the API table**

Replace the existing `## API` endpoint table with:

```markdown
| Endpoint | Description |
|---|---|
| `GET /api/events` | List all saved events |
| `POST /api/events` | Create event |
| `GET /api/events/{id}` | Get one event |
| `PUT /api/events/{id}` | Update event |
| `DELETE /api/events/{id}` | Delete event |
| `POST /api/templates/upload` | Upload a template image |
| `GET /api/templates/{id}` | Get template |
| `GET /api/fonts` | List bundled fonts |
| `POST /api/fonts/upload` | Upload a font |
| `GET /api/fonts/{id}/file` | Download font file |
| `POST /api/preview` | Render sample certificate → PNG |
| `POST /api/jobs` | Start a job (multipart: config JSON + CSV file) |
| `POST /api/jobs/validate-emails` | Validate email domains before sending |
| `POST /api/jobs/check-duplicates` | Warn about people who already have the certificate |
| `GET /api/jobs` | List all past jobs |
| `GET /api/jobs/{id}` | Get one job |
| `GET /api/jobs/{id}/progress` | SSE stream of real-time row progress |
| `GET /api/jobs/{id}/download` | Download generated certificates (zip) |
| `DELETE /api/jobs/{id}` | Delete a job with its certificates |
| `DELETE /api/jobs` | Clear the job history |
```

Keep the Swagger paragraph above the table unchanged.

- [ ] **Step 5: Verify README claims against the code**

Run:
```bash
rg -n "GMAIL_USER|GMAIL_APP_PASSWORD" .env.example
rg -n "@router\.(get|post|put|delete)" backend/routers/*.py
rg -n "backend/requirements.txt|bash start.sh|Python 3.11|Node.js 20" README.md
ls backend/requirements.txt start.sh
```
Expected: `.env.example` names both vars; every table row maps to a listed route; the install/run commands reference files that exist (`backend/requirements.txt`, `start.sh`). Fix any mismatch found.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: refresh README for the web-app setup, features, and full API surface"
```

---

### Task 2: Landing Hero

**Files:**
- Modify: `landing/components/Hero.tsx:12-21`

**Interfaces:**
- Consumes: none.
- Produces: none (leaf content change).

- [ ] **Step 1: Replace the eyebrow and subhead**

In `landing/components/Hero.tsx`, replace:

```tsx
        <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-text-faint mb-6">
          CLI Tool
        </p>
```

with:

```tsx
        <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-text-faint mb-6">
          Web App
        </p>
```

Replace:

```tsx
        <p className="mt-6 text-lg text-text-muted leading-relaxed max-w-[50ch]">
          Generate personalized PDF certificates and email them to participants.
          Built-in resume tracking and batch control.
        </p>
```

with:

```tsx
        <p className="mt-6 text-lg text-text-muted leading-relaxed max-w-[50ch]">
          Place names visually, upload a CSV, and watch every send land — or
          fail — in real time.
        </p>
```

- [ ] **Step 2: Verify no other CLI references remain**

Run: `rg -n "CLI" landing/components/Hero.tsx`
Expected: no matches.

---

### Task 3: Landing HowItWorks

**Files:**
- Modify: `landing/components/HowItWorks.tsx` (steps array lines 5-24; proof block lines 56-79)

**Interfaces:**
- Consumes: accent tokens from `landing/app/globals.css`.
- Produces: section `#how-it-works` (id must not change — Sidebar/MobileNav/Footer link to it).

- [ ] **Step 1: Replace the steps array**

Replace the `const steps = [...]` array with:

```tsx
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
      "Upload a CSV per tier and map its columns — names-only CSVs and split name columns work too",
  },
  {
    number: "03",
    title: "Send and watch",
    description:
      "Watch every row update live, catch bounces, and re-send only the people who missed out",
  },
];
```

- [ ] **Step 2: Replace the terminal proof block**

Replace the entire `<div className="mt-12">…</div>` proof block with a run-outcome card in the same structure (no `$` prompt, no terminal framing):

```tsx
        <div className="mt-12">
          <div className="bg-surface border border-border overflow-hidden transition-colors duration-150 hover:border-border-hover">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <span className="text-[11px] text-text-faint font-mono">run</span>
            </div>
            <pre className="p-4 overflow-x-auto">
              <code className="text-[13px] font-mono text-text leading-relaxed">
                <span className="text-accent-sage-text">sent</span>
                {"    priya@hackathon.dev"}
                {"\n"}
                <span className="text-accent-sage-text">sent</span>
                {"    amir@hackathon.dev"}
                {"\n"}
                <span className="text-accent-rose-text">failed</span>
                {"  rahul@hackathon.dev"}
                {"\n"}
                <span className="text-accent-amber-text">invalid</span>
                {" sam@gmial.com"}
                {"\n"}
                <span className="text-text-muted">
                  {"\n"}  … and 570 more rows
                </span>
                {"\n"}
                <span className="text-accent-sage-text">
                  {"\n"}  573 sent · 12 failed · 3 invalid
                </span>
              </code>
            </pre>
          </div>
        </div>
```

- [ ] **Step 3: Verify no CLI references remain**

Run: `rg -n "run\.py|python |\$" landing/components/HowItWorks.tsx`
Expected: no matches (the `$` prompt is gone).

---

### Task 4: Landing Quickstart (the setup guide)

**Files:**
- Modify: `landing/components/Quickstart.tsx:18-47` (the `space-y-8` block)

**Interfaces:**
- Consumes: canonical commands from Task 1 (must match README Setup verbatim).
- Produces: section `#quickstart`.

- [ ] **Step 1: Replace the three-step block**

Replace the entire `<div className="mt-10 space-y-8">…</div>` block with:

```tsx
        <div className="mt-10 space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-text mb-3">Installation</h3>
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
              <code className="font-mono text-accent-terra-text bg-accent-terra px-1.5 py-0.5 text-[12px]">http://localhost:3000</code>{" "}
              — events, runs, and history all live in the browser.
            </p>
          </div>
        </div>
```

- [ ] **Step 2: Verify no CLI-era commands remain**

Run: `rg -n "run\.py|EMAIL=|[^_]PASSWORD=" landing/components/Quickstart.tsx`
Expected: no matches. (`[^_]` excludes the legitimate `GMAIL_APP_PASSWORD=`.) Also confirm `pip install -r requirements.txt` (root) is gone: `rg -n "pip install -r" landing/components/Quickstart.tsx` → only `backend/requirements.txt`.

- [ ] **Step 3: Cross-check against README**

Run: `rg -n "Certificates-Sender|backend/requirements.txt|bash start.sh" README.md landing/components/Quickstart.tsx`
Expected: both files contain the clone URL, `backend/requirements.txt`, and `bash start.sh`.

---

### Task 5: Landing Configuration

**Files:**
- Modify: `landing/components/Configuration.tsx` (tiers array lines 5-24, subtitle line 35-38, table lines 40-79, code block lines 80-96)

**Interfaces:**
- Consumes: none.
- Produces: section `#configuration`.

- [ ] **Step 1: Replace the data array and subtitle**

Replace the `const tiers = [...]` array with:

```tsx
const places = [
  {
    where: ".env",
    what: "Gmail credentials — GMAIL_USER and GMAIL_APP_PASSWORD",
    detail: "Only credentials required to send",
  },
  {
    where: "Event",
    what: "Template, name position, font, email subject and body",
    detail: "Created under Events → New Event",
  },
  {
    where: "Tier",
    what: "CSV, column mapping, per-tier email overrides",
    detail: "Checked and uploaded on the Run page",
  },
];
```

Replace the subtitle paragraph:

```tsx
        <p className="mt-3 text-text-muted max-w-[50ch] leading-relaxed">
          Customize tiers, templates, and email settings in{" "}
          <code className="font-mono text-accent-terra-text bg-accent-terra px-1.5 py-0.5 text-[12px]">config.py</code>.
        </p>
```

with:

```tsx
        <p className="mt-3 text-text-muted max-w-[50ch] leading-relaxed">
          Three places hold a run's configuration — no config files to edit.
        </p>
```

- [ ] **Step 2: Replace the table**

Replace the `<div className="mt-10 overflow-x-auto border border-border">…</div>` table with a three-column table over `places`:

```tsx
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
```

- [ ] **Step 3: Replace the example code block**

Replace the `Example Tier Config` heading and its `config.py` block with:

```tsx
        <div className="mt-10">
          <h3 className="text-sm font-semibold text-text mb-3">
            Gmail credentials
          </h3>
          <CodeBlock
            code={`GMAIL_USER=your-email@gmail.com\nGMAIL_APP_PASSWORD=your-16-char-app-password`}
            label=".env"
          />
        </div>
```

Add `import CodeBlock from "./CodeBlock";` to the imports at the top of the file (alongside the existing `useReveal` import).

- [ ] **Step 4: Verify no config-file references remain**

Run: `rg -n "config\.py|data/|TIERS" landing/components/Configuration.tsx`
Expected: no matches.

---

### Task 6: Landing Features (factual fixes)

**Files:**
- Modify: `landing/components/Features.tsx:25-36` (two entries in the `features` array)

**Interfaces:**
- Consumes: none.
- Produces: section `#features`.

- [ ] **Step 1: Replace the Resume Support entry**

```tsx
  {
    icon: ArrowClockwise,
    title: "Re-send Failures",
    description: "Retry only the rows that missed out, with a message you can rewrite",
    color: "bg-accent-amber",
    textColor: "text-accent-amber-text",
  },
```

- [ ] **Step 2: Replace the Dry Run Mode entry**

```tsx
  {
    icon: ChartBarHorizontal,
    title: "Generate & Download",
    description: "Produce every certificate and download the zip without sending an email",
    color: "bg-accent-sage",
    textColor: "text-accent-sage-text",
  },
```

Leave Batch Generation, Email Delivery, Custom Templates, and Rate Control untouched.

- [ ] **Step 3: Verify remaining features are still true**

Run: `rg -n "batch_size|dry_run" backend/job_runner.py`
Expected: both exist (Rate Control and Generate & Download are accurate).

---

### Task 7: Build, lint, and final verification

**Files:**
- None modified; verification only.

**Interfaces:**
- Consumes: Tasks 1-6.

- [ ] **Step 1: Build the landing page**

Run: `npm run build` (workdir `landing/`)
Expected: `Compiled successfully` / no type errors.

- [ ] **Step 2: Lint the landing page**

Run: `npm run lint` (workdir `landing/`)
Expected: no errors (warnings pre-existing only if they existed before — compare with `git stash` only if unsure).

- [ ] **Step 3: Sweep for residual CLI-era claims**

Run:
```bash
rg -n "run\.py|config\.py|CLI Tool|pip install -r requirements\.txt|EMAIL=|[^_]PASSWORD=" landing/components README.md
```
Expected: no matches. (`[^_]PASSWORD=` avoids false-positiving on the legitimate `GMAIL_APP_PASSWORD=` in README and Quickstart.)

- [ ] **Step 4: Confirm anchors unchanged**

Run: `rg -n "id=\"(hero|features|how-it-works|quickstart|configuration)\"" landing/components/*.tsx`
Expected: all five section IDs present, one each.

- [ ] **Step 5: Commit the landing changes**

```bash
git add landing/components
git commit -m "docs: replace the landing's CLI-era guide with the web-app setup guide"
```
