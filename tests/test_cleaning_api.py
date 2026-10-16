from fastapi.testclient import TestClient

from backend.main import app

# No `with`: the endpoint touches no database, so skip the app's startup.
client = TestClient(app)


def test_analyze_reports_issues_and_clean_values():
    res = client.post("/api/cleaning/analyze", json={"rows": [
        {"name": "ADA LOVELACE", "email": " Ada@Example.com"},
        {"name": "Bo", "email": "bo@gmial.com"},
        {"name": "", "email": "ada@example.com"},
    ]})
    assert res.status_code == 200
    body = res.json()
    assert body["rows"][0]["clean_name"] == "Ada Lovelace"
    assert body["rows"][0]["clean_email"] == "ada@example.com"
    assert body["summary"]["total"] == 3
    assert body["summary"]["typos"] == 1
    assert body["summary"]["duplicates"] == 1
    assert body["summary"]["errors"] == 1          # the row with no name


def test_analyze_defaults_to_requiring_an_email():
    res = client.post("/api/cleaning/analyze", json={"rows": [{"name": "Ada", "email": ""}]})
    assert res.json()["summary"]["errors"] == 1


def test_analyze_accepts_names_only_for_a_generate_only_run():
    res = client.post("/api/cleaning/analyze", json={
        "rows": [{"name": "Ada", "email": ""}], "require_email": False})
    assert res.json()["summary"]["errors"] == 0


def test_analyze_rejects_an_oversized_list():
    rows = [{"name": "A", "email": "a@x.com"}] * 10001
    assert client.post("/api/cleaning/analyze", json={"rows": rows}).status_code == 422


def test_analyze_rejects_a_cell_over_2000_characters():
    res = client.post("/api/cleaning/analyze", json={"rows": [{"name": "A", "email": "a" * 2001}]})
    assert res.status_code == 422
    res = client.post("/api/cleaning/analyze", json={"rows": [{"name": "A" * 2001, "email": ""}]})
    assert res.status_code == 422


def test_analyze_accepts_10000_rows():
    rows = [{"name": "A", "email": f"a{i}@x.com"} for i in range(10000)]
    res = client.post("/api/cleaning/analyze", json={"rows": rows})
    assert res.status_code == 200
    assert res.json()["summary"]["total"] == 10000
