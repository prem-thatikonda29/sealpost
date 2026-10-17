"""
SMTP email sending and Gmail IMAP bounce polling.
"""
import imaplib
import os
import re
import smtplib
from datetime import datetime
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List

from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
IMAP_HOST = "imap.gmail.com"
IMAP_PORT = 993

# Appended to the body when the organizer opts in. Plain text, and added after
# the body's {name} substitution so it can never be mistaken for a placeholder.
FOOTER = "\n\n--\nSent with Sealpost: https://sealpost.vercel.app"

# Extract all email addresses from a block of text
_EMAIL_RE = re.compile(r"[\w.\-+]+@[\w.\-]+\.\w+")


def _credentials():
    user = os.getenv("GMAIL_USER")
    password = os.getenv("GMAIL_APP_PASSWORD")
    if not user or not password:
        raise EnvironmentError(
            "GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env"
        )
    return user, password


def make_smtp_connection() -> smtplib.SMTP:
    """Create and return an authenticated Gmail SMTP connection."""
    user, password = _credentials()
    smtp = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
    smtp.ehlo()
    smtp.starttls()
    smtp.login(user, password)
    return smtp


def send_certificate(
    smtp: smtplib.SMTP,
    name: str,
    email: str,
    pdf_path: str,
    subject: str,
    body: str,
    footer: bool = False,
) -> None:
    """
    Send a certificate PDF to `email`.
    `body` may contain {name} which is substituted with the first name.
    `footer` appends the "Sent with Sealpost" line.
    Raises smtplib.SMTPException on failure.
    """
    from .cert_engine import get_first_name

    user, _ = _credentials()
    first = get_first_name(name)

    msg = MIMEMultipart()
    msg["From"] = user
    msg["To"] = email
    msg["Subject"] = subject
    text = body.format(name=first)
    if footer:
        text += FOOTER
    msg.attach(MIMEText(text, "plain"))

    with open(pdf_path, "rb") as fh:
        att = MIMEApplication(fh.read(), _subtype="pdf")
        att.add_header(
            "Content-Disposition",
            "attachment",
            filename=os.path.basename(pdf_path),
        )
        msg.attach(att)

    smtp.sendmail(user, [email], msg.as_string())


def poll_bounces(since_dt: datetime) -> List[str]:
    """
    Poll the Gmail inbox via IMAP for bounce / NDR emails received since
    `since_dt`. Returns a deduplicated list of email addresses that bounced.

    Looks for messages from mailer-daemon OR with subject containing
    "Delivery Status Notification".
    """
    user, password = _credentials()

    # IMAP date format: DD-Mon-YYYY  e.g. "01-Jan-2025"
    since_str = since_dt.strftime("%d-%b-%Y")

    bounced: set[str] = set()

    try:
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        mail.login(user, password)
        mail.select("INBOX")

        # Search for NDR emails from mailer-daemon
        queries = [
            f'(FROM "mailer-daemon" SINCE {since_str})',
            f'(SUBJECT "Delivery Status Notification" SINCE {since_str})',
            f'(SUBJECT "Undeliverable" SINCE {since_str})',
        ]

        seen_uids: set[str] = set()
        for query in queries:
            _, data = mail.search(None, query)
            uids = data[0].split() if data[0] else []
            for uid in uids:
                if uid in seen_uids:
                    continue
                seen_uids.add(uid)
                _, msg_data = mail.fetch(uid, "(RFC822)")
                if not msg_data or not msg_data[0]:
                    continue
                raw = msg_data[0][1]
                if isinstance(raw, bytes):
                    raw = raw.decode("utf-8", errors="ignore")
                # Extract all email addresses found in the NDR body
                found = _EMAIL_RE.findall(raw)
                for addr in found:
                    # Filter out obvious non-recipient addresses
                    addr_lower = addr.lower()
                    if any(
                        skip in addr_lower
                        for skip in ("mailer-daemon", "postmaster", "noreply", user.lower())
                    ):
                        continue
                    bounced.add(addr_lower)

        mail.logout()
    except Exception:
        # Bounce polling is best-effort — never crash the job over it
        pass

    return list(bounced)
