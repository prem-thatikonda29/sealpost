import csv
import os
import re
import smtplib
import sys
from datetime import datetime
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv

from config import CC_ADDRESSES, SMTP_HOST, SMTP_PORT, TIERS

load_dotenv()

GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
SENT_LOG = "sent_log.csv"


def sanitize_name(name: str) -> str:
    name = name.lower().strip().replace(" ", "_")
    return re.sub(r"[^\w]", "", name)


def load_sent() -> set[str]:
    if not os.path.exists(SENT_LOG):
        return set()
    with open(SENT_LOG, newline="", encoding="utf-8") as fh:
        return {r["email"] for r in csv.DictReader(fh) if r.get("status") == "sent"}


def log_result(tier_name: str, name: str, email: str, status: str) -> None:
    write_header = not os.path.exists(SENT_LOG)
    with open(SENT_LOG, "a", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        if write_header:
            writer.writerow(["tier", "name", "email", "sent_at", "status"])
        writer.writerow([tier_name, name, email, datetime.now().isoformat(timespec="seconds"), status])


def send_email(smtp: smtplib.SMTP, name: str, email: str, pdf_path: str, tier: dict) -> None:
    msg = MIMEMultipart()
    msg["From"] = GMAIL_USER
    msg["To"] = email
    msg["Cc"] = ", ".join(CC_ADDRESSES)
    msg["Subject"] = tier["email_subject"]
    msg.attach(MIMEText(tier["email_body"].format(name=name), "plain"))

    with open(pdf_path, "rb") as fh:
        att = MIMEApplication(fh.read(), _subtype="pdf")
        att.add_header("Content-Disposition", "attachment", filename=os.path.basename(pdf_path))
        msg.attach(att)

    smtp.sendmail(GMAIL_USER, [email] + CC_ADDRESSES, msg.as_string())


def run_tier_dry_run(tier_name: str, tier: dict, sent: set[str]) -> tuple[int, int, int]:
    """Dry run: validate CSV and PDFs without sending."""
    with open(tier["csv"], newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    ok = skip = fail = 0
    for i, row in enumerate(rows, 1):
        name = row.get("name", "").strip()
        email = row.get("email", "").strip()

        if not name or not email:
            print(f"[{tier_name.upper()}] SKIP row {i}: missing name or email")
            skip += 1
            continue

        if email in sent:
            print(f"[{tier_name.upper()}] SKIP {name} <{email}>: already sent")
            skip += 1
            continue

        pdf_path = os.path.join(tier["output_dir"], f"{sanitize_name(name)}_{tier['cert_suffix']}.pdf")
        if not os.path.exists(pdf_path):
            print(f"[{tier_name.upper()}] WARN {name}: PDF not found at {pdf_path}")
            skip += 1
            continue

        print(f"[{tier_name.upper()}] OK   {name} <{email}> — would send {pdf_path}")
        ok += 1

    print(f"[{tier_name.upper()}] Dry run complete: {ok} ready to send, {skip} skipped.\n")
    return ok, skip, fail


def run_tier(smtp: smtplib.SMTP, tier_name: str, tier: dict, sent: set[str]) -> tuple[int, int, int]:
    with open(tier["csv"], newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    ok = skip = fail = 0
    for i, row in enumerate(rows, 1):
        name = row.get("name", "").strip()
        email = row.get("email", "").strip()

        if not name or not email:
            print(f"[{tier_name.upper()}] SKIP row {i}: missing name or email")
            skip += 1
            continue

        if email in sent:
            print(f"[{tier_name.upper()}] SKIP {name} <{email}>: already sent")
            skip += 1
            continue

        pdf_path = os.path.join(tier["output_dir"], f"{sanitize_name(name)}_{tier['cert_suffix']}.pdf")
        if not os.path.exists(pdf_path):
            print(f"[{tier_name.upper()}] WARN {name}: PDF not found at {pdf_path}")
            skip += 1
            continue

        try:
            send_email(smtp, name, email, pdf_path, tier)
            log_result(tier_name, name, email, "sent")
            sent.add(email)
            print(f"[{tier_name.upper()}] OK   {name} <{email}>")
            ok += 1
        except Exception as exc:
            log_result(tier_name, name, email, "failed")
            print(f"[{tier_name.upper()}] FAIL {name} <{email}>: {exc}")
            fail += 1

    print(f"[{tier_name.upper()}] Done: {ok} sent, {fail} failed, {skip} skipped.\n")
    return ok, skip, fail


def main() -> None:
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        raise SystemExit("Error: GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env")

    selected = sys.argv[1] if len(sys.argv) > 1 else None
    dry_run = False
    if selected and selected.startswith("--"):
        dry_run = selected == "--dry-run"
        selected = None
    elif len(sys.argv) > 2 and sys.argv[2] == "--dry-run":
        dry_run = True

    if selected and selected not in TIERS:
        raise SystemExit(f"Unknown tier '{selected}'. Choose from: {', '.join(TIERS)}")

    sent = load_sent()

    if dry_run:
        print("DRY RUN — will not send emails\n")
        for tier_name, tier in TIERS.items():
            if selected and tier_name != selected:
                continue
            run_tier_dry_run(tier_name, tier, sent)
        return

    print("Connecting to SMTP…")
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        print("Connected.\n")

        for tier_name, tier in TIERS.items():
            if selected and tier_name != selected:
                continue
            run_tier(smtp, tier_name, tier, sent)


if __name__ == "__main__":
    main()
