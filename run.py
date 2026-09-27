"""
Usage:
    python3 run.py              # all tiers
    python3 run.py top3         # single tier
    python3 run.py top3 --dry-run  # generate only, skip sending
"""
import csv
import os
import re
import smtplib
import sys
from datetime import datetime
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import time

import img2pdf
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from config import CC_ADDRESSES, FONT_COLOR, FONT_PATH, PILL_COLOR, PILL_PADDING_X, PILL_PADDING_Y, SMTP_HOST, SMTP_PORT, TIERS

load_dotenv()

import json

GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
SENT_LOG = "sent_log.csv"
PROGRESS_FILE = "progress.json"


def sanitize_name(name: str) -> str:
    name = name.lower().strip().replace(" ", "_")
    return re.sub(r"[^\w]", "", name)


def get_first_name(full_name: str) -> str:
    """Extract first name (>3 chars, no periods) for salutation."""
    for part in full_name.split():
        if len(part) > 3 and "." not in part:
            return part
    return full_name.split()[0] if full_name.split() else full_name


def fit_font(text: str, font_size: int, max_width: int, font_path: str = None) -> ImageFont.FreeTypeFont:
    path = font_path or FONT_PATH
    size = font_size
    while size >= 10:
        font = ImageFont.truetype(path, size)
        bbox = font.getbbox(text)
        if (bbox[2] - bbox[0]) <= max_width:
            return font
        size -= 2
    return ImageFont.truetype(path, 10)


def generate_certificate(name: str, output_path: str, tier: dict) -> None:
    img = Image.open(tier["template"]).convert("RGBA")

    font_path = tier.get("font_path")
    font = fit_font(name, tier["font_size"], tier["max_text_width"], font_path)
    bbox = font.getbbox(name)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    cx, cy = tier["text_position"]
    text_x = cx - text_w // 2
    text_y = cy - text_h // 2

    apply_glass = tier.get("apply_glass_effect", True)

    if apply_glass:
        pill_x0 = text_x - PILL_PADDING_X
        pill_y0 = text_y - PILL_PADDING_Y
        pill_x1 = text_x + text_w + PILL_PADDING_X
        pill_y1 = text_y + text_h + PILL_PADDING_Y
        radius = (pill_y1 - pill_y0) // 2

        pill_mask = Image.new("L", img.size, 0)
        ImageDraw.Draw(pill_mask).rounded_rectangle(
            [pill_x0, pill_y0, pill_x1, pill_y1], radius=radius, fill=255
        )

        blurred = img.filter(ImageFilter.GaussianBlur(radius=28))
        img.paste(blurred, mask=pill_mask)

        dark_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(dark_layer).rounded_rectangle(
            [pill_x0, pill_y0, pill_x1, pill_y1], radius=radius, fill=PILL_COLOR
        )
        img = Image.alpha_composite(img, dark_layer)

        border_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(border_layer).rounded_rectangle(
            [pill_x0, pill_y0, pill_x1, pill_y1],
            radius=radius, outline=(255, 255, 255, 55), width=2,
        )
        img = Image.alpha_composite(img, border_layer)

        highlight_h = max(6, (pill_y1 - pill_y0) // 6)
        highlight_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(highlight_layer).rounded_rectangle(
            [pill_x0, pill_y0, pill_x1, pill_y0 + highlight_h * 2],
            radius=radius, fill=(255, 255, 255, 35),
        )
        img = Image.alpha_composite(
            img,
            Image.composite(highlight_layer, Image.new("RGBA", img.size, (0, 0, 0, 0)), pill_mask),
        )

    ImageDraw.Draw(img).text((text_x, text_y), name, font=font, fill=FONT_COLOR)

    rgb = img.convert("RGB")
    tmp_png = output_path.replace(".pdf", "_tmp.png")
    rgb.save(tmp_png, "PNG")
    with open(tmp_png, "rb") as img_f, open(output_path, "wb") as pdf_f:
        pdf_f.write(img2pdf.convert(img_f))
    os.remove(tmp_png)


def load_cursor(tier_name: str) -> int:
    if not os.path.exists(PROGRESS_FILE):
        return 0
    with open(PROGRESS_FILE, encoding="utf-8") as fh:
        return json.load(fh).get(tier_name, 0)


def save_cursor(tier_name: str, idx: int) -> None:
    data = {}
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, encoding="utf-8") as fh:
            data = json.load(fh)
    data[tier_name] = idx
    with open(PROGRESS_FILE, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)


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
    msg.attach(MIMEText(tier["email_body"].format(name=get_first_name(name)), "plain"))
    with open(pdf_path, "rb") as fh:
        att = MIMEApplication(fh.read(), _subtype="pdf")
        att.add_header("Content-Disposition", "attachment", filename=os.path.basename(pdf_path))
        msg.attach(att)
    smtp.sendmail(GMAIL_USER, [email] + CC_ADDRESSES, msg.as_string())


def make_smtp() -> smtplib.SMTP:
    smtp = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
    smtp.ehlo()
    smtp.starttls()
    smtp.login(GMAIL_USER, GMAIL_APP_PASSWORD)
    return smtp


def run_tier(tier_name: str, tier: dict, smtp: smtplib.SMTP | None, sent: set[str], batch: int = 0) -> None:
    if not os.path.exists(tier["template"]):
        print(f"[{tier_name.upper()}] SKIP — template not found: {tier['template']}\n")
        return

    os.makedirs(tier["output_dir"], exist_ok=True)

    with open(tier["csv"], newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    cursor = load_cursor(tier_name)
    if cursor >= len(rows):
        print(f"[{tier_name.upper()}] All {len(rows)} rows already processed.\n")
        return

    if cursor > 0:
        print(f"[{tier_name.upper()}] Resuming from row {cursor + 1}/{len(rows)}")

    gen_ok = gen_skip = send_ok = send_fail = 0

    for idx in range(cursor, len(rows)):
        row = rows[idx]
        name = row.get("name", row.get("Name", "")).strip()
        email = row.get("email", row.get("Email id", row.get("Email", ""))).strip()

        if not name or not email:
            print(f"[{tier_name.upper()}] SKIP row {idx + 1}: missing name or email")
            gen_skip += 1
            save_cursor(tier_name, idx + 1)
            continue

        pdf_path = os.path.join(tier["output_dir"], f"{sanitize_name(name)}_{tier['cert_suffix']}.pdf")

        if smtp is not None and email in sent:
            save_cursor(tier_name, idx + 1)
            continue

        generate_certificate(name, pdf_path, tier)
        gen_ok += 1

        if smtp is None:
            save_cursor(tier_name, idx + 1)
            continue

        try:
            try:
                smtp.noop()
            except Exception:
                print(f"[{tier_name.upper()}] SMTP connection lost, reconnecting…")
                smtp = make_smtp()

            send_email(smtp, name, email, pdf_path, tier)
            log_result(tier_name, name, email, "sent")
            sent.add(email)
            save_cursor(tier_name, idx + 1)
            print(f"[{tier_name.upper()}] OK   {name} <{email}>  ({idx + 1}/{len(rows)})")
            send_ok += 1
            time.sleep(0.5)

            if batch and send_ok >= batch:
                print(f"[{tier_name.upper()}] Batch of {batch} done. Re-run to continue.\n")
                return
        except Exception as exc:
            log_result(tier_name, name, email, "failed")
            print(f"[{tier_name.upper()}] FAIL {name} <{email}>: {exc}")
            send_fail += 1

    if smtp is None:
        print(f"[{tier_name.upper()}] Generated {gen_ok}, skipped {gen_skip}. (dry-run — not sent)\n")
    else:
        print(f"[{tier_name.upper()}] Generated {gen_ok} | Sent {send_ok}, failed {send_fail}\n")


def main() -> None:
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    args = [a for a in args if a != "--dry-run"]

    batch = 0
    batch_args = [a for a in args if a.startswith("--batch=")]
    if batch_args:
        batch = int(batch_args[0].split("=")[1])
        args = [a for a in args if not a.startswith("--batch=")]

    selected = args[0] if args else None
    if selected and selected not in TIERS:
        raise SystemExit(f"Unknown tier '{selected}'. Choose from: {', '.join(TIERS)}")

    if not dry_run and (not GMAIL_USER or not GMAIL_APP_PASSWORD):
        raise SystemExit("Error: GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env")

    sent = load_sent()
    smtp_conn = None

    if not dry_run:
        print("Connecting to Gmail SMTP…")
        smtp_conn = make_smtp()
        print("Connected.\n")

    try:
        for tier_name, tier in TIERS.items():
            if selected and tier_name != selected:
                continue
            run_tier(tier_name, tier, smtp_conn, sent, batch)
    finally:
        if smtp_conn:
            smtp_conn.quit()


if __name__ == "__main__":
    main()
