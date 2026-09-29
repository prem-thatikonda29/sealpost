"""
Which CSV column is which.

The backend re-parses the uploaded file itself, so the column names the UI
resolved have to be sent with the job. They were hardcoded to "name" and
"email", which meant a file headed `Full Name` previewed correctly in the
browser and then rendered blank certificates — the mapping existed only on the
side that displays the data, not the side that draws it.

The email column is also optional, because a generate-only run has nothing to
send to.
"""
import json

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import job_runner
from backend.database import Base, get_db
from backend.main import app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'csv.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    # The job itself is not under test; running it would need network and SMTP.
    monkeypatch.setattr(job_runner, "run_job", lambda *a, **k: None)

    template = tmp_path / "cert.jpg"
    Image.new("RGB", (400, 280), "white").save(template, "JPEG")

    with TestClient(app) as c:
        c.session_factory = Session
        c.template = str(template)
        yield c
    app.dependency_overrides.clear()


def submit(client, csv_text, *, name_col, email_col, dry_run=False):
    return client.post(
        "/api/jobs",
        data={
            "config": json.dumps({
                "event_config": {
                    "name": "Test",
                    "template_path": client.template,
                    "text_position_x": 200,
                    "text_position_y": 140,
                    "font_size": 48,
                    "max_text_width": 350,
                },
                "name_col": name_col,
                "email_col": email_col,
                "dry_run": dry_run,
            })
        },
        files={"csv_file": ("p.csv", csv_text, "text/csv")},
    )


def rows_of(client, job_id):
    return client.get(f"/api/jobs/{job_id}").json()["rows"]


# ── The mapping is honoured ───────────────────────────────────────────────────


class TestColumnMapping:
    def test_a_differently_named_column_still_reads(self, client):
        # The bug: the UI mapped this correctly and the backend looked for
        # "name", found nothing, and wrote empty names onto every certificate.
        csv = "Full Name,Email Address\nAda Lovelace,ada@x.com\n"
        r = submit(client, csv, name_col="Full Name", email_col="Email Address")
        assert r.status_code == 201

        rows = rows_of(client, r.json()["job_id"])
        assert [x["name"] for x in rows] == ["Ada Lovelace"]
        assert [x["email"] for x in rows] == ["ada@x.com"]

    def test_an_uppercase_header_still_reads(self, client):
        # Unchanged behaviour — the lookup lowercases both sides — but worth
        # pinning next to the case that broke.
        csv = "Name,Email\nAda Lovelace,ada@x.com\n"
        r = submit(client, csv, name_col="Name", email_col="Email")
        rows = rows_of(client, r.json()["job_id"])
        assert [x["name"] for x in rows] == ["Ada Lovelace"]

    def test_an_email_id_column_reads(self, client):
        csv = "Full Name,Email ID\nAda Lovelace,ada@x.com\n"
        r = submit(client, csv, name_col="Full Name", email_col="Email ID")
        rows = rows_of(client, r.json()["job_id"])
        assert [x["email"] for x in rows] == ["ada@x.com"]

    def test_a_wrong_name_column_yields_blank_certificates(self, client):
        # The dangerous shape, and the one the hardcoded mapping actually
        # produced: the address column happens to match, so rows are created,
        # the job runs, and every certificate comes out with no name on it.
        # Nothing errors. This is what the fix is for.
        csv = "Full Name,Email\nAda Lovelace,ada@x.com\n"
        r = submit(client, csv, name_col="name", email_col="email")
        assert r.status_code == 201

        rows = rows_of(client, r.json()["job_id"])
        assert [x["name"] for x in rows] == [""]

    def test_a_mapping_that_matches_nothing_is_refused(self, client):
        # When neither column matches there is nothing to work with at all, so
        # this one fails loudly rather than silently.
        csv = "Full Name,Email Address\nAda Lovelace,ada@x.com\n"
        r = submit(client, csv, name_col="name", email_col="email")
        assert r.status_code == 422
        assert "no usable rows" in r.json()["detail"].lower()


# ── A name split across two columns ───────────────────────────────────────────


class TestSplitNameColumns:
    """`First Name` + `Last Name` has to arrive as one name.

    A single-column mapping cannot express this, so `name_col` carries both
    comma-separated. Reading only the first would silently put "Ada" on a
    certificate meant to say "Ada Lovelace" — visible in the preview, but only
    to someone who thought to look, and there was no way to select both.
    """

    def test_two_columns_are_joined(self, client):
        csv = "First Name,Last Name,Email\nAda,Lovelace,ada@x.com\n"
        r = submit(client, csv, name_col="First Name,Last Name", email_col="Email")
        assert r.status_code == 201
        rows = rows_of(client, r.json()["job_id"])
        assert [x["name"] for x in rows] == ["Ada Lovelace"]

    def test_the_join_is_case_insensitive(self, client):
        csv = "first name,LAST NAME,Email\nAda,Lovelace,ada@x.com\n"
        r = submit(client, csv, name_col="first name,LAST NAME", email_col="Email")
        rows = rows_of(client, r.json()["job_id"])
        assert [x["name"] for x in rows] == ["Ada Lovelace"]

    def test_a_missing_half_does_not_leave_a_stray_space(self, client):
        # Not everyone has both filled in, and a trailing space would end up
        # centred on the certificate.
        csv = "First Name,Last Name,Email\nAda,,ada@x.com\n,Lovelace,grace@x.com\n"
        r = submit(client, csv, name_col="First Name,Last Name", email_col="Email")
        rows = rows_of(client, r.json()["job_id"])
        assert [x["name"] for x in rows] == ["Ada", "Lovelace"]

    def test_a_single_column_still_works_unchanged(self, client):
        # The comma-separated form has to be additive, not a replacement.
        csv = "Full Name,Email\nAda Lovelace,ada@x.com\n"
        r = submit(client, csv, name_col="Full Name", email_col="Email")
        rows = rows_of(client, r.json()["job_id"])
        assert [x["name"] for x in rows] == ["Ada Lovelace"]

    def test_surname_alone_is_still_one_column(self, client):
        csv = "Surname,Email\nLovelace,ada@x.com\n"
        r = submit(client, csv, name_col="Surname", email_col="Email")
        rows = rows_of(client, r.json()["job_id"])
        assert [x["name"] for x in rows] == ["Lovelace"]

    def test_a_split_name_works_for_a_generate_only_run(self, client):
        csv = "First Name,Last Name\nAda,Lovelace\n"
        r = submit(client, csv, name_col="First Name,Last Name", email_col="",
                   dry_run=True)
        assert r.status_code == 201
        rows = rows_of(client, r.json()["job_id"])
        assert [x["name"] for x in rows] == ["Ada Lovelace"]


# ── Names only ────────────────────────────────────────────────────────────────


class TestNamesOnlyCsv:
    def test_a_generate_only_run_accepts_a_names_only_csv(self, client):
        csv = "Name\nAda Lovelace\nGrace Hopper\n"
        r = submit(client, csv, name_col="Name", email_col="", dry_run=True)
        assert r.status_code == 201, r.text

        rows = rows_of(client, r.json()["job_id"])
        assert [x["name"] for x in rows] == ["Ada Lovelace", "Grace Hopper"]
        assert [x["email"] for x in rows] == ["", ""]

    def test_a_generate_only_run_accepts_a_csv_with_no_email_column_at_all(self, client):
        # Not merely empty cells — the column genuinely absent, which is what a
        # participants sheet often looks like.
        csv = "Participant\nAda Lovelace\n"
        r = submit(client, csv, name_col="Participant", email_col="", dry_run=True)
        assert r.status_code == 201

    def test_sending_a_names_only_csv_is_refused(self, client):
        # Without this guard every row comes back "invalid_domain", which reads
        # as bad data rather than a missing column.
        csv = "Name\nAda Lovelace\n"
        r = submit(client, csv, name_col="Name", email_col="", dry_run=False)
        assert r.status_code == 422
        assert "no email addresses" in r.json()["detail"].lower()

    def test_the_refusal_points_at_the_way_out(self, client):
        csv = "Name\nAda Lovelace\n"
        r = submit(client, csv, name_col="Name", email_col="", dry_run=False)
        assert "Generate all and download" in r.json()["detail"]

    def test_a_csv_with_addresses_still_sends(self, client):
        csv = "Name,Email\nAda Lovelace,ada@x.com\n"
        r = submit(client, csv, name_col="Name", email_col="Email", dry_run=False)
        assert r.status_code == 201

    def test_one_address_is_enough_to_send(self, client):
        # A partly-filled email column is a data problem, not a missing column;
        # the rows without one are the ones that come back invalid.
        csv = "Name,Email\nAda Lovelace,ada@x.com\nGrace Hopper,\n"
        r = submit(client, csv, name_col="Name", email_col="Email", dry_run=False)
        assert r.status_code == 201
