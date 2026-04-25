"""
PostgreSQL writer for the Magtindsigt pipeline.

Reads DATABASE_URL from environment and upserts all processed data.
Run after preprocess.py builds the in-memory data structures.
"""

import json
import os
import sys
from typing import Any

import psycopg2
import psycopg2.extras
from tqdm import tqdm


def get_conn() -> psycopg2.extensions.connection:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL environment variable not set", file=sys.stderr)
        sys.exit(1)
    return psycopg2.connect(url)


def _execute_values(cur, sql: str, rows: list, page_size: int = 500) -> None:
    """Batch upsert helper."""
    psycopg2.extras.execute_values(cur, sql, rows, page_size=page_size)


# ── Members ───────────────────────────────────────────────────────────────────

def write_members(members: list[dict]) -> None:
    """Upsert all processed members."""
    rows = [
        (
            m["id"],
            m.get("navn"),
            m.get("fornavn"),
            m.get("efternavn"),
            m.get("partyShort"),
            m.get("partyColor"),
            m.get("partyOrder"),
            m.get("photo"),
            m.get("constituency"),
            m.get("profession"),
            m.get("url"),
            m.get("startdato"),
            m.get("slutdato"),
            m.get("isCurrentMF", False),
            m.get("fremmødePct"),
            m.get("afvigelsePct"),
            m.get("afstemningerTotal", 0),
            m.get("firstVoteDate"),
            m.get("lastVoteDate"),
            m.get("tags", []),
        )
        for m in members
    ]
    with get_conn() as conn, conn.cursor() as cur:
        _execute_values(
            cur,
            """
            INSERT INTO members (
              id, navn, fornavn, efternavn, party_short, party_color, party_order,
              photo, constituency, profession, url, startdato, slutdato,
              is_current_mf, fremmøde_pct, afvigelse_pct, afstemninger_total,
              first_vote_date, last_vote_date, tags
            ) VALUES %s
            ON CONFLICT (id) DO UPDATE SET
              navn            = EXCLUDED.navn,
              fornavn         = EXCLUDED.fornavn,
              efternavn       = EXCLUDED.efternavn,
              party_short     = EXCLUDED.party_short,
              party_color     = EXCLUDED.party_color,
              party_order     = EXCLUDED.party_order,
              photo           = EXCLUDED.photo,
              constituency    = EXCLUDED.constituency,
              profession      = EXCLUDED.profession,
              url             = EXCLUDED.url,
              startdato       = EXCLUDED.startdato,
              slutdato        = EXCLUDED.slutdato,
              is_current_mf   = EXCLUDED.is_current_mf,
              fremmøde_pct    = EXCLUDED.fremmøde_pct,
              afvigelse_pct   = EXCLUDED.afvigelse_pct,
              afstemninger_total = EXCLUDED.afstemninger_total,
              first_vote_date = EXCLUDED.first_vote_date,
              last_vote_date  = EXCLUDED.last_vote_date,
              tags            = EXCLUDED.tags
            """,
            rows,
        )
    print(f"  → {len(rows)} members upserted")


# ── Member profiles ───────────────────────────────────────────────────────────

def write_member_profiles(profiles: list[dict]) -> None:
    rows = [
        (
            p["id"],
            json.dumps(p.get("cv", {}), ensure_ascii=False),
            json.dumps(p.get("committees", []), ensure_ascii=False),
            json.dumps(p.get("caseRoles", []), ensure_ascii=False),
            json.dumps(p.get("recentMeetings", []), ensure_ascii=False),
        )
        for p in profiles
    ]
    with get_conn() as conn, conn.cursor() as cur:
        _execute_values(
            cur,
            """
            INSERT INTO member_profiles (id, cv, committees, case_roles, recent_meetings)
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET
              cv              = EXCLUDED.cv,
              committees      = EXCLUDED.committees,
              case_roles      = EXCLUDED.case_roles,
              recent_meetings = EXCLUDED.recent_meetings
            """,
            rows,
        )
    print(f"  → {len(rows)} member profiles upserted")


# ── Votes ─────────────────────────────────────────────────────────────────────

def write_votes(votes: list[dict]) -> None:
    """Upsert slim vote list (no stemmer)."""
    rows = [
        (
            v["id"],
            v.get("nummer"),
            v.get("vedtaget"),
            v.get("typeid"),
            v.get("type"),
            v.get("dato"),
            v.get("mødeid"),
            v.get("sagstrinid"),
            v.get("konklusion"),
            v.get("kommentar"),
            v.get("forCount", 0),
            v.get("imodCount", 0),
            v.get("fraværCount", 0),
            v.get("hverkenCount", 0),
            v.get("caseTitel"),
            v.get("caseNummer"),
            v.get("caseUrl"),
            v.get("topics") or [],
        )
        for v in tqdm(votes, desc="Upserting votes", ncols=80)
    ]
    with get_conn() as conn, conn.cursor() as cur:
        _execute_values(
            cur,
            """
            INSERT INTO votes (
              id, nummer, vedtaget, typeid, type, dato, møde_id, sagstrinid,
              konklusion, kommentar, for_count, imod_count, fravær_count,
              hverken_count, case_titel, case_nummer, case_url, topics
            ) VALUES %s
            ON CONFLICT (id) DO UPDATE SET
              nummer        = EXCLUDED.nummer,
              vedtaget      = EXCLUDED.vedtaget,
              typeid        = EXCLUDED.typeid,
              type          = EXCLUDED.type,
              dato          = EXCLUDED.dato,
              møde_id       = EXCLUDED.møde_id,
              sagstrinid    = EXCLUDED.sagstrinid,
              konklusion    = EXCLUDED.konklusion,
              kommentar     = EXCLUDED.kommentar,
              for_count     = EXCLUDED.for_count,
              imod_count    = EXCLUDED.imod_count,
              fravær_count  = EXCLUDED.fravær_count,
              hverken_count = EXCLUDED.hverken_count,
              case_titel    = EXCLUDED.case_titel,
              case_nummer   = EXCLUDED.case_nummer,
              case_url      = EXCLUDED.case_url,
              topics        = EXCLUDED.topics
            """,
            rows,
            page_size=200,
        )
    print(f"  → {len(rows)} votes upserted")


def write_enriched_votes(enriched: list[dict]) -> None:
    """Upsert recent votes with stemmer JSONB."""
    rows = [
        (
            v["id"],
            v.get("nummer"),
            v.get("vedtaget"),
            v.get("typeid"),
            v.get("type"),
            v.get("dato"),
            v.get("mødeid"),
            v.get("sagstrinid"),
            v.get("konklusion"),
            v.get("kommentar"),
            v.get("forCount", 0),
            v.get("imodCount", 0),
            v.get("fraværCount", 0),
            v.get("hverkenCount", 0),
            v.get("caseTitel"),
            v.get("caseNummer"),
            v.get("caseUrl"),
            json.dumps(v.get("stemmer", []), ensure_ascii=False),
        )
        for v in enriched
    ]
    with get_conn() as conn, conn.cursor() as cur:
        # Replace all enriched votes (it's always the recent N)
        cur.execute("TRUNCATE enriched_votes")
        _execute_values(
            cur,
            """
            INSERT INTO enriched_votes (
              id, nummer, vedtaget, typeid, type, dato, møde_id, sagstrinid,
              konklusion, kommentar, for_count, imod_count, fravær_count,
              hverken_count, case_titel, case_nummer, case_url, stemmer
            ) VALUES %s
            """,
            rows,
        )
    print(f"  → {len(rows)} enriched votes written")


# ── Member vote history ───────────────────────────────────────────────────────

def write_member_votes(member_votes: dict[int, list[dict]]) -> None:
    """Bulk upsert all per-member vote history rows."""
    rows = [
        (
            mid,
            v["id"],
            v["t"],
            v["d"],
            v["v"],
            v.get("ct"),
            v.get("cn"),
            v.get("nr"),
            v.get("dev", False),
        )
        for mid, vote_list in member_votes.items()
        for v in vote_list
    ]
    total = len(rows)

    # Upsert in batches
    BATCH = 10_000
    with get_conn() as conn, conn.cursor() as cur:
        for i in tqdm(range(0, total, BATCH), desc="Upserting member_votes", ncols=80):
            batch = rows[i : i + BATCH]
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO member_votes (
                  member_id, vote_id, typeid, dato, vedtaget,
                  case_titel, case_nummer, nummer, is_deviant
                ) VALUES %s
                ON CONFLICT (member_id, vote_id) DO UPDATE SET
                  typeid      = EXCLUDED.typeid,
                  dato        = EXCLUDED.dato,
                  vedtaget    = EXCLUDED.vedtaget,
                  case_titel  = EXCLUDED.case_titel,
                  case_nummer = EXCLUDED.case_nummer,
                  nummer      = EXCLUDED.nummer,
                  is_deviant  = EXCLUDED.is_deviant
                """,
                batch,
                page_size=500,
            )
    print(f"  → {total:,} member_vote rows upserted ({len(member_votes)} members)")


# ── Meetings ──────────────────────────────────────────────────────────────────

def write_meetings(meetings: list[dict], agenda_items: list[dict]) -> None:
    """Upsert meetings (with actors JSONB) and agenda_items."""
    meeting_rows = [
        (
            m["id"],
            m.get("titel"),
            m.get("dato"),
            m.get("typeid"),
            m.get("type"),
            m.get("committeeId"),
            m.get("committeeName"),
            m.get("committeeShort"),
            m.get("agendaCount", 0),
            json.dumps(m.get("actors", []), ensure_ascii=False),
        )
        for m in tqdm(meetings, desc="Upserting meetings", ncols=80)
    ]
    agenda_rows = [
        (
            a["id"],
            a.get("meeting_id") or a.get("mødeid"),
            a.get("nummer"),
            a.get("titel"),
            a.get("caseId"),
            a.get("caseTitel"),
            a.get("caseNummer"),
        )
        for a in agenda_items
    ]

    with get_conn() as conn, conn.cursor() as cur:
        _execute_values(
            cur,
            """
            INSERT INTO meetings (
              id, titel, dato, typeid, type, committee_id, committee_name,
              committee_short, agenda_count, actors
            ) VALUES %s
            ON CONFLICT (id) DO UPDATE SET
              titel           = EXCLUDED.titel,
              dato            = EXCLUDED.dato,
              typeid          = EXCLUDED.typeid,
              type            = EXCLUDED.type,
              committee_id    = EXCLUDED.committee_id,
              committee_name  = EXCLUDED.committee_name,
              committee_short = EXCLUDED.committee_short,
              agenda_count    = EXCLUDED.agenda_count,
              actors          = EXCLUDED.actors
            """,
            meeting_rows,
        )
        if agenda_rows:
            _execute_values(
                cur,
                """
                INSERT INTO agenda_items (
                  id, meeting_id, nummer, titel, case_id, case_titel, case_nummer
                ) VALUES %s
                ON CONFLICT (id) DO UPDATE SET
                  meeting_id  = EXCLUDED.meeting_id,
                  nummer      = EXCLUDED.nummer,
                  titel       = EXCLUDED.titel,
                  case_id     = EXCLUDED.case_id,
                  case_titel  = EXCLUDED.case_titel,
                  case_nummer = EXCLUDED.case_nummer
                """,
                agenda_rows,
            )
    print(f"  → {len(meeting_rows)} meetings, {len(agenda_rows)} agenda items upserted")
