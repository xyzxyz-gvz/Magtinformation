"""
Fetcher for Afstemning (votes) and Stemme (individual member votes).

Produces:
  public/data/votes.json   — all votes with inline vote-type
  public/data/stemmer.json — all individual stemmer linked by afstemningid
"""

import logging
from datetime import datetime
from pathlib import Path

from pipeline.fetchers.base import ODataFetcher
from pipeline.transformers.normalize import normalize_records

logger = logging.getLogger(__name__)


def fetch_votes(
    fetcher: ODataFetcher,
    out_dir: Path,
    since: datetime | None = None,
) -> None:
    """Fetch Afstemning records and write votes.json."""
    records = fetcher.fetch_all(
        endpoint="Afstemning",
        expand="Afstemningstype",
        since=since,
        desc="Afstemninger (votes)",
    )
    normalized = normalize_records(records)
    _write(out_dir / "votes.json", normalized)
    logger.info("votes.json: %d records", len(normalized))


def fetch_stemmer(
    fetcher: ODataFetcher,
    out_dir: Path,
    since: datetime | None = None,
) -> None:
    """Fetch Stemme records (individual member votes) and write stemmer.json."""
    records = fetcher.fetch_all(
        endpoint="Stemme",
        expand="Stemmetype",
        since=since,
        desc="Stemmer (member votes)",
    )
    normalized = normalize_records(records)
    _write(out_dir / "stemmer.json", normalized)
    logger.info("stemmer.json: %d records", len(normalized))


def _write(path: Path, data: list[dict]) -> None:
    import json
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=None, separators=(",", ":")), encoding="utf-8")
