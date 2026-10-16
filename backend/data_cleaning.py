"""
Checks and safe fixes for a participant list, before anything is generated or sent.

Pure functions: no database, no network. The DNS check stays in
email_validator; this module only looks at the text of each row.

Two kinds of change:
  - Safe fixes (stray whitespace, invisible characters, address case, ALL-CAPS or
    all-lowercase names) are applied to `clean_name` / `clean_email` and reported
    as "info" issues, so the user can see what changed.
  - Suggestions (a likely typo in a mail domain) are only offered. They are never
    applied on their own, because "gmail.co" is a real domain and the guess could
    be wrong.
"""
import re
import unicodedata
from typing import Dict, List, Optional

from .email_validator import validate_format

# Zero-width characters survive copy-paste from spreadsheets and PDFs, are
# invisible, and make an otherwise fine address fail to deliver.
_INVISIBLE = dict.fromkeys(map(ord, "​‌‍⁠﻿"), None)

# Address domains people commonly mistype, mapped to the one they meant.
DOMAIN_TYPOS: Dict[str, str] = {
    "gmial.com": "gmail.com",
    "gmai.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmil.com": "gmail.com",
    "gmail.co": "gmail.com",
    "gmail.con": "gmail.com",
    "gmail.cm": "gmail.com",
    "hotmial.com": "hotmail.com",
    "hotmal.com": "hotmail.com",
    "hotmail.con": "hotmail.com",
    "yahooo.com": "yahoo.com",
    "yaho.com": "yahoo.com",
    "yahoo.con": "yahoo.com",
    "outlok.com": "outlook.com",
    "outllook.com": "outlook.com",
    "outlook.con": "outlook.com",
    "icloud.con": "icloud.com",
}

# Longer than any real address (RFC 5321 caps one at 320) or name. Such cells are
# reported, not processed, so one pathological cell cannot burn CPU in the
# regex and unicode passes below.
MAX_EMAIL_LENGTH = 320
MAX_NAME_LENGTH = 500


def _clean_text(value: Optional[str]) -> str:
    text = unicodedata.normalize("NFC", value or "").translate(_INVISIBLE)
    text = text.replace(" ", " ")
    return re.sub(r"\s+", " ", text).strip()


def _capitalise_runs(token: str) -> str:
    # Capitalise each run of letters, so "o'brien" -> "O'Brien" and
    # "mary-jane" -> "Mary-Jane". Scripts without case are left as they are.
    return re.sub(r"[^\W\d_]+", lambda m: m.group(0).capitalize(), token)


_TITLES = {"dr": "Dr", "mr": "Mr", "mrs": "Mrs", "ms": "Ms", "prof": "Prof"}


def _is_initial(tok: str, bare: str) -> bool:
    if len(bare) == 1:
        return tok.rstrip(".") == bare
    return len(bare) == 2 and tok == bare and bare[1] not in "AEIOUY"


def normalize_name(name: Optional[str]) -> str:
    """Tidy a name. Only re-cases when it is ALL CAPS or all lowercase.

    A mixed-case name ("McDonald", "DeSouza", "Ada Lovelace") was typed on
    purpose and is left alone. In an all-caps name, initials stay upper-case: a
    single letter with an optional dot ("A", "K."), or a two-letter word not
    ending in a vowel ("AK", "KS"). "AK SHARMA" -> "AK Sharma", but "LI WEI" -> "Li Wei".
    Common titles are normalised ("DR. PREM" -> "Dr. Prem").
    """
    text = _clean_text(name)
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return text
    all_upper = all(c.isupper() for c in letters)
    all_lower = all(c.islower() for c in letters)
    if not (all_upper or all_lower):
        return text
    tokens = text.split(" ")
    out = []
    for tok in tokens:
        bare = re.sub(r"[^\w]", "", tok)
        title = _TITLES.get(tok.lower().rstrip("."))
        if title:
            out.append(title + ("." if tok.endswith(".") else ""))
        elif all_upper and len(tokens) > 1 and _is_initial(tok, bare):
            out.append(tok)
        else:
            out.append(_capitalise_runs(tok))
    return " ".join(out)


def normalize_email(email: Optional[str]) -> str:
    """Strip the wrapping people paste around an address, and lower-case it."""
    text = _clean_text(email)
    if re.match(r"mailto:", text, flags=re.IGNORECASE):
        text = re.sub(r"^mailto:", "", text, flags=re.IGNORECASE).split("?", 1)[0]
    angle = re.search(r"<([^<>]+)>", text)
    if angle:
        text = angle.group(1)
    text = text.strip(";,<>").rstrip(".").strip()
    if len(text) >= 2 and text[0] in "\"'" and text[-1] == text[0]:
        text = text[1:-1]
    return text.lower()


def suggest_domain_fix(email: str) -> Optional[str]:
    """The address with a mistyped common domain corrected, or None."""
    if "@" not in email:
        return None
    local, _, domain = email.rpartition("@")
    fixed = DOMAIN_TYPOS.get(domain)
    return f"{local}@{fixed}" if fixed else None


def _issue(code: str, severity: str, message: str, **extra) -> dict:
    return {"code": code, "severity": severity, "message": message, **extra}


def analyze_rows(rows: List[dict], require_email: bool = True) -> dict:
    """Look at every row. Returns the rows with their issues, and a summary.

    `rows` are {"name": str, "email": str}. Each result row carries the original
    values, the safely cleaned `clean_name` / `clean_email`, and `issues`:
    {code, severity: error|warn|info, message, suggestion?: {field, value},
    duplicate_of?: row index}.
    """
    results = []
    first_seen: Dict[str, int] = {}
    for index, row in enumerate(rows):
        name = row.get("name") or ""
        email = row.get("email") or ""
        name_too_long = len(name) > MAX_NAME_LENGTH
        email_too_long = len(email) > MAX_EMAIL_LENGTH
        clean_name = name if name_too_long else normalize_name(name)
        clean_email = email if email_too_long else normalize_email(email)
        issues = []

        if name_too_long:
            issues.append(_issue("name_too_long", "error", "Name is too long"))
        elif not clean_name:
            issues.append(_issue("missing_name", "error", "No name"))
        elif clean_name != name:
            issues.append(_issue(
                "name_cleaned", "info", "Name tidied",
                suggestion={"field": "name", "value": clean_name},
            ))

        if email_too_long:
            issues.append(_issue("invalid_email", "error", "Email address is too long"))
        elif not clean_email:
            if require_email:
                issues.append(_issue("missing_email", "error", "No email address"))
        else:
            if clean_email != email:
                issues.append(_issue(
                    "email_cleaned", "info", "Address tidied",
                    suggestion={"field": "email", "value": clean_email},
                ))
            ok, _reason = validate_format(clean_email)
            if not ok:
                issues.append(_issue("invalid_email", "error", "Not a valid email address"))
                if re.search(r"\s", clean_email):
                    tokens = clean_email.split()
                    joined = "".join(tokens)
                    if len(tokens) == 2 and validate_format(joined)[0]:
                        issues.append(_issue(
                            "email_spaces", "warn", "Remove the space?",
                            suggestion={"field": "email", "value": joined},
                        ))
            else:
                typo = suggest_domain_fix(clean_email)
                if typo:
                    issues.append(_issue(
                        "domain_typo", "warn",
                        f"Did you mean {typo.rpartition('@')[2]}?",
                        suggestion={"field": "email", "value": typo},
                    ))
                if clean_email in first_seen:
                    issues.append(_issue(
                        "duplicate_email", "warn",
                        f"Same address as row {first_seen[clean_email] + 1}",
                        duplicate_of=first_seen[clean_email],
                    ))
                else:
                    first_seen[clean_email] = index

        results.append({
            "index": index,
            "name": name,
            "email": email,
            "clean_name": clean_name,
            "clean_email": clean_email,
            "issues": issues,
        })

    def has(row, severity):
        return any(i["severity"] == severity for i in row["issues"])

    summary = {
        "total": len(results),
        "errors": sum(1 for r in results if has(r, "error")),
        "duplicates": sum(
            1 for r in results if any(i["code"] == "duplicate_email" for i in r["issues"])
        ),
        "typos": sum(
            1 for r in results if any(i["code"] == "domain_typo" for i in r["issues"])
        ),
        "tidied": sum(
            1 for r in results
            if any(i["code"] in ("name_cleaned", "email_cleaned") for i in r["issues"])
        ),
        "clean": sum(1 for r in results if not r["issues"]),
    }
    return {"rows": results, "summary": summary}
