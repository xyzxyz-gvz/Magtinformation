#!/usr/bin/env python3
"""
Main pipeline orchestrator — fetches data from Folketingets ODA API.

Usage:
  python -m pipeline.fetch_all                    # fetch everything
  python -m pipeline.fetch_all --source votes     # votes + stemmer only
  python -m pipeline.fetch_all --source members   # politicians + relations
  python -m pipeline.fetch_all --source cases     # bills + stages + actors
  python -m pipeline.fetch_all --source meetings  # meetings + agenda
  python -m pipeline.fetch_all --source periods   # parliamentary periods
  python -m pipeline.fetch_all --source topics    # emneord / keywords
  python -m pipeline.fetch_all --since 2024-01-01 # incremental update

Output: public/data/*.json  (committed to repo as static data)
Logs:   pipeline/logs/YYYY-MM-DD_HH-MM-SS.log
"""

import argparse
import json
import logging
import sys
from datetime import datetime, UTC
from pathlib import Path

import requests

# Resolve project root so imports work when run as `python -m pipeline.fetch_all`
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "public" / "data"
LOGS_DIR = PROJECT_ROOT / "pipeline" / "logs"

from pipeline.config import SOURCE_GROUPS
from pipeline.fetchers.base import ODataFetcher
from pipeline.fetchers.ft_votes import fetch_votes, fetch_stemmer
from pipeline.fetchers.ft_members import fetch_members, fetch_actor_relations
from pipeline.fetchers.ft_cases import fetch_cases, fetch_case_steps, fetch_case_actors
from pipeline.fetchers.ft_meetings import fetch_meetings, fetch_agenda_items
from pipeline.fetchers.ft_periods import fetch_periods, fetch_topics, fetch_emneord_sag
from pipeline.fetchers.ft_meeting_actors import fetch_meeting_actors


# Map source-group key → list of (function, kwargs) to call
def _build_task_map(fetcher: ODataFetcher, out_dir: Path, since: datetime | None) -> dict:
    kw = {"fetcher": fetcher, "out_dir": out_dir, "since": since}
    return {
        "votes":            lambda: fetch_votes(**kw),
        "stemmer":          lambda: fetch_stemmer(**kw),
        "members":          lambda: fetch_members(**kw),
        "vote_actors":      lambda: fetch_actor_relations(**kw),
        "cases":            lambda: fetch_cases(**kw),
        "case_steps":       lambda: fetch_case_steps(**kw),
        "vote_case_actors": lambda: fetch_case_actors(**kw),
        "meetings":         lambda: fetch_meetings(**kw),
        "agenda_items":     lambda: fetch_agenda_items(**kw),
        "meeting_actors":   lambda: fetch_meeting_actors(**kw),
        "periods":          lambda: fetch_periods(**kw),
        "topics":           lambda: fetch_topics(**kw),
        "emneord_sag":      lambda: fetch_emneord_sag(**kw),
    }


def _setup_logging() -> logging.Logger:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    log_file = LOGS_DIR / f"{ts}.log"

    fmt = "%(asctime)s %(levelname)-8s %(name)s — %(message)s"
    logging.basicConfig(
        level=logging.INFO,
        format=fmt,
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )
    return logging.getLogger("pipeline")


def _write_meta(out_dir: Path, sources: list[str]) -> None:
    meta = {
        "updated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sources": sources,
    }
    (out_dir / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Folketinget ODA data")
    parser.add_argument(
        "--source",
        default="all",
        choices=list(SOURCE_GROUPS.keys()),
        help="Which data group to fetch (default: all)",
    )
    parser.add_argument(
        "--since",
        metavar="YYYY-MM-DD",
        help="Only fetch records updated after this date (incremental)",
    )
    parser.add_argument(
        "--out-dir",
        default=str(DATA_DIR),
        help=f"Output directory (default: {DATA_DIR})",
    )
    args = parser.parse_args()

    log = _setup_logging()

    # Parse --since
    since: datetime | None = None
    if args.since:
        since = datetime.fromisoformat(args.since)
        log.info("Incremental mode: fetching records updated after %s", since.date())

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    fetcher = ODataFetcher(session=session)

    task_keys = SOURCE_GROUPS[args.source]
    task_map = _build_task_map(fetcher, out_dir, since)

    log.info("Pipeline start — source=%s, tasks=%s", args.source, task_keys)

    failed = []
    for key in task_keys:
        task_fn = task_map.get(key)
        if task_fn is None:
            log.warning("No task defined for key '%s', skipping", key)
            continue
        log.info("--- %s ---", key)
        try:
            task_fn()
        except Exception as exc:
            log.error("FAILED %s: %s", key, exc, exc_info=True)
            failed.append(key)

    _write_meta(out_dir, task_keys)

    if failed:
        log.error("Pipeline finished with errors in: %s", failed)
        log.info("Retry failed tasks with: python -m pipeline.fetch_all --source <name>")
        sys.exit(1)
    else:
        log.info("Pipeline complete. Data written to %s", out_dir)


if __name__ == "__main__":
    main()
