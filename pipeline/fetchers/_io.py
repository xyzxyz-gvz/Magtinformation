"""Shared JSON-write helper for fetchers, with optional merge-on-write.

When the caller is doing an incremental fetch (`since` was set), the file
on disk holds a complete history that we must NOT overwrite. We instead
upsert the freshly-fetched records into the existing list by id and write
the merged result back.

For full refreshes (no `since`) we just overwrite, since the fetched data
already represents the entire collection.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def write_records(
    path: Path,
    records: list[dict[str, Any]],
    *,
    merge: bool = False,
    id_key: str = "id",
) -> int:
    """Write `records` to `path` as compact JSON.

    If ``merge`` is True and ``path`` already exists, read the existing
    records first and upsert ``records`` into them keyed by ``id_key`` so
    historical data isn't lost during incremental fetches.

    Returns the number of records actually written.
    """
    path.parent.mkdir(parents=True, exist_ok=True)

    out = records
    if merge and path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            existing = []
        if isinstance(existing, list):
            by_id: dict[Any, dict] = {}
            for r in existing:
                if isinstance(r, dict) and id_key in r:
                    by_id[r[id_key]] = r
            for r in records:
                if isinstance(r, dict) and id_key in r:
                    by_id[r[id_key]] = r
            # Preserve any records that lacked the id key (rare; keep them
            # as-is at the head so we don't silently drop data).
            keyless_old = [
                r for r in existing
                if not isinstance(r, dict) or id_key not in r
            ]
            keyless_new = [
                r for r in records
                if not isinstance(r, dict) or id_key not in r
            ]
            merged = list(by_id.values())
            try:
                merged.sort(key=lambda r: r.get(id_key, 0))
            except TypeError:
                pass  # mixed key types — leave order as-is
            out = keyless_old + merged + keyless_new

    path.write_text(
        json.dumps(out, ensure_ascii=False, indent=None, separators=(",", ":")),
        encoding="utf-8",
    )
    return len(out)
