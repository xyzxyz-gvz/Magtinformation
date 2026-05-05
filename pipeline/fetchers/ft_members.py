"""
Fetcher for Aktør (politicians, parties, ministries) and AktørAktør (relations).

Produces:
  public/data/members.json         — all actors with inline type
  public/data/actor_relations.json — actor↔actor relations (party membership etc.)
"""

import logging
from datetime import datetime
from pathlib import Path

from pipeline.fetchers._io import write_records
from pipeline.fetchers.base import ODataFetcher
from pipeline.transformers.normalize import normalize_records

logger = logging.getLogger(__name__)


def fetch_members(
    fetcher: ODataFetcher,
    out_dir: Path,
    since: datetime | None = None,
) -> None:
    """Fetch Aktør records and write members.json."""
    records = fetcher.fetch_all(
        endpoint="Aktør",
        expand="Aktørtype",
        since=since,
        desc="Aktører (members/parties)",
    )
    normalized = normalize_records(records)
    total = write_records(out_dir / "members.json", normalized, merge=since is not None)
    logger.info("members.json: %d new/updated, %d on disk", len(normalized), total)


def fetch_actor_relations(
    fetcher: ODataFetcher,
    out_dir: Path,
    since: datetime | None = None,
) -> None:
    """
    Fetch AktørAktør records — encodes party membership and other
    actor↔actor relationships (e.g. politician → party).
    Writes actor_relations.json.
    """
    records = fetcher.fetch_all(
        endpoint="AktørAktør",
        expand="AktørAktørRolle",
        since=since,
        desc="AktørAktør (actor relations)",
    )
    normalized = normalize_records(records)
    total = write_records(out_dir / "actor_relations.json", normalized, merge=since is not None)
    logger.info("actor_relations.json: %d new/updated, %d on disk", len(normalized), total)
