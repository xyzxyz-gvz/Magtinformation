"""
Fetcher for Møde (plenary meetings) and Dagsordenspunkt (agenda items).

Produces:
  public/data/meetings.json      — meetings with type and status
  public/data/agenda_items.json  — agenda items linked to meetings
"""

import logging
from datetime import datetime
from pathlib import Path

from pipeline.fetchers.base import ODataFetcher
from pipeline.transformers.normalize import normalize_records

logger = logging.getLogger(__name__)


def fetch_meetings(
    fetcher: ODataFetcher,
    out_dir: Path,
    since: datetime | None = None,
) -> None:
    """Fetch Møde records and write meetings.json."""
    records = fetcher.fetch_all(
        endpoint="Møde",
        expand="Mødetype,Mødestatus",
        since=since,
        desc="Møder (meetings)",
    )
    normalized = normalize_records(records)
    _write(out_dir / "meetings.json", normalized)
    logger.info("meetings.json: %d records", len(normalized))


def fetch_agenda_items(
    fetcher: ODataFetcher,
    out_dir: Path,
    since: datetime | None = None,
) -> None:
    """Fetch Dagsordenspunkt records and write agenda_items.json."""
    records = fetcher.fetch_all(
        endpoint="Dagsordenspunkt",
        expand=None,
        since=since,
        desc="Dagsordenspunkter (agenda)",
    )
    normalized = normalize_records(records)
    _write(out_dir / "agenda_items.json", normalized)
    logger.info("agenda_items.json: %d records", len(normalized))


def _write(path: Path, data: list[dict]) -> None:
    import json
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=None, separators=(",", ":")), encoding="utf-8")
