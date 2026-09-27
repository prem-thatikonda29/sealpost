"""
Email format and DNS MX validation.
Both functions are safe to call from async code via run_in_executor.
"""
import re
from typing import Tuple

import dns.resolver
import dns.exception


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_format(email: str) -> Tuple[bool, str]:
    """
    Returns (valid: bool, reason: str).
    """
    if not email or not isinstance(email, str):
        return False, "empty"
    if not _EMAIL_RE.match(email.strip()):
        return False, "invalid_format"
    return True, "ok"


def validate_mx(email: str) -> Tuple[bool, str]:
    """
    Check that the email's domain has at least one MX record.
    Returns (valid: bool, reason: str).
    Performs a blocking DNS lookup — run in a thread pool from async code.
    """
    fmt_ok, reason = validate_format(email)
    if not fmt_ok:
        return False, reason

    domain = email.strip().split("@")[-1]
    try:
        answers = dns.resolver.resolve(domain, "MX", lifetime=5)
        if answers:
            return True, "ok"
        return False, "no_mx_records"
    except dns.resolver.NXDOMAIN:
        return False, "domain_not_found"
    except dns.resolver.NoAnswer:
        return False, "no_mx_records"
    except dns.exception.Timeout:
        return False, "dns_timeout"
    except Exception as exc:
        return False, f"dns_error: {exc}"
