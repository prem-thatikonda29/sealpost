"""
The optional "Sent with Sealpost" line. Off unless the organizer opts in, and
carried through to a re-send so a second pass reads the same as the first.
"""
import asyncio
import email

from backend import job_runner, mailer
from backend.models import Job, JobRow
from tests.test_generate_only import PEOPLE, env  # noqa: F401  (fixture)


class FakeSMTP:
    def __init__(self):
        self.messages = []

    def sendmail(self, sender, recipients, message):
        self.messages.append(message)


def body_of(raw: str) -> str:
    msg = email.message_from_string(raw)
    return msg.get_payload()[0].get_payload(decode=True).decode()


def send(tmp_path, monkeypatch, **kw):
    monkeypatch.setenv("GMAIL_USER", "org@gmail.com")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "x")
    pdf = tmp_path / "ada.pdf"
    pdf.write_bytes(b"%PDF-1.4")
    smtp = FakeSMTP()
    mailer.send_certificate(
        smtp=smtp, name="Priyanka Rao", email="ada@x.com",
        pdf_path=str(pdf), subject="Hi", body="Hi {name},\n\nHere you go.", **kw,
    )
    return body_of(smtp.messages[0])


class TestMailer:
    def test_no_footer_by_default(self, tmp_path, monkeypatch):
        text = send(tmp_path, monkeypatch)
        assert text == "Hi Priyanka,\n\nHere you go."
        assert "Sealpost" not in text

    def test_footer_is_added_when_asked(self, tmp_path, monkeypatch):
        text = send(tmp_path, monkeypatch, footer=True)
        assert text.startswith("Hi Priyanka,\n\nHere you go.")
        assert text.endswith("Sent with Sealpost: https://github.com/prem-thatikonda29/sealpost")

    def test_a_brace_in_the_body_is_still_a_placeholder_not_the_footer(self):
        # The footer goes on after substitution, so it is never run through format().
        assert "{" not in mailer.FOOTER and "}" not in mailer.FOOTER


def run_with(env, **extra):  # noqa: F811
    Session = env.session_factory
    db = Session()
    db.add(Job(id="job-f", status="pending", dry_run=False, total_rows=len(PEOPLE)))
    for i, (name, addr) in enumerate(PEOPLE):
        db.add(JobRow(job_id="job-f", row_index=i, name=name, email=addr, status="pending"))
    db.commit()
    db.close()
    config = {
        "template_path": env.template,
        "text_position_x": 200,
        "text_position_y": 140,
        "font_size": 48,
        "max_text_width": 350,
        "email_subject": "Your certificate",
        "email_body": "Hi {name}",
        **extra,
    }
    rows = [{"name": n, "email": e} for n, e in PEOPLE]
    asyncio.run(job_runner.run_job("job-f", config, rows, False))


class TestRunner:
    def test_runs_do_not_add_the_footer_unless_opted_in(self, env):  # noqa: F811
        run_with(env)
        assert [kw["footer"] for kw in env.sent] == [False, False]

    def test_opting_in_reaches_every_email(self, env):  # noqa: F811
        run_with(env, sealpost_footer=True)
        assert [kw["footer"] for kw in env.sent] == [True, True]
