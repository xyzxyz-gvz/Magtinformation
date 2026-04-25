"""
Fetcher for Periode (parliamentary periods) and Emneord (topics/keywords).

Produces:
  public/data/periods.json — parliamentary periods
  public/data/topics.json  — topics with type
"""

import logging
from datetime import datetime
from pathlib import Path

from pipeline.fetchers.base import ODataFetcher
from pipeline.transformers.normalize import normalize_records

logger = logging.getLogger(__name__)


def fetch_periods(
    fetcher: ODataFetcher,
    out_dir: Path,
    since: datetime | None = None,
) -> None:
    """Fetch Periode records and write periods.json."""
    records = fetcher.fetch_all(
        endpoint="Periode",
        expand=None,
        since=since,
        desc="Perioder (parliamentary periods)",
    )
    normalized = normalize_records(records)
    _write(out_dir / "periods.json", normalized)
    logger.info("periods.json: %d records", len(normalized))


def fetch_topics(
    fetcher: ODataFetcher,
    out_dir: Path,
    since: datetime | None = None,
) -> None:
    """Fetch Emneord (topics/keywords) and write topics.json."""
    records = fetcher.fetch_all(
        endpoint="Emneord",
        expand="Emneordstype",
        since=since,
        desc="Emneord (topics)",
    )
    normalized = normalize_records(records)
    _write(out_dir / "topics.json", normalized)
    logger.info("topics.json: %d records", len(normalized))


def fetch_emneord_sag(
    fetcher: ODataFetcher,
    out_dir: Path,
    since: datetime | None = None,
) -> None:
    """Fetch EmneordSag (topic↔case links) and write emneord_sag.json.

    EmneordSag links Emneord (topics) to Sag (bills/cases).
    Used to tag votes with subject areas.
    """
    records = fetcher.fetch_all(
        endpoint="EmneordSag",
        expand=None,
        since=since,
        desc="EmneordSag (topic↔case links)",
    )
    normalized = normalize_records(records)
    _write(out_dir / "emneord_sag.json", normalized)
    logger.info("emneord_sag.json: %d records", len(normalized))


def _write(path: Path, data: list[dict]) -> None:
    import json
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=None, separators=(",", ":")), encoding="utf-8")
