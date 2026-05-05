"""
Fetcher for Periode (parliamentary periods) and Emneord (topics/keywords).

Produces:
  public/data/periods.json — parliamentary periods
  public/data/topics.json  — topics with type
"""

import logging
from datetime import datetime
from pathlib import Path

from pipeline.fetchers._io import write_records
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
    total = write_records(out_dir / "periods.json", normalized, merge=since is not None)
    logger.info("periods.json: %d new/updated, %d on disk", len(normalized), total)


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
    total = write_records(out_dir / "topics.json", normalized, merge=since is not None)
    logger.info("topics.json: %d new/updated, %d on disk", len(normalized), total)


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
    total = write_records(out_dir / "emneord_sag.json", normalized, merge=since is not None)
    logger.info("emneord_sag.json: %d new/updated, %d on disk", len(normalized), total)
