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
    ("DR. PREM", "Dr. Prem"),
    ("dr prem", "Dr Prem"),
    ("PROF. RAO", "Prof. Rao"),
    ("MRS ANN", "Mrs Ann"),
    ("LI WEI", "Li Wei"),
    ("ANN MARIE DE SOUZA", "Ann Marie De Souza"),
    ("A K SHARMA", "A K Sharma"),
    ("K. S. RAVI", "K. S. Ravi"),
    ("I. K. GUJRAL", "I. K. Gujral"),
    ("VJ KUMAR", "VJ Kumar"),
    ("AK", "Ak"),
    ("ராமன்", "ராமன்"),
    ("प्रेम kumar", "प्रेम kumar"),
])
def test_normalize_name(raw, expected):
    assert normalize_name(raw) == expected


@pytest.mark.parametrize("raw,expected", [
    ("  Ada@Example.COM ", "ada@example.com"),
    ("mailto:ada@example.com", "ada@example.com"),
    ("Ada Lovelace <ada@example.com>", "ada@example.com"),
    ('"ada@example.com";', "ada@example.com"),
    ("ada @example.com", "ada @example.com"),
    ("Ada Lovelace ada@x.com", "ada lovelace ada@x.com"),
    (".ada@x.com", ".ada@x.com"),
    ("mailto:a@b.com?subject=x", "a@b.com"),
    ("ada@example.com.", "ada@example.com"),
    ('"john.doe"@example.com', '"john.doe"@example.com'),
    ('"a"@x.com.', '"a"@x.com'),
    ("'ada@example.com',", "ada@example.com"),
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


def test_none_name_and_email_do_not_crash():
    result = analyze_rows([{"name": None, "email": None}])
    assert codes(result, 0) == ["missing_name", "missing_email"]


def test_invalid_address_twice_is_not_a_duplicate():
    result = analyze_rows([
        {"name": "Ada", "email": "bad-address"},
        {"name": "Bo", "email": "bad-address"},
    ])
    assert codes(result, 0) == ["invalid_email"]
    assert codes(result, 1) == ["invalid_email"]
    assert result["summary"]["duplicates"] == 0


def test_same_typo_address_twice_is_one_duplicate_and_two_typos():
    result = analyze_rows([
        {"name": "Ada", "email": "x@gmial.com"},
        {"name": "Bo", "email": "x@gmial.com"},
    ])
    assert codes(result, 0) == ["domain_typo"]
    assert codes(result, 1) == ["domain_typo", "duplicate_email"]
    assert result["summary"]["duplicates"] == 1
    assert result["summary"]["typos"] == 2


def test_invalid_email_is_reported_even_when_email_is_optional():
    result = analyze_rows([{"name": "Ada", "email": "nope"}], require_email=False)
    assert codes(result, 0) == ["invalid_email"]


def test_summary_counts_mixed_rows():
    result = analyze_rows([
        {"name": "", "email": "a@example.com"},          # error
        {"name": "Bo", "email": "bo@gmial.com"},         # warn (typo)
        {"name": "CY LEE", "email": "cy@example.com"},   # info only (tidied)
        {"name": "Di Fox", "email": "di@example.com"},   # clean
    ])
    assert result["summary"] == {
        "total": 4, "errors": 1, "duplicates": 0, "typos": 1, "tidied": 1, "clean": 1,
    }


def _codes(row):
    return [i["code"] for i in row["issues"]]


def test_overlong_email_is_flagged_and_not_processed():
    raw = "a" * 309 + "@example.com"          # 321 chars
    assert len(raw) == 321
    out = analyze_rows([
        {"name": "Ada", "email": raw},
        {"name": "Bo", "email": raw},
    ])
    for row in out["rows"]:
        assert row["clean_email"] == raw
        assert _codes(row) == ["invalid_email"]
    assert out["summary"]["errors"] == 2
    assert out["summary"]["duplicates"] == 0


def test_email_of_exactly_320_characters_is_processed_normally():
    raw = "A" * 308 + "@example.com"
    assert len(raw) == 320
    row = analyze_rows([{"name": "Ada", "email": raw}])["rows"][0]
    assert row["clean_email"] == raw.lower()
    assert "invalid_email" not in _codes(row)
    assert "email_cleaned" in _codes(row)


def test_overlong_name_is_flagged_and_left_unchanged():
    raw = "ada " * 125 + "x"                   # 501 chars
    assert len(raw) == 501
    row = analyze_rows([{"name": raw, "email": "a@example.com"}])["rows"][0]
    assert row["clean_name"] == raw
    assert _codes(row) == ["name_too_long"]


def test_pathological_email_returns_and_is_invalid():
    out = analyze_rows([{"name": "Ada", "email": "a@" + "." * 300}])
    assert "invalid_email" in _codes(out["rows"][0])


def test_name_and_address_run_together_is_invalid_with_no_suggestion():
    row = analyze_rows([{"name": "Ada", "email": "Ada Lovelace ada@x.com"}])["rows"][0]
    assert "invalid_email" in [i["code"] for i in row["issues"]]
    # Only the harmless lower-casing is a tidy-up; no guessed recipient is offered.
    assert not any("suggestion" in i for i in row["issues"] if i["severity"] != "info")
    assert row["clean_email"] == "ada lovelace ada@x.com"


def test_single_space_in_address_is_suggested_not_applied():
    row = analyze_rows([{"name": "Ada", "email": "ada @example.com"}])["rows"][0]
    codes_ = [i["code"] for i in row["issues"]]
    assert "invalid_email" in codes_
    spaces = [i for i in row["issues"] if i["code"] == "email_spaces"]
    assert len(spaces) == 1
    assert spaces[0]["severity"] == "warn"
    assert spaces[0]["message"] == "Remove the space?"
    assert spaces[0]["suggestion"] == {"field": "email", "value": "ada@example.com"}
    assert row["clean_email"] != "ada@example.com"
