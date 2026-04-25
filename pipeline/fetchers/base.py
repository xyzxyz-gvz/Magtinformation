"""
Base OData fetcher with pagination, retry logic, and tqdm progress tracking.

Folketinget OData API is v3. Key query params:
  $top=N         page size (default 100)
  $skip=N        offset for pagination
  $format=json   JSON response
  $expand=X      inline related entity
  $filter=...    filter expression
  $inlinecount=allpages   include total count in response

IMPORTANT: The `$` in OData param names must NOT be percent-encoded.
           requests.get(params=...) encodes `$` as `%24` which the API ignores.
           We build the query string manually via urllib.parse.urlencode with
           safe='$,()' to preserve OData-required characters.
"""

import json
import logging
import time
from datetime import datetime
from typing import Any, Iterator
from urllib.parse import urlencode

import requests
from tqdm import tqdm

from pipeline.config import BASE_URL, MAX_RETRIES, PAGE_SIZE, REQUEST_TIMEOUT, RETRY_BACKOFF

logger = logging.getLogger(__name__)


def _build_url(base: str, params: dict) -> str:
    """Build URL preserving `$` and other OData chars (not percent-encoded)."""
    qs = urlencode(params, safe="$,()' ")
    return f"{base}?{qs}"


class ODataFetcher:
    """Paginated OData v3 fetcher with exponential-backoff retry."""

    def __init__(self, session: requests.Session | None = None):
        self.session = session or requests.Session()
        self.session.headers.update({"Accept": "application/json"})

    # ------------------------------------------------------------------
    # Core request
    # ------------------------------------------------------------------

    def _get(self, url: str) -> dict:
        """Single GET (URL already fully formed) with retry on transient errors."""
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                resp = self.session.get(url, timeout=REQUEST_TIMEOUT)
                resp.raise_for_status()
                return resp.json()
            except (requests.RequestException, json.JSONDecodeError) as exc:
                if attempt == MAX_RETRIES:
                    raise
                wait = RETRY_BACKOFF ** attempt
                logger.warning(
                    "Attempt %d/%d failed (%s). Retrying in %.1fs…",
                    attempt, MAX_RETRIES, exc, wait,
                )
                time.sleep(wait)

    # ------------------------------------------------------------------
    # Pagination helpers
    # ------------------------------------------------------------------

    def _total_count(self, endpoint: str, base_params: dict) -> int | None:
        """
        Attempt to get total record count via $inlinecount=allpages.
        The API may not always return odata.count — returns None if unavailable.
        """
        probe = {**base_params, "$inlinecount": "allpages", "$top": 1, "$skip": 0}
        url = _build_url(f"{BASE_URL}/{endpoint}", probe)
        try:
            data = self._get(url)
        except Exception:
            return None
        raw = data.get("odata.count") or data.get("@odata.count")
        return int(raw) if raw is not None else None

    def _pages(self, endpoint: str, base_params: dict) -> Iterator[list[dict]]:
        """Yield pages of records, advancing $skip by PAGE_SIZE each time."""
        base_url = f"{BASE_URL}/{endpoint}"
        skip = 0
        while True:
            params = {**base_params, "$top": PAGE_SIZE, "$skip": skip}
            url = _build_url(base_url, params)
            data = self._get(url)
            records = data.get("value", [])
            if not records:
                break
            yield records
            if len(records) < PAGE_SIZE:
                break
            skip += PAGE_SIZE

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fetch_all(
        self,
        endpoint: str,
        expand: str | None = None,
        filter_expr: str | None = None,
        since: datetime | None = None,
        desc: str = "",
    ) -> list[dict]:
        """
        Fetch every record for an OData endpoint with tqdm progress bar.

        Args:
            endpoint:    OData entity name, e.g. "Afstemning"
            expand:      Comma-separated navigation properties to expand
            filter_expr: Raw $filter expression (overrides `since`)
            since:       Only fetch records updated after this datetime
            desc:        Human-readable label for the tqdm bar

        Returns:
            List of record dicts (raw from API, dates not yet normalised)
        """
        base_params: dict[str, Any] = {"$format": "json"}

        if expand:
            base_params["$expand"] = expand

        # Build filter
        filters = []
        if filter_expr:
            filters.append(filter_expr)
        elif since:
            ts = since.strftime("%Y-%m-%dT%H:%M:%S")
            filters.append(f"opdateringsdato gt datetime'{ts}'")
        if filters:
            base_params["$filter"] = " and ".join(filters)

        total = self._total_count(endpoint, base_params)
        label = desc or endpoint

        results: list[dict] = []
        with tqdm(total=total, desc=label, unit="rec", ncols=80) as pbar:
            for page in self._pages(endpoint, base_params):
                results.extend(page)
                pbar.update(len(page))

        logger.info("Fetched %d records from %s", len(results), endpoint)
        return results
