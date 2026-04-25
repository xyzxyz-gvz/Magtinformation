"""
Data normalization for Folketinget ODA API responses.

Key transforms:
  - /Date(epoch_ms)/ → ISO 8601 string
  - Strip OData metadata keys (__metadata, odata.*)
  - Flatten single-key expand wrappers
"""

import re
from typing import Any

# Matches /Date(1234567890000)/ and /Date(1234567890000+0200)/
_DATE_RE = re.compile(r"/Date\((-?\d+)([+-]\d{4})?\)/")


def _normalize_date(value: str) -> str:
    """Convert OData /Date(ms)/ to ISO 8601 UTC string."""
    m = _DATE_RE.match(value)
    if not m:
        return value
    ms = int(m.group(1))
    from datetime import datetime, timezone
    dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_value(value: Any) -> Any:
    """Recursively normalize a value."""
    if isinstance(value, str):
        if _DATE_RE.match(value):
            return _normalize_date(value)
        return value
    if isinstance(value, dict):
        return normalize_record(value)
    if isinstance(value, list):
        return [normalize_value(v) for v in value]
    return value


def normalize_record(record: dict) -> dict:
    """Normalize a single OData record dict."""
    out: dict[str, Any] = {}
    for key, value in record.items():
        # Drop OData metadata keys
        if key.startswith("__") or key.startswith("odata.") or key.startswith("@odata."):
            continue
        out[key] = normalize_value(value)
    return out


def normalize_records(records: list[dict]) -> list[dict]:
    """Normalize a list of OData records."""
    return [normalize_record(r) for r in records]
