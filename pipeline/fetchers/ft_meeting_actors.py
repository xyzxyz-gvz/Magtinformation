"""
Fetcher for MødeAktør — who attended each meeting.

Produces:
  public/data/meeting_actors.json  — actor attendance records per meeting

Used in preprocess to show:
  - Which committee meetings each politician attended
  - Co-attendees: other politicians, organisations, lobbyists, etc.
"""

import logging
from datetime import datetime
from pathlib import Path

from pipeline.fetchers.base import ODataFetcher
from pipeline.transformers.normalize import normalize_records

logger = logging.getLogger(__name__)


def fetch_meeting_actors(
    fetcher: ODataFetcher,
    out_dir: Path,
    since: datetime | None = None,
) -> None:
    """Fetch MødeAktør records and write meeting_actors.json."""
    records = fetcher.fetch_all(
        endpoint="MødeAktør",
        expand="Aktør",
        since=since,
        desc="MødeAktør (meeting attendance)",
    )
    normalized = normalize_records(records)
    _write(out_dir / "meeting_actors.json", normalized)
    logger.info("meeting_actors.json: %d records", len(normalized))


def _write(path: Path, data: list[dict]) -> None:
    import json
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=None, separators=(",", ":")),
        encoding="utf-8",
    )
