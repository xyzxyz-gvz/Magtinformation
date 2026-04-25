"""
Fetcher for Sag (cases/bills), Sagstrin (bill stages), and SagAktør (case↔actor).

Produces:
  public/data/cases.json           — all cases with type, status, category
  public/data/case_steps.json      — bill stages with type and status
  public/data/vote_case_actors.json — case↔actor relations (who proposed what)
"""

import logging
from datetime import datetime
from pathlib import Path

from pipeline.fetchers.base import ODataFetcher
from pipeline.transformers.normalize import normalize_records

logger = logging.getLogger(__name__)


def fetch_cases(
    fetcher: ODataFetcher,
    out_dir: Path,
    since: datetime | None = None,
) -> None:
    """Fetch Sag records and write cases.json."""
    records = fetcher.fetch_all(
        endpoint="Sag",
        expand="Sagstype,Sagsstatus,Sagskategori",
        since=since,
        desc="Sager (cases/bills)",
    )
    normalized = normalize_records(records)
    _write(out_dir / "cases.json", normalized)
    logger.info("cases.json: %d records", len(normalized))


def fetch_case_steps(
    fetcher: ODataFetcher,
    out_dir: Path,
    since: datetime | None = None,
) -> None:
    """Fetch Sagstrin (bill stages) and write case_steps.json."""
    # Note: Sagstrin does not support $expand — typeid/statusid are inline fields
    records = fetcher.fetch_all(
        endpoint="Sagstrin",
        expand=None,
        since=since,
        desc="Sagstrin (bill stages)",
    )
    normalized = normalize_records(records)
    _write(out_dir / "case_steps.json", normalized)
    logger.info("case_steps.json: %d records", len(normalized))


def fetch_case_actors(
    fetcher: ODataFetcher,
    out_dir: Path,
    since: datetime | None = None,
) -> None:
    """Fetch SagAktør (case↔actor relations) and write vote_case_actors.json."""
    records = fetcher.fetch_all(
        endpoint="SagAktør",
        expand="SagAktørRolle",
        since=since,
        desc="SagAktør (case↔actor)",
    )
    normalized = normalize_records(records)
    _write(out_dir / "vote_case_actors.json", normalized)
    logger.info("vote_case_actors.json: %d records", len(normalized))


def _write(path: Path, data: list[dict]) -> None:
    import json
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=None, separators=(",", ":")), encoding="utf-8")
