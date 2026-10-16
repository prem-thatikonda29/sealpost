import pytest

from backend.data_cleaning import (
    analyze_rows,
    normalize_email,
    normalize_name,
    suggest_domain_fix,
)


@pytest.mark.parametrize("raw,expected", [
    ("  Ada   Lovelace ", "Ada Lovelace"),            # whitespace only
    ("ada lovelace", "Ada Lovelace"),                  # all lowercase
    ("ADA LOVELACE", "Ada Lovelace"),                  # all caps
    ("McDonald", "McDonald"),                          # mixed case: left alone
    ("Ada DeSouza", "Ada DeSouza"),
    ("o'brien", "O'Brien"),
    ("MARY-JANE WATSON", "Mary-Jane Watson"),
    ("AK SHARMA", "AK Sharma"),                        # initials survive in all caps
    ("ak sharma", "Ak Sharma"),
    ("Ada​ Lovelace", "Ada Lovelace"),            # zero-width space
    ("Ada Lovelace", "Ada Lovelace"),             # non-breaking space
    ("", ""),
    ("   ", ""),
    ("प्रेम कुमार", "प्रेम कुमार"),                      # no-case script untouched
])
def test_normalize_name(raw, expected):
    assert normalize_name(raw) == expected


@pytest.mark.parametrize("raw,expected", [
    ("  Ada@Example.COM ", "ada@example.com"),
    ("mailto:ada@example.com", "ada@example.com"),
    ("Ada Lovelace <ada@example.com>", "ada@example.com"),
    ('"ada@example.com";', "ada@example.com"),
    ("ada @example.com", "ada@example.com"),
    ("ada@example.com.", "ada@example.com"),
    ("ada​@example.com", "ada@example.com"),
    ("", ""),
])
def test_normalize_email(raw, expected):
    assert normalize_email(raw) == expected


def test_domain_typo_suggestion():
    assert suggest_domain_fix("ada@gmial.com") == "ada@gmail.com"
    assert suggest_domain_fix("ada@gmail.co") == "ada@gmail.com"
    assert suggest_domain_fix("ada@gmail.com") is None
    assert suggest_domain_fix("not-an-email") is None


def codes(result, index):
    return [i["code"] for i in result["rows"][index]["issues"]]


def test_clean_row_has_no_issues():
    result = analyze_rows([{"name": "Ada Lovelace", "email": "ada@example.com"}])
    assert codes(result, 0) == []
    assert result["summary"]["clean"] == 1


def test_tidy_fixes_are_reported_and_applied_to_the_clean_values():
    result = analyze_rows([{"name": "ADA LOVELACE", "email": " Ada@Example.com "}])
    row = result["rows"][0]
    assert row["clean_name"] == "Ada Lovelace"
    assert row["clean_email"] == "ada@example.com"
    assert codes(result, 0) == ["name_cleaned", "email_cleaned"]
    assert result["summary"]["tidied"] == 1
    assert result["summary"]["errors"] == 0


def test_original_values_are_kept_beside_the_clean_ones():
    row = analyze_rows([{"name": "ADA", "email": "a@b.com"}])["rows"][0]
    assert row["name"] == "ADA"


def test_missing_name_and_email_are_errors():
    result = analyze_rows([{"name": "", "email": ""}])
    assert codes(result, 0) == ["missing_name", "missing_email"]
    assert result["summary"]["errors"] == 1


def test_missing_email_is_fine_for_a_generate_only_run():
    result = analyze_rows([{"name": "Ada", "email": ""}], require_email=False)
    assert codes(result, 0) == []


def test_invalid_email():
    result = analyze_rows([{"name": "Ada", "email": "ada-at-example"}])
    assert codes(result, 0) == ["invalid_email"]


def test_domain_typo_is_a_suggestion_not_applied():
    row = analyze_rows([{"name": "Ada", "email": "ada@gmial.com"}])["rows"][0]
    assert row["clean_email"] == "ada@gmial.com"
    typo = next(i for i in row["issues"] if i["code"] == "domain_typo")
    assert typo["suggestion"] == {"field": "email", "value": "ada@gmail.com"}
    assert typo["severity"] == "warn"


def test_duplicates_are_found_after_cleaning_and_point_at_the_first_row():
    result = analyze_rows([
        {"name": "Ada", "email": "ada@example.com"},
        {"name": "Ada L", "email": " ADA@example.com"},
        {"name": "Grace", "email": "grace@example.com"},
    ])
    assert codes(result, 0) == []
    dup = next(i for i in result["rows"][1]["issues"] if i["code"] == "duplicate_email")
    assert dup["duplicate_of"] == 0
    assert dup["message"] == "Same address as row 1"
    assert result["summary"]["duplicates"] == 1


def test_blank_emails_are_not_duplicates_of_each_other():
    result = analyze_rows(
        [{"name": "Ada", "email": ""}, {"name": "Bo", "email": ""}], require_email=False
    )
    assert result["summary"]["duplicates"] == 0
