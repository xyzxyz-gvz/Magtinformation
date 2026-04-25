#!/usr/bin/env python3
"""
Preprocessing script: transforms raw pipeline JSON into frontend-ready files.

Generates:
  public/data/parties.json           — party definitions with colors + hemicycle order
  public/data/members_processed.json — current 179 MFs with party, photo, constituency
  public/data/votes_enriched.json    — recent N votes with stemmer + case titles
  public/data/member_profiles.json   — enriched profiles: CV, committees, case roles,
                                        meeting co-attendees (for current MFs)

Run after fetch_all:
  python -m pipeline.preprocess
  python -m pipeline.preprocess --votes 300
"""

import argparse
import html as html_module
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

from tqdm import tqdm

from pipeline.scrapers.ft_interests import extract_interests

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "public" / "data"

# ---------------------------------------------------------------------------
# Party definitions (static — these won't change)
# left_order: hemicycle position, leftmost = 0
# ---------------------------------------------------------------------------
PARTY_DEFS = [
    # Brand colors and ballot letters (left → right in hemicycle)
    {"short": "EL",  "letter": "Ø", "navn": "Enhedslisten",                "color": "#B81E50", "left_order": 0},
    {"short": "SF",  "letter": "SF","navn": "SF – Socialistisk Folkeparti","color": "#E64949", "left_order": 1},
    {"short": "ALT", "letter": "Å", "navn": "Alternativet",                "color": "#2DAF59", "left_order": 2},
    {"short": "RV",  "letter": "B", "navn": "Radikale Venstre",            "color": "#E5358F", "left_order": 3},
    {"short": "S",   "letter": "A", "navn": "Socialdemokratiet",           "color": "#E3002D", "left_order": 4},
    {"short": "M",   "letter": "M", "navn": "Moderaterne",                 "color": "#4B215C", "left_order": 5},
    {"short": "V",   "letter": "V", "navn": "Venstre",                     "color": "#002F87", "left_order": 6},
    {"short": "KF",  "letter": "C", "navn": "Det Konservative Folkeparti", "color": "#003E2C", "left_order": 7},
    {"short": "DF",  "letter": "Ø", "navn": "Dansk Folkeparti",            "color": "#C8102E", "left_order": 8},
    {"short": "LA",  "letter": "I", "navn": "Liberal Alliance",            "color": "#181818", "left_order": 9},
    {"short": "DD",  "letter": "Æ", "navn": "Danmarksdemokraterne",        "color": "#15294C", "left_order": 10},
    {"short": "NB",  "letter": "D", "navn": "Nye Borgerlige",              "color": "#1C4F8C", "left_order": 11},
    {"short": "IA",  "letter": "IA","navn": "Inuit Ataqatigiit",           "color": "#006EB5", "left_order": 12},
    {"short": "BP",  "letter": "BP","navn": "Borgernes Parti",             "color": "#2872D4", "left_order": 13},
    {"short": "JF",  "letter": "JF","navn": "Javnaðarflokkurin",           "color": "#E07B00", "left_order": 14},
    {"short": "N",   "letter": "N", "navn": "Nationalisterne",             "color": "#1A1A1A", "left_order": 15},
    {"short": "SP",  "letter": "SP","navn": "Sambandsflokkurin",           "color": "#5C6B47", "left_order": 16},
    {"short": "UFG", "letter": "—", "navn": "Uden for grupper",            "color": "#888888", "left_order": 17},
]

PARTY_ORDER = {p["short"]: p["left_order"] for p in PARTY_DEFS}
PARTY_COLOR = {p["short"]: p["color"] for p in PARTY_DEFS}


def parse_biografi(bio_xml: str | None) -> dict:
    """Extract photo, party, constituency from member biography XML."""
    if not bio_xml:
        return {}
    try:
        root = ET.fromstring(bio_xml)
        def get(tag: str) -> str | None:
            el = root.find(tag)
            return el.text.strip() if el is not None and el.text else None

        constituency_raw = get("currentConstituency") or ""
        # "Folketingsmedlem for Enhedslisten i Københavns Omegns Storkreds fra 13. nov..."
        # Extract valgkreds
        match = re.search(r"\bi ([^.]+(?:storkreds|amtskreds|kredsen))", constituency_raw, re.IGNORECASE)
        constituency = match.group(1).strip().capitalize() if match else constituency_raw[:60] or None

        return {
            "partyShort": get("partyShortname"),
            "photo": get("pictureMiRes"),
            "constituency": constituency,
            "url": get("url"),
            "profession": get("profession"),
        }
    except ET.ParseError:
        return {}


def parse_biografi_full(bio_xml: str | None) -> dict:
    """
    Parse all enriched CV fields from member biography XML.

    Returns a comprehensive CV dict with education, career, interests.
    """
    if not bio_xml:
        return {}
    try:
        root = ET.fromstring(bio_xml)
    except ET.ParseError:
        return {}

    def get(tag: str) -> str | None:
        el = root.find(f".//{tag}")
        return el.text.strip() if el is not None and el.text else None

    def getall(tag: str) -> list[str]:
        texts = []
        for el in root.findall(f".//{tag}"):
            raw = el.text or ""
            decoded = html_module.unescape(raw)
            plain = re.sub(r"<[^>]+>", " ", decoded)
            plain = re.sub(r"\s+", " ", plain).strip()
            if plain and plain not in ("-", "–", "—"):
                texts.append(plain)
        return texts

    # Personal info (memberData is HTML-in-HTML-encoded text)
    personal_raw = get("memberData") or ""
    personal_info: str | None = None
    if personal_raw:
        decoded = html_module.unescape(personal_raw)
        stripped = re.sub(r"<[^>]+>", " ", decoded)
        personal_info = re.sub(r"\s+", " ", stripped).strip() or None

    # Social links — try both capitalisation variants
    def _find_first(*paths: str) -> str | None:
        for path in paths:
            el = root.find(path)
            if el is not None and el.text and el.text.strip():
                return el.text.strip()
        return None

    website = _find_first(".//Websites/WebsiteUrl/Url", ".//websites/websiteUrl/url")
    facebook = _find_first(".//FacebookProfiles/FacebookUrl/Url", ".//facebookProfiles/facebookUrl/url")
    twitter = _find_first(".//TwitterProfiles/TwitterUrl/Url", ".//twitterProfiles/twitterUrl/url")

    interests = extract_interests(bio_xml)

    return {
        "born": get("born"),
        "sex": get("sex"),
        "personalInfo": personal_info,
        "educations": getall("education"),
        "ministers": getall("minister"),
        "constituencies": getall("constituency"),
        "nominations": getall("nomination"),
        "positionsOfTrust": interests.get("positionsOfTrust", []),
        "occupations": interests.get("occupations", []),
        "auditors": interests.get("auditors", []),
        "parliamentaryPositions": interests.get("parliamentaryPositions", []),
        "website": website,
        "facebook": facebook,
        "twitter": twitter,
    }


# Committee/Nævn actor type IDs we care about
COMMITTEE_TYPEIDS = {3, 9, 11, 13}  # Udvalg, Kommission, Parlamentarisk forsamling, Tværpolitisk netværk

# Role importance for deduplication (lower = more important)
ROLE_IMPORTANCE: dict[str, int] = {
    "formand": 0,
    "1. næstformand": 1,
    "næstformand": 2,
    "2. næstformand": 3,
    "3. næstformand": 4,
    "4. næstformand": 5,
    "stedfortræder": 6,
    "Observatør": 7,
    "udvalgsassistent": 8,
    "udvalgsassistent2": 8,
    "udvalgssekretær": 8,
    "udvalgssekretær2": 8,
    "nævnssekretær": 8,
    "nævnsassistent": 8,
    "delegationssekretær": 8,
    "delegationsassistent": 8,
    "delegationsassistent2": 8,
    "Ministertitel": 9,
    "Minister": 9,
    "minister, ej MF": 9,
    "Tidligere minister": 9,
    "orlov med vederlag": 10,
    "orlov uden vederlag": 10,
    "medlem": 11,
}

# SagAktørRolle IDs that are personally attributable to the individual MF
PERSONAL_CASE_ROLES = {1, 2, 4, 5, 10, 15, 16, 19}  # Taler, Ordfører, Af, Medspørger, Spørger, Forespørger, Forslagsstiller


def _build_committee_memberships(
    member_id: int,
    actor_relations: list[dict],
    actor_map: dict[int, dict],
) -> list[dict]:
    """
    Build deduplicated committee/nævn memberships for one member.

    The ODA model creates a new Aktør record for each committee in each
    parliamentary period, so the same committee has multiple IDs over time.
    We deduplicate by (committee name, typeid) — keeping the earliest startdato,
    the most significant role, and marking isCurrent if ANY record is active.
    """
    rels_for_member = [r for r in actor_relations if r.get("fraaktørid") == member_id]

    # key = (normalized_navn, typeid) → aggregate info
    best: dict[tuple[str, int], dict] = {}

    for rel in rels_for_member:
        til_id = rel.get("tilaktørid")
        if til_id is None:
            continue
        actor = actor_map.get(til_id)
        if not actor:
            continue
        typeid = actor.get("typeid")
        if typeid not in COMMITTEE_TYPEIDS:
            continue

        navn = (actor.get("navn") or "").strip()
        if not navn:
            continue

        key = (navn.lower(), typeid)
        role_name = (rel.get("AktørAktørRolle") or {}).get("rolle") or "член"
        # Normalise internal typo
        if role_name == "член":
            role_name = "medlem"
        role_importance = ROLE_IMPORTANCE.get(role_name, 12)
        is_active = rel.get("slutdato") is None
        start = (rel.get("startdato") or "")[:10] or None
        short = actor.get("gruppenavnkort")
        type_name = (actor.get("Aktørtype") or {}).get("type") or ""

        existing = best.get(key)
        if existing is None:
            best[key] = {
                "navn": navn,
                "short": short,
                "typeid": typeid,
                "typeName": type_name,
                "role": role_name,
                "_role_importance": role_importance,
                "startdato": start,
                "isCurrent": is_active,
            }
            continue

        # Merge: isCurrent = any active record
        if is_active:
            existing["isCurrent"] = True

        # Keep earliest startdato
        if start and (existing["startdato"] is None or start < existing["startdato"]):
            existing["startdato"] = start

        # Keep most important role
        if role_importance < existing["_role_importance"]:
            existing["role"] = role_name
            existing["_role_importance"] = role_importance

        # Prefer the short name from most recent actor record
        if short and not existing["short"]:
            existing["short"] = short

    result = []
    for entry in best.values():
        result.append({
            "navn":      entry["navn"],
            "short":     entry["short"],
            "typeid":    entry["typeid"],
            "typeName":  entry["typeName"],
            "role":      entry["role"],
            "startdato": entry["startdato"],
            "isCurrent": entry["isCurrent"],
        })

    # Sort: current first, then by type (Udvalg first), then alphabetical
    type_order = {3: 0, 9: 1, 11: 2, 13: 3}
    result.sort(key=lambda c: (
        0 if c["isCurrent"] else 1,
        type_order.get(c["typeid"], 4),
        c["navn"],
    ))
    return result


def _build_case_roles(
    member_id: int,
    vote_case_actors: list[dict],
    case_map: dict[int, dict],
    limit: int = 50,
) -> list[dict]:
    """
    Build recent personally-attributed case roles for one member.

    Filters to relevant role types (Forslagsstiller, Spørger, etc.) and
    looks up case titles from the case map.
    """
    member_rels = [
        r for r in vote_case_actors
        if r.get("aktørid") == member_id and r.get("rolleid") in PERSONAL_CASE_ROLES
    ]

    # Sort newest first by opdateringsdato
    member_rels.sort(key=lambda r: r.get("opdateringsdato") or "", reverse=True)
    member_rels = member_rels[:limit]

    result = []
    seen_sag_ids: set[int] = set()
    for rel in member_rels:
        sag_id = rel.get("sagid")
        if sag_id is None or sag_id in seen_sag_ids:
            continue
        seen_sag_ids.add(sag_id)

        case = case_map.get(sag_id) or {}
        rolle_name = (rel.get("SagAktørRolle") or {}).get("rolle") or ""
        titel = case.get("titel") or case.get("titelkort")
        nummer = case.get("nummer") or (
            (case.get("nummerprefix") or "") +
            (case.get("nummernumerisk") or "") +
            (case.get("nummerpostfix") or "")
        ) or None

        result.append({
            "sagid": sag_id,
            "titel": titel,
            "nummer": nummer or None,
            "rolle": rolle_name,
            "dato": (rel.get("opdateringsdato") or "")[:10] or None,
        })

    return result


def _build_recent_meetings(
    member_id: int,
    meeting_actors: list[dict],
    meeting_map: dict[int, dict],
    actor_map: dict[int, dict],
    limit: int = 20,
) -> list[dict]:
    """
    Build recent committee meeting attendance with co-attendees.

    Only includes Udvalgsmøder (typeid=2). Returns meetings sorted newest-first.
    """
    if not meeting_actors:
        return []

    # Find meetings this member attended
    member_meeting_ids = [
        ma["mødeid"] for ma in meeting_actors
        if ma.get("aktørid") == member_id and ma.get("mødeid")
    ]

    # Filter to committee meetings and sort by date desc
    committee_meetings = []
    for mid in member_meeting_ids:
        m = meeting_map.get(mid)
        if m and m.get("typeid") == 2:  # Udvalgsmøde
            committee_meetings.append(m)

    committee_meetings.sort(key=lambda m: m.get("dato") or "", reverse=True)
    committee_meetings = committee_meetings[:limit]

    # Index meeting_actors by mødeid for fast lookup
    meeting_to_actors: dict[int, list[dict]] = defaultdict(list)
    for ma in meeting_actors:
        meeting_to_actors[ma["mødeid"]].append(ma)

    results = []
    for meeting in committee_meetings:
        mid = meeting["id"]
        attendees = []
        for ma in meeting_to_actors.get(mid, []):
            aid = ma.get("aktørid")
            if aid == member_id:
                continue
            actor = actor_map.get(aid)
            if not actor:
                # Inline Aktør from expand
                inline = ma.get("Aktør") or {}
                if inline:
                    actor = inline
                else:
                    continue

            actor_typeid = actor.get("typeid")
            actor_typename = (actor.get("Aktørtype") or {}).get("type") or ""
            actor_navn = actor.get("navn") or ""
            if not actor_navn:
                continue

            attendees.append({
                "id": aid,
                "navn": actor_navn,
                "typeid": actor_typeid,
                "typeName": actor_typename,
            })

        # Sort: persons last, organisations first (more interesting for external orgs)
        attendees.sort(key=lambda a: (0 if a["typeid"] in (10, 12, 9, 7) else 1, a["navn"]))

        # Determine which committee hosted this meeting (from meeting title or actor_map)
        committee_id = None
        committee_name = None
        title = meeting.get("titel") or ""
        # Titles like "Møde i FIU den ..." — try to extract committee short name
        abbr_match = re.search(r"\bi\s+([A-ZÆØÅ]{2,6})\b", title)
        if abbr_match:
            committee_short = abbr_match.group(1)
            # Find the committee with this short name from actor_map
            for actor in actor_map.values():
                if actor.get("typeid") == 3 and actor.get("gruppenavnkort") == committee_short:
                    committee_id = actor["id"]
                    committee_name = actor.get("navn")
                    break

        results.append({
            "id": mid,
            "titel": title or None,
            "dato": (meeting.get("dato") or "")[:10] or None,
            "committeeId": committee_id,
            "committeeName": committee_name,
            "attendees": attendees,
        })

    return results


def build_member_profiles(
    members: list[dict],
    actor_relations: list[dict],
    vote_case_actors: list[dict],
    case_map: dict[int, dict],
    meeting_actors: list[dict] | None,
    meeting_map: dict[int, dict] | None,
    current_mf_ids: set[int],
) -> list[dict]:
    """
    Build enriched member profiles for current MFs.

    Generates public/data/member_profiles.json with:
      - Full CV from biografi XML
      - Committee/Nævn memberships from actor_relations
      - Recent case roles (Forslagsstiller, Spørger, etc.)
      - Recent committee meeting attendance with co-attendees (if meeting_actors available)

    Only generates profiles for current MFs to keep file size manageable.
    """
    actor_map: dict[int, dict] = {m["id"]: m for m in members}

    profiles: list[dict] = []
    current_members = [m for m in members if m["id"] in current_mf_ids and m.get("typeid") == 5]

    for member in tqdm(current_members, desc="Building member profiles", ncols=80):
        mid = member["id"]
        bio = parse_biografi_full(member.get("biografi"))

        committees = _build_committee_memberships(mid, actor_relations, actor_map)
        case_roles = _build_case_roles(mid, vote_case_actors, case_map)
        recent_meetings = _build_recent_meetings(
            mid,
            meeting_actors or [],
            meeting_map or {},
            actor_map,
        )

        profiles.append({
            "id": mid,
            "cv": bio,
            "committees": committees,
            "caseRoles": case_roles,
            "recentMeetings": recent_meetings,
        })

    return profiles


def build_members(members: list[dict], actor_relations: list[dict]) -> tuple[list[dict], dict[int, dict]]:
    """
    Build processed member list with party info.
    Returns (processed_members, member_by_id).
    """
    members_by_id: dict[int, dict] = {m["id"]: m for m in members}
    parties_by_id: dict[int, dict] = {m["id"]: m for m in members if m.get("typeid") == 4}

    # For each person, find the most recent active party relation (rolleid=15)
    person_to_rel: dict[int, dict] = {}
    for rel in actor_relations:
        if rel["rolleid"] != 15:
            continue
        if rel["tilaktørid"] not in parties_by_id:
            continue
        pid = rel["fraaktørid"]
        existing = person_to_rel.get(pid)
        if existing is None:
            person_to_rel[pid] = rel
        else:
            # Prefer active (slutdato=None) over closed
            e_active = existing["slutdato"] is None
            r_active = rel["slutdato"] is None
            if r_active and not e_active:
                person_to_rel[pid] = rel
            elif r_active == e_active:
                # Both active or both closed — pick latest startdato
                if (rel.get("startdato") or "") > (existing.get("startdato") or ""):
                    person_to_rel[pid] = rel

    processed: list[dict] = []
    person_records = [m for m in members if m.get("typeid") == 5]

    for person in tqdm(person_records, desc="Processing members", ncols=80):
        rel = person_to_rel.get(person["id"])
        if rel is None:
            continue
        party_record = parties_by_id[rel["tilaktørid"]]
        party_short = party_record.get("gruppenavnkort") or "UFG"

        bio = parse_biografi(person.get("biografi"))
        # Prefer bio party short if available (it's more reliable for current status)
        effective_short = bio.get("partyShort") or party_short

        processed.append({
            "id": person["id"],
            "navn": person["navn"],
            "fornavn": person.get("fornavn"),
            "efternavn": person.get("efternavn"),
            "partyShort": effective_short,
            "partyColor": PARTY_COLOR.get(effective_short, "#999999"),
            "partyOrder": PARTY_ORDER.get(effective_short, 99),
            "photo": bio.get("photo"),
            "constituency": bio.get("constituency"),
            "profession": bio.get("profession"),
            "url": bio.get("url"),
            "startdato": rel.get("startdato"),
            "slutdato": rel.get("slutdato"),
            "opdateringsdato": person.get("opdateringsdato"),
            # isCurrentMF is set in a second pass after votes are known
            "isCurrentMF": False,
        })

    return processed, members_by_id


def build_member_vote_date_range(
    stemmer: list[dict],
    votes: list[dict],
) -> dict[int, tuple[str, str]]:
    """
    Derive the first and last vote dates per member from the full stemmer + votes data.
    Returns a dict mapping aktørid → (first_vote_date, last_vote_date) (YYYY-MM-DD).
    Used for accurate government-period overlap filtering in the frontend.
    """
    vote_date: dict[int, str] = {}
    for v in votes:
        date = (v.get("opdateringsdato") or "")[:10]
        if date:
            vote_date[v["id"]] = date

    member_first: dict[int, str] = {}
    member_last: dict[int, str] = {}
    for s in stemmer:
        mid = s.get("aktørid")
        vid = s.get("afstemningid")
        if not mid or not vid:
            continue
        date = vote_date.get(vid, "")
        if not date:
            continue
        if mid not in member_first or date < member_first[mid]:
            member_first[mid] = date
        if mid not in member_last or date > member_last[mid]:
            member_last[mid] = date

    return {mid: (member_first[mid], member_last[mid]) for mid in member_first}


def mark_current_mfs(
    processed_members: list[dict],
    enriched_votes: list[dict],
    recent_n: int = 20,
) -> None:
    """
    Mark members as isCurrentMF=True if they appear in the most recent votes.
    Also compute fremmødePct and afvigelsePct from the enriched votes.
    Modifies processed_members in place.
    """
    from collections import Counter

    # Collect all aktørids from the most recent recent_n votes
    current_ids: set[int] = set()
    for vote in enriched_votes[:recent_n]:
        for s in vote["stemmer"]:
            current_ids.add(s["aktørid"])

    # Build per-member vote counts from ALL enriched votes
    member_votes: dict[int, dict] = {}  # id → {present, fravær, deviant}

    for vote in enriched_votes:
        # Compute party majorities for deviant detection
        party_counts: dict[str, Counter] = {}
        member_map = {m["id"]: m for m in processed_members}
        for s in vote["stemmer"]:
            m = member_map.get(s["aktørid"])
            if not m or s["typeid"] == 3:  # skip absent
                continue
            p = m["partyShort"]
            party_counts.setdefault(p, Counter())
            party_counts[p][s["typeid"]] += 1

        party_majority: dict[str, int] = {}
        for p, counts in party_counts.items():
            party_majority[p] = counts.most_common(1)[0][0]

        for s in vote["stemmer"]:
            pid = s["aktørid"]
            m = member_map.get(pid)
            if not m:
                continue
            if pid not in member_votes:
                member_votes[pid] = {"present": 0, "fravær": 0, "deviant": 0}
            mv = member_votes[pid]
            if s["typeid"] == 3:
                mv["fravær"] += 1
            else:
                mv["present"] += 1
                maj = party_majority.get(m["partyShort"])
                if maj and s["typeid"] != maj:
                    mv["deviant"] += 1

    for m in processed_members:
        m["isCurrentMF"] = m["id"] in current_ids
        mv = member_votes.get(m["id"])
        if mv:
            total = mv["present"] + mv["fravær"]
            m["fremmødePct"] = round(mv["present"] / total * 100) if total else None
            m["afvigelsePct"] = round(mv["deviant"] / mv["present"] * 100) if mv["present"] else None
            m["afstemningerTotal"] = total
        else:
            m["fremmødePct"] = None
            m["afvigelsePct"] = None
            m["afstemningerTotal"] = 0


def build_votes_list(
    votes: list[dict],
    stemmer_by_vote: dict[int, list[dict]],
    cases_by_id: dict[int, dict],
    sagstrin_to_sagid: dict[int, int],
) -> list[dict]:
    """
    Build slim vote list (ALL votes, no per-member stemmer arrays) for the list page.

    Counts (for/imod/fravær/hverken) are computed from the shared stemmer index.
    Generates public/data/votes_list.json — fast to load, supports full search/filter.
    """
    sorted_votes = sorted(
        votes,
        key=lambda v: v.get("opdateringsdato") or "",
        reverse=True,
    )

    result = []
    for vote in tqdm(sorted_votes, desc="Building votes list", ncols=80):
        case_titel = None
        case_nummer = None
        case_url = None
        sagstrin_id = vote.get("sagstrinid")
        if sagstrin_id and sagstrin_to_sagid:
            sag_id = sagstrin_to_sagid.get(sagstrin_id)
            if sag_id:
                case = cases_by_id.get(sag_id)
                if case:
                    case_titel = case.get("titel") or case.get("titelkort")
                    case_nummer = case.get("nummer") or (
                        (case.get("nummerprefix") or "") +
                        (case.get("nummernumerisk") or "") +
                        (case.get("nummerpostfix") or "")
                    ) or None
                    ret_url = case.get("retsinformationsurl")
                    case_url = ret_url if ret_url else None

        # Count from stemmer index
        counts = {1: 0, 2: 0, 3: 0, 4: 0}
        for s in stemmer_by_vote.get(vote["id"], []):
            tid = s.get("typeid", 0)
            if tid in counts:
                counts[tid] += 1

        result.append({
            "id":          vote["id"],
            "nummer":      vote.get("nummer"),
            "vedtaget":    vote.get("vedtaget"),
            "typeid":      vote.get("typeid"),
            "type":        (vote.get("Afstemningstype") or {}).get("type"),
            "dato":        (vote.get("opdateringsdato") or "")[:10],
            "sagstrinid":  sagstrin_id,
            "konklusion":  vote.get("konklusion"),
            "kommentar":   vote.get("kommentar"),
            "forCount":    counts[1],
            "imodCount":   counts[2],
            "fraværCount": counts[3],
            "hverkenCount":counts[4],
            "caseTitel":   case_titel,
            "caseNummer":  case_nummer,
            "caseUrl":     case_url,
        })

    return result


def build_votes_enriched(
    votes: list[dict],
    stemmer: list[dict],
    cases: list[dict],
    case_steps: list[dict] | None,
    member_by_id: dict[int, dict],
    processed_members: list[dict],
    n_votes: int,
    _stemmer_by_vote: dict[int, list[dict]] | None = None,
    _cases_by_id: dict[int, dict] | None = None,
    _sagstrin_to_sagid: dict[int, int] | None = None,
) -> list[dict]:
    """Build enriched vote objects with stemmer, case titles, counts."""

    # Use pre-built indexes if provided (avoids duplicate work)
    cases_by_id: dict[int, dict] = _cases_by_id or {c["id"]: c for c in cases}

    sagstrin_to_sagid: dict[int, int] = _sagstrin_to_sagid or {}
    if not _sagstrin_to_sagid and case_steps:
        for cs in case_steps:
            sagstrin_to_sagid[cs["id"]] = cs.get("sagid") or cs.get("sag_id") or 0

    if _stemmer_by_vote is not None:
        stemmer_by_vote = _stemmer_by_vote
    else:
        print("Indexing stemmer…")
        stemmer_by_vote = defaultdict(list)
        for s in tqdm(stemmer, desc="Grouping stemmer", ncols=80):
            stemmer_by_vote[s["afstemningid"]].append(s)

    # Sort votes by date descending, take most recent n_votes
    sorted_votes = sorted(
        votes,
        key=lambda v: v.get("opdateringsdato") or "",
        reverse=True,
    )

    # Only keep votes that have stemmer
    enriched: list[dict] = []
    count = 0
    for vote in tqdm(sorted_votes, desc="Enriching votes", ncols=80):
        if count >= n_votes:
            break
        vote_stemmer = stemmer_by_vote.get(vote["id"])
        if not vote_stemmer:
            continue

        # Case lookup
        case_titel = None
        case_nummer = None
        case_url = None
        sagstrin_id = vote.get("sagstrinid")
        if sagstrin_id and sagstrin_to_sagid:
            sag_id = sagstrin_to_sagid.get(sagstrin_id)
            if sag_id:
                case = cases_by_id.get(sag_id)
                if case:
                    case_titel = case.get("titel") or case.get("titelkort")
                    case_nummer = case.get("nummer") or (
                        (case.get("nummerprefix") or "") +
                        (case.get("nummernumerisk") or "") +
                        (case.get("nummerpostfix") or "")
                    ) or None
                    ret_url = case.get("retsinformationsurl")
                    case_url = ret_url if ret_url else None

        # Stemme counts
        counts = {"For": 0, "Imod": 0, "Fravær": 0, "Hverken for eller imod": 0}
        stemmer_compact: list[dict] = []
        for s in vote_stemmer:
            vote_type = s["Stemmetype"]["type"] if s.get("Stemmetype") else "Fravær"
            counts[vote_type] = counts.get(vote_type, 0) + 1
            stemmer_compact.append({
                "aktørid": s["aktørid"],
                "typeid": s["typeid"],  # 1=For 2=Imod 3=Fravær 4=Hverken
            })

        enriched.append({
            "id": vote["id"],
            "nummer": vote.get("nummer"),
            "vedtaget": vote.get("vedtaget"),
            "typeid": vote.get("typeid"),
            "type": (vote.get("Afstemningstype") or {}).get("type"),
            "dato": (vote.get("opdateringsdato") or "")[:10],
            "mødeid": vote.get("mødeid"),
            "sagstrinid": sagstrin_id,
            "konklusion": vote.get("konklusion"),
            "kommentar": vote.get("kommentar"),
            "forCount": counts["For"],
            "imodCount": counts["Imod"],
            "fraværCount": counts.get("Fravær", 0),
            "hverkenCount": counts.get("Hverken for eller imod", 0),
            "caseTitel": case_titel,
            "caseNummer": case_nummer,
            "caseUrl": case_url,
            "stemmer": stemmer_compact,
        })
        count += 1

    return enriched


def build_member_tags(profiles: list[dict]) -> dict[int, list[str]]:
    """
    Derive topic tags for each MF from their CV profile data.
    Returns dict: member_id → sorted list of tag strings.
    Only produces tags for members that have a profile (current MFs).
    """
    result: dict[int, list[str]] = {}

    for p in profiles:
        mid = p["id"]
        cv = p.get("cv") or {}
        tags: set[str] = set()

        occupations = " ".join(cv.get("occupations") or []).lower()
        trust       = " ".join(cv.get("positionsOfTrust") or []).lower()
        ministers   = cv.get("ministers") or []
        educations  = " ".join(cv.get("educations") or []).lower()
        all_text    = occupations + " " + trust + " " + educations

        if ministers:
            tags.add("minister")

        if "borgmester" in trust:
            tags.add("borgmester")

        if any(kw in trust for kw in ["byråd", "kommunalbestyrelse", "amtsråd", "regionsråd"]):
            tags.add("kommunal")

        if any(kw in occupations for kw in ["journalist", "redaktør", "reporter", "korrespondent", "nyhedsvært"]):
            tags.add("journalist")

        if any(kw in occupations for kw in ["advokat", "juridisk rådgiver", "fuldmægtig i"]):
            tags.add("advokat")

        if any(kw in occupations for kw in ["læge", "overlæge", "sygeplejerske", "farmaceut", "tandlæge", "psykiater", "psykolog"]):
            tags.add("sundhed")

        if any(kw in all_text for kw in ["forsker", "lektor", "professor", "ph.d.", "postdoc", "videnskabelig assistent"]):
            tags.add("forsker")

        if any(kw in all_text for kw in ["fagforening", "fagforbund", "fagligt forbund", "3f", " lo ", " fh ", "co industri", " ac ", " ftf "]):
            tags.add("fagforening")

        if any(kw in occupations for kw in ["direktør", "administrerende", "ceo", "cfo", "selvstændig", "iværksætter", "indehaver"]):
            tags.add("erhvervsliv")

        if any(kw in all_text for kw in ["bank", "forsikring", "realkredit", "finansiel", "kapitalforvaltning", "investeringsfond", "pensionskasse"]):
            tags.add("finanssektor")

        if any(kw in all_text for kw in ["energiselskab", "dong", "ørsted", "vindmølle", "naturgas", "el-selskab", "vattenfall", "nrgi", "hofor", "energinet"]):
            tags.add("energi")

        if any(kw in all_text for kw in ["landmand", "fiskeri", "gårdejer", "bonde", "landbrug", "skovbrug", "gartneri"]):
            tags.add("landbrug")

        if any(kw in all_text for kw in ["tobak", "philip morris", "british american tobacco", "imperial tobacco", "jti"]):
            tags.add("tobak")

        if any(kw in all_text for kw in ["officer", "militær", "forsvaret", "hæren", "søværnet", "flyvevåbnet", "hjemmeværn"]):
            tags.add("militær")

        if any(kw in occupations for kw in ["software", " it-", " it ", "programmør", "systemudvikler", "datateknik"]):
            tags.add("it_tech")

        result[mid] = sorted(tags)

    return result


def build_meetings_processed(
    meetings: list[dict],
    agenda_items: list[dict],
    meeting_actors: list[dict],
    cases_by_id: dict[int, dict],
    sagstrin_to_sagid: dict[int, int],
) -> None:
    """
    Build:
      public/data/meetings_list.json   — slim list for the index/filter page
      public/data/meetings/{id}.json   — full detail per meeting (agenda + actors)
    """
    # Index agenda items by mødeid
    agenda_by_meeting: dict[int, list[dict]] = defaultdict(list)
    for item in agenda_items:
        mid = item.get("mødeid")
        if mid:
            agenda_by_meeting[mid].append(item)

    # Index meeting_actors by mødeid
    actors_by_meeting: dict[int, list[dict]] = defaultdict(list)
    for ma in meeting_actors:
        mid = ma.get("mødeid")
        if mid:
            actors_by_meeting[mid].append(ma)

    def primary_committee(meeting_id: int) -> dict:
        for ma in actors_by_meeting.get(meeting_id, []):
            a = ma.get("Aktør") or {}
            if a.get("typeid") == 3:  # Udvalg
                return {
                    "committeeId":    a.get("id"),
                    "committeeName":  a.get("navn"),
                    "committeeShort": a.get("gruppenavnkort"),
                }
        return {"committeeId": None, "committeeName": None, "committeeShort": None}

    out_dir = DATA_DIR / "meetings"
    out_dir.mkdir(exist_ok=True)
    meetings_list_out: list[dict] = []

    for m in tqdm(meetings, desc="Building meetings", ncols=80):
        mid    = m["id"]
        dato   = (m.get("dato") or "")[:10] or None
        typeid = m.get("typeid") or 0
        mtype  = (m.get("Mødetype") or {}).get("type")
        titel  = m.get("titel")
        comm   = primary_committee(mid)

        # Agenda items
        raw_items = sorted(
            agenda_by_meeting.get(mid, []),
            key=lambda x: (x.get("nummer") or "0").zfill(5),
        )
        agenda_out: list[dict] = []
        for it in raw_items:
            case_id = case_titel = case_nummer = None
            stid = it.get("sagstrinid")
            if stid:
                sid = sagstrin_to_sagid.get(stid)
                if sid:
                    case_id = sid
                    case = cases_by_id.get(sid)
                    if case:
                        case_titel  = case.get("titel") or case.get("titelkort")
                        case_nummer = (
                            case.get("nummer") or
                            ((case.get("nummerprefix") or "") +
                             (case.get("nummernumerisk") or "") +
                             (case.get("nummerpostfix") or "")) or None
                        )
            agenda_out.append({
                "id":          it["id"],
                "nummer":      it.get("nummer"),
                "titel":       it.get("titel"),
                "caseId":      case_id,
                "caseTitel":   case_titel,
                "caseNummer":  case_nummer,
            })

        # Actors
        actors_out: list[dict] = []
        for ma in actors_by_meeting.get(mid, []):
            a = ma.get("Aktør") or {}
            actors_out.append({
                "id":       a.get("id"),
                "navn":     a.get("navn"),
                "typeid":   a.get("typeid"),
            })

        meetings_list_out.append({
            "id":           mid,
            "titel":        titel,
            "dato":         dato,
            "typeid":       typeid,
            "type":         mtype,
            **comm,
            "agendaCount":  len(agenda_out),
        })

        (out_dir / f"{mid}.json").write_text(
            json.dumps({
                "id": mid, "titel": titel, "dato": dato,
                "typeid": typeid, "type": mtype,
                **comm,
                "agendaItems": agenda_out,
                "actors": actors_out,
            }, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    meetings_list_out.sort(key=lambda x: x.get("dato") or "", reverse=True)
    (DATA_DIR / "meetings_list.json").write_text(
        json.dumps(meetings_list_out, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    list_kb = (DATA_DIR / "meetings_list.json").stat().st_size // 1024
    print(f"  → {len(meetings_list_out)} meetings, {list_kb}KB list, {len(list(out_dir.glob('*.json')))} detail files")


def _build_member_votes_dict(
    stemmer_by_vote: dict[int, list[dict]],
    votes: list[dict],
    cases_by_id: dict[int, dict],
    sagstrin_to_sagid: dict[int, int],
    processed_members: list[dict],
) -> dict[int, list[dict]]:
    """Return per-member vote records as a dict (used by db_writer)."""
    party_map: dict[int, str] = {m["id"]: m["partyShort"] for m in processed_members}
    vote_meta: dict[int, dict] = {}
    for v in votes:
        case_titel = case_nummer = None
        sagstrin_id = v.get("sagstrinid")
        if sagstrin_id and sagstrin_to_sagid:
            sag_id = sagstrin_to_sagid.get(sagstrin_id)
            if sag_id:
                case = cases_by_id.get(sag_id)
                if case:
                    case_titel = case.get("titel") or case.get("titelkort")
                    case_nummer = (
                        case.get("nummer") or
                        ((case.get("nummerprefix") or "") +
                         (case.get("nummernumerisk") or "") +
                         (case.get("nummerpostfix") or "")) or None
                    )
        vote_meta[v["id"]] = {
            "d": (v.get("opdateringsdato") or "")[:10],
            "v": bool(v.get("vedtaget")),
            "ct": case_titel, "cn": case_nummer, "nr": v.get("nummer"),
        }

    vote_party_majority: dict[int, dict[str, int]] = {}
    for vid, stemmer_list in stemmer_by_vote.items():
        party_counts: dict[str, dict[int, int]] = {}
        for s in stemmer_list:
            mid = s.get("aktørid"); tid = s.get("typeid")
            if not mid or not tid or mid not in party_map or tid == 3:
                continue
            party = party_map[mid]
            if party not in party_counts:
                party_counts[party] = {}
            party_counts[party][tid] = party_counts[party].get(tid, 0) + 1
        majority: dict[str, int] = {}
        for party, counts in party_counts.items():
            majority[party] = max(counts, key=lambda k: counts[k])
        vote_party_majority[vid] = majority

    member_votes: dict[int, list[dict]] = {}
    for vid, stemmer_list in tqdm(stemmer_by_vote.items(), desc="Collecting member votes", ncols=80):
        meta = vote_meta.get(vid)
        if not meta or not meta["d"]:
            continue
        party_maj = vote_party_majority.get(vid, {})
        for s in stemmer_list:
            mid = s.get("aktørid"); tid = s.get("typeid")
            if not mid or not tid or mid not in party_map:
                continue
            party = party_map[mid]
            is_deviant = tid != 3 and party_maj.get(party) is not None and tid != party_maj[party]
            if mid not in member_votes:
                member_votes[mid] = []
            member_votes[mid].append({
                "id": vid, "t": tid, "d": meta["d"], "v": meta["v"],
                "ct": meta["ct"], "cn": meta["cn"], "nr": meta["nr"], "dev": is_deviant,
            })

    for vote_list in member_votes.values():
        vote_list.sort(key=lambda x: x["d"], reverse=True)
    return member_votes


def _build_meetings_data(
    meetings: list[dict],
    agenda_items: list[dict],
    meeting_actors: list[dict],
    cases_by_id: dict[int, dict],
    sagstrin_to_sagid: dict[int, int],
) -> tuple[list[dict], list[dict]]:
    """Return (meetings_processed, agenda_items_processed) for DB writing."""
    agenda_by_meeting: dict[int, list[dict]] = defaultdict(list)
    for item in agenda_items:
        mid = item.get("mødeid")
        if mid:
            agenda_by_meeting[mid].append(item)

    actors_by_meeting: dict[int, list[dict]] = defaultdict(list)
    for ma in meeting_actors:
        mid = ma.get("mødeid")
        if mid:
            actors_by_meeting[mid].append(ma)

    def primary_committee(meeting_id: int) -> dict:
        for ma in actors_by_meeting.get(meeting_id, []):
            a = ma.get("Aktør") or {}
            if a.get("typeid") == 3:
                return {"committeeId": a.get("id"), "committeeName": a.get("navn"), "committeeShort": a.get("gruppenavnkort")}
        return {"committeeId": None, "committeeName": None, "committeeShort": None}

    meetings_out: list[dict] = []
    agenda_out: list[dict] = []

    for m in tqdm(meetings, desc="Processing meetings", ncols=80):
        mid = m["id"]
        dato = (m.get("dato") or "")[:10] or None
        comm = primary_committee(mid)

        actors_list = [
            {"id": (ma.get("Aktør") or {}).get("id"), "navn": (ma.get("Aktør") or {}).get("navn"), "typeid": (ma.get("Aktør") or {}).get("typeid")}
            for ma in actors_by_meeting.get(mid, [])
        ]

        raw_items = sorted(agenda_by_meeting.get(mid, []), key=lambda x: (x.get("nummer") or "0").zfill(5))
        item_count = len(raw_items)

        meetings_out.append({
            "id": mid, "titel": m.get("titel"), "dato": dato,
            "typeid": m.get("typeid"), "type": (m.get("Mødetype") or {}).get("type"),
            "agendaCount": item_count, "actors": actors_list, **comm,
        })

        for it in raw_items:
            case_id = case_titel = case_nummer = None
            stid = it.get("sagstrinid")
            if stid:
                sid = sagstrin_to_sagid.get(stid)
                if sid:
                    case_id = sid
                    case = cases_by_id.get(sid)
                    if case:
                        case_titel = case.get("titel") or case.get("titelkort")
                        case_nummer = (case.get("nummer") or ((case.get("nummerprefix") or "") + (case.get("nummernumerisk") or "") + (case.get("nummerpostfix") or "")) or None)
            agenda_out.append({
                "id": it["id"], "meeting_id": mid, "nummer": it.get("nummer"),
                "titel": it.get("titel"), "caseId": case_id, "caseTitel": case_titel, "caseNummer": case_nummer,
            })

    return meetings_out, agenda_out


def build_cross_party_allies(
    stemmer_by_vote: dict[int, list[dict]],
    processed_members: list[dict],
    current_mf_ids: set[int],
    min_shared: int = 100,
    top_n: int = 10,
) -> dict[int, list[dict]]:
    """
    For each current MF, find the top N members from OTHER parties they
    agree with most often. Agreement = same vote among votes where both
    were present (typeid != 3 / Fravær). Pairs with fewer than min_shared
    co-presences are excluded.
    """
    member_party = {m["id"]: m["partyShort"] for m in processed_members}
    member_navn = {m["id"]: m["navn"] for m in processed_members}

    shared: dict[tuple[int, int], int] = defaultdict(int)
    same: dict[tuple[int, int], int] = defaultdict(int)

    for stemmer_list in tqdm(
        stemmer_by_vote.values(), desc="Pairwise agreement", ncols=80
    ):
        present: list[tuple[int, int]] = []
        for s in stemmer_list:
            mid = s.get("aktørid")
            tid = s.get("typeid")
            if mid in current_mf_ids and tid and tid != 3:
                present.append((mid, tid))
        n = len(present)
        for i in range(n):
            mid_a, t_a = present[i]
            for j in range(i + 1, n):
                mid_b, t_b = present[j]
                key = (mid_a, mid_b) if mid_a < mid_b else (mid_b, mid_a)
                shared[key] += 1
                if t_a == t_b:
                    same[key] += 1

    by_member: dict[int, list[dict]] = defaultdict(list)
    for (a, b), n_shared in shared.items():
        if n_shared < min_shared:
            continue
        party_a = member_party.get(a)
        party_b = member_party.get(b)
        if not party_a or not party_b or party_a == party_b:
            continue
        agreement = round(same[(a, b)] / n_shared, 4)
        by_member[a].append({
            "id": b, "navn": member_navn.get(b), "party": party_b,
            "agreement": agreement, "shared": n_shared,
        })
        by_member[b].append({
            "id": a, "navn": member_navn.get(a), "party": party_a,
            "agreement": agreement, "shared": n_shared,
        })

    result: dict[int, list[dict]] = {}
    for mid, allies in by_member.items():
        allies.sort(key=lambda x: x["agreement"], reverse=True)
        result[mid] = allies[:top_n]
    return result


def build_vote_party_majorities(
    stemmer_by_vote: dict[int, list[dict]],
    processed_members: list[dict],
) -> dict[int, dict[str, int]]:
    """
    Per vote, the majority typeid for each party. Skips Fravær (typeid 3);
    parties with a tie are omitted (no majority).
    """
    member_party = {m["id"]: m["partyShort"] for m in processed_members}
    result: dict[int, dict[str, int]] = {}

    for vid, stemmer_list in tqdm(
        stemmer_by_vote.items(), desc="Vote majorities", ncols=80
    ):
        counts: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
        for s in stemmer_list:
            mid = s.get("aktørid")
            tid = s.get("typeid")
            if not tid or tid == 3:
                continue
            party = member_party.get(mid)
            if party:
                counts[party][tid] += 1

        majorities: dict[str, int] = {}
        for party, tids in counts.items():
            ordered = sorted(tids.items(), key=lambda x: -x[1])
            if len(ordered) >= 2 and ordered[0][1] == ordered[1][1]:
                continue
            majorities[party] = ordered[0][0]

        result[vid] = majorities

    return result


def build_party_agreement_matrix(
    stemmer_by_vote: dict[int, list[dict]],
    processed_members: list[dict],
    party_defs: list[dict],
    min_shared: int = 50,
) -> dict:
    """
    Pairwise agreement between parties based on each party's majority vote
    per afstemning. Skips Fravær (typeid 3). Tied parties contribute nothing
    to that row.
    """
    member_party = {m["id"]: m["partyShort"] for m in processed_members}
    party_order = {p["short"]: p["left_order"] for p in party_defs}
    parties = sorted(
        {p["short"] for p in party_defs if p["short"] != "UFG"},
        key=lambda s: party_order.get(s, 99),
    )
    party_idx = {p: i for i, p in enumerate(parties)}
    n = len(parties)

    shared = [[0] * n for _ in range(n)]
    same = [[0] * n for _ in range(n)]

    for stemmer_list in tqdm(
        stemmer_by_vote.values(), desc="Party agreement", ncols=80
    ):
        counts: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
        for s in stemmer_list:
            mid = s.get("aktørid")
            tid = s.get("typeid")
            if not tid or tid == 3:
                continue
            party = member_party.get(mid)
            if party and party in party_idx:
                counts[party][tid] += 1

        majority: dict[str, int] = {}
        for party, tids in counts.items():
            ordered = sorted(tids.items(), key=lambda x: -x[1])
            if len(ordered) >= 2 and ordered[0][1] == ordered[1][1]:
                continue
            majority[party] = ordered[0][0]

        items = list(majority.items())
        for i in range(len(items)):
            pa, ta = items[i]
            ai = party_idx[pa]
            for j in range(i + 1, len(items)):
                pb, tb = items[j]
                bi = party_idx[pb]
                shared[ai][bi] += 1
                shared[bi][ai] += 1
                if ta == tb:
                    same[ai][bi] += 1
                    same[bi][ai] += 1

    matrix: list[list[float | None]] = [[None] * n for _ in range(n)]
    for i in range(n):
        matrix[i][i] = 1.0
        for j in range(n):
            if i == j:
                continue
            if shared[i][j] >= min_shared:
                matrix[i][j] = round(same[i][j] / shared[i][j], 4)

    return {
        "parties": parties,
        "matrix": matrix,
        "shared": shared,
    }


def build_member_vote_history(
    stemmer_by_vote: dict[int, list[dict]],
    votes: list[dict],
    cases_by_id: dict[int, dict],
    sagstrin_to_sagid: dict[int, int],
    processed_members: list[dict],
) -> None:
    """
    Generate per-member vote history files at public/data/member_votes/{id}.json.

    Each file is a compact list of every vote that member participated in:
      [{"id": <vote_id>, "t": <typeid>, "d": "YYYY-MM-DD",
        "v": <vedtaget>, "ct": <caseTitel|null>, "cn": <caseNummer|null>,
        "nr": <afstemning_nummer|null>, "dev": <isDeviant>}, …]

    isDeviant is pre-computed per vote so the frontend doesn't need stemmer data.
    """
    # party lookup: member_id → partyShort  (only members we know the party for)
    party_map: dict[int, str] = {m["id"]: m["partyShort"] for m in processed_members}

    # Case metadata per vote (reuse existing lookups)
    vote_meta: dict[int, dict] = {}
    for v in votes:
        case_titel = None
        case_nummer = None
        sagstrin_id = v.get("sagstrinid")
        if sagstrin_id and sagstrin_to_sagid:
            sag_id = sagstrin_to_sagid.get(sagstrin_id)
            if sag_id:
                case = cases_by_id.get(sag_id)
                if case:
                    case_titel = case.get("titel") or case.get("titelkort")
                    case_nummer = (
                        case.get("nummer") or
                        (
                            (case.get("nummerprefix") or "") +
                            (case.get("nummernumerisk") or "") +
                            (case.get("nummerpostfix") or "")
                        ) or None
                    )
        vote_meta[v["id"]] = {
            "d": (v.get("opdateringsdato") or "")[:10],
            "v": bool(v.get("vedtaget")),
            "ct": case_titel,
            "cn": case_nummer,
            "nr": v.get("nummer"),
        }

    # Per-vote party majorities (needed for isDeviant)
    # Iterate stemmer_by_vote once — O(total_stemmer)
    vote_party_majority: dict[int, dict[str, int]] = {}
    for vid, stemmer_list in stemmer_by_vote.items():
        party_counts: dict[str, dict[int, int]] = {}
        for s in stemmer_list:
            mid = s.get("aktørid")
            tid = s.get("typeid")
            if not mid or not tid or mid not in party_map or tid == 3:
                continue
            party = party_map[mid]
            if party not in party_counts:
                party_counts[party] = {}
            party_counts[party][tid] = party_counts[party].get(tid, 0) + 1
        majority: dict[str, int] = {}
        for party, counts in party_counts.items():
            majority[party] = max(counts, key=lambda k: counts[k])
        vote_party_majority[vid] = majority

    # Collect per-member vote records
    member_votes: dict[int, list[dict]] = {}
    for vid, stemmer_list in tqdm(
        stemmer_by_vote.items(), desc="Collecting member votes", ncols=80
    ):
        meta = vote_meta.get(vid)
        if not meta or not meta["d"]:
            continue
        party_maj = vote_party_majority.get(vid, {})
        for s in stemmer_list:
            mid = s.get("aktørid")
            tid = s.get("typeid")
            if not mid or not tid or mid not in party_map:
                continue
            party = party_map[mid]
            maj = party_maj.get(party)
            is_deviant = tid != 3 and maj is not None and tid != maj
            if mid not in member_votes:
                member_votes[mid] = []
            member_votes[mid].append({
                "id": vid,
                "t": tid,
                "d": meta["d"],
                "v": meta["v"],
                "ct": meta["ct"],
                "cn": meta["cn"],
                "nr": meta["nr"],
                "dev": is_deviant,
            })

    # Sort by date desc and write one file per member
    out_dir = DATA_DIR / "member_votes"
    out_dir.mkdir(exist_ok=True)
    for mid, vote_list in member_votes.items():
        vote_list.sort(key=lambda x: x["d"], reverse=True)
        (out_dir / f"{mid}.json").write_text(
            json.dumps(vote_list, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
    print(f"  → {len(member_votes)} member vote files written to member_votes/")


def main() -> None:
    parser = argparse.ArgumentParser(description="Preprocess pipeline data for frontend")
    parser.add_argument("--votes", type=int, default=2000, help="Number of recent enriched votes (for hemicycle)")
    args = parser.parse_args()

    # ── Load raw source files ─────────────────────────────────────────────────
    print("Loading raw data…")
    members        = json.loads((DATA_DIR / "members.json").read_text())
    actor_relations = json.loads((DATA_DIR / "actor_relations.json").read_text())
    votes          = json.loads((DATA_DIR / "votes.json").read_text())
    stemmer        = json.loads((DATA_DIR / "stemmer.json").read_text())
    cases          = json.loads((DATA_DIR / "cases.json").read_text())
    vote_case_actors = json.loads((DATA_DIR / "vote_case_actors.json").read_text())

    case_steps = None
    cs_path = DATA_DIR / "case_steps.json"
    if cs_path.exists():
        case_steps = json.loads(cs_path.read_text())
        print(f"case_steps.json: {len(case_steps)} records")
    else:
        print("case_steps.json not found — case titles will be skipped")

    # Topic data (optional — run --source topics to fetch)
    topics_raw: list[dict] = []
    emneord_sag_raw: list[dict] = []
    tp_path = DATA_DIR / "topics.json"
    es_path = DATA_DIR / "emneord_sag.json"
    if tp_path.exists() and es_path.exists():
        topics_raw = json.loads(tp_path.read_text())
        emneord_sag_raw = json.loads(es_path.read_text())
        print(f"topics.json: {len(topics_raw)} topics, emneord_sag.json: {len(emneord_sag_raw)} links")
    else:
        print("topics/emneord_sag not available — run: python -m pipeline.fetch_all --source topics")

    meeting_actors = None
    ma_path = DATA_DIR / "meeting_actors.json"
    if ma_path.exists():
        meeting_actors = json.loads(ma_path.read_text())
        print(f"meeting_actors.json: {len(meeting_actors)} records")
    else:
        print("meeting_actors.json not found — run: python -m pipeline.fetch_all --source meeting_actors")

    meetings_raw: list[dict] = []
    meetings: dict[int, dict] | None = None
    mt_path = DATA_DIR / "meetings.json"
    if mt_path.exists():
        meetings_raw = json.loads(mt_path.read_text())
        meetings = {m["id"]: m for m in meetings_raw}
        print(f"meetings.json: {len(meetings)} records")

    agenda_items_raw: list[dict] = []
    ai_path = DATA_DIR / "agenda_items.json"
    if ai_path.exists():
        agenda_items_raw = json.loads(ai_path.read_text())
        print(f"agenda_items.json: {len(agenda_items_raw)} records")

    # ── Static config files (parties, governments, meta stay as JSON) ─────────
    print("\nWriting parties.json…")
    (DATA_DIR / "parties.json").write_text(
        json.dumps(PARTY_DEFS, ensure_ascii=False, indent=2), encoding="utf-8",
    )

    # ── Build in-memory data structures ──────────────────────────────────────
    print("\nBuilding members…")
    processed_members, member_by_id = build_members(members, actor_relations)

    cases_by_id: dict[int, dict] = {c["id"]: c for c in cases}
    sagstrin_to_sagid: dict[int, int] = {}
    if case_steps:
        for cs in case_steps:
            sagstrin_to_sagid[cs["id"]] = cs.get("sagid") or cs.get("sag_id") or 0

    print("\nIndexing stemmer…")
    stemmer_by_vote: dict[int, list[dict]] = defaultdict(list)
    for s in tqdm(stemmer, desc="Grouping stemmer", ncols=80):
        stemmer_by_vote[s["afstemningid"]].append(s)

    # ── Build topic index: sagid → list[topic_string] ────────────────────────
    sagid_to_topics: dict[int, list[str]] = defaultdict(list)
    if topics_raw and emneord_sag_raw:
        print("\nBuilding topic index…")
        # Only meaningful subject-area types (1=Sagsområde, 3=Kontrolleret)
        topic_by_id = {
            t["id"]: t["emneord"]
            for t in topics_raw
            if t.get("typeid") in (1, 3) and t.get("emneord")
        }
        for link in tqdm(emneord_sag_raw, desc="Indexing EmneordSag", ncols=80):
            sagid = link.get("sagid")
            eid   = link.get("emneordid")
            label = topic_by_id.get(eid) if eid else None
            if sagid and label:
                lst = sagid_to_topics[sagid]
                if label not in lst:
                    lst.append(label)
        print(f"  → {len(sagid_to_topics)} cases with topics")

    print("\nBuilding votes list…")
    votes_list = build_votes_list(votes, stemmer_by_vote, cases_by_id, sagstrin_to_sagid)
    print(f"  → {len(votes_list)} votes")

    # Attach topics to votes_list entries
    if sagid_to_topics:
        tagged = 0
        for v in votes_list:
            stid = v.get("sagstrinid")
            sagid = sagstrin_to_sagid.get(stid) if stid else None
            topics_for_vote = sagid_to_topics.get(sagid, []) if sagid else []
            v["topics"] = topics_for_vote[:10]  # cap at 10 tags
            if topics_for_vote:
                tagged += 1
        print(f"  → {tagged}/{len(votes_list)} votes tagged with topics")

    print("\nBuilding enriched votes (hemicycle)…")
    enriched = build_votes_enriched(
        votes, stemmer, cases, case_steps, member_by_id, processed_members, args.votes,
        _stemmer_by_vote=stemmer_by_vote,
        _cases_by_id=cases_by_id,
        _sagstrin_to_sagid=sagstrin_to_sagid,
    )
    print(f"  → {len(enriched)} enriched votes")

    print("\nDeriving member vote date ranges…")
    member_vote_range = build_member_vote_date_range(stemmer, votes)
    print(f"  → {sum(1 for m in processed_members if m['id'] in member_vote_range)}/{len(processed_members)} members have vote dates")

    print("\nMarking current MFs…")
    mark_current_mfs(processed_members, enriched, recent_n=20)
    current_mf_ids = {m["id"] for m in processed_members if m["isCurrentMF"]}
    print(f"  → {len(current_mf_ids)} current MFs, {len(processed_members)} total")

    for m in processed_members:
        date_range = member_vote_range.get(m["id"])
        m["firstVoteDate"] = date_range[0] if date_range else None
        m["lastVoteDate"]  = date_range[1] if date_range else None

    print("\nBuilding member profiles…")
    profiles = build_member_profiles(
        members=members,
        actor_relations=actor_relations,
        vote_case_actors=vote_case_actors,
        case_map={c["id"]: c for c in cases},
        meeting_actors=meeting_actors,
        meeting_map=meetings,
        current_mf_ids=current_mf_ids,
    )
    print(f"  → {len(profiles)} profiles")

    print("\nBuilding member tags…")
    member_tags = build_member_tags(profiles)
    for m in processed_members:
        m["tags"] = member_tags.get(m["id"], [])
    print(f"  → {sum(1 for m in processed_members if m.get('tags'))} members tagged")

    print("\nBuilding vote-party majorities…")
    vote_majorities = build_vote_party_majorities(
        stemmer_by_vote=stemmer_by_vote,
        processed_members=processed_members,
    )
    (DATA_DIR / "vote_party_majorities.json").write_text(
        json.dumps({str(k): v for k, v in vote_majorities.items()},
                   ensure_ascii=False), encoding="utf-8",
    )
    print(f"  → vote_party_majorities.json ({len(vote_majorities):,} votes)")

    print("\nBuilding party agreement matrix…")
    party_agreement = build_party_agreement_matrix(
        stemmer_by_vote=stemmer_by_vote,
        processed_members=processed_members,
        party_defs=PARTY_DEFS,
    )
    (DATA_DIR / "party_agreement.json").write_text(
        json.dumps(party_agreement, ensure_ascii=False), encoding="utf-8",
    )
    print(f"  → {len(party_agreement['parties'])} parties")

    print("\nBuilding cross-party allies…")
    allies = build_cross_party_allies(
        stemmer_by_vote=stemmer_by_vote,
        processed_members=processed_members,
        current_mf_ids=current_mf_ids,
    )
    (DATA_DIR / "member_allies.json").write_text(
        json.dumps({str(k): v for k, v in allies.items()}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"  → {len(allies)} members have cross-party allies")

    # member_votes — write as JSON files (too large for free-tier DB)
    print("\nBuilding per-member vote history files…")
    build_member_vote_history(
        stemmer_by_vote=stemmer_by_vote,
        votes=votes,
        cases_by_id=cases_by_id,
        sagstrin_to_sagid=sagstrin_to_sagid,
        processed_members=processed_members,
    )

    # meetings processed list + agenda items with meeting_id field
    meetings_processed: list[dict] = []
    agenda_items_processed: list[dict] = []
    if meetings_raw:
        print("\nBuilding meetings data…")
        meetings_processed, agenda_items_processed = _build_meetings_data(
            meetings=meetings_raw,
            agenda_items=agenda_items_raw,
            meeting_actors=meeting_actors or [],
            cases_by_id=cases_by_id,
            sagstrin_to_sagid=sagstrin_to_sagid,
        )
        print(f"  → {len(meetings_processed)} meetings, {len(agenda_items_processed)} agenda items")

    # ── Write JSON files (read by the Next.js site) ──────────────────────────
    print("\nWriting JSON files…")

    (DATA_DIR / "members_processed.json").write_text(
        json.dumps(processed_members, ensure_ascii=False), encoding="utf-8",
    )
    print(f"  → members_processed.json ({len(processed_members)} members)")

    (DATA_DIR / "member_profiles.json").write_text(
        json.dumps(profiles, ensure_ascii=False), encoding="utf-8",
    )
    print(f"  → member_profiles.json ({len(profiles)} profiles)")

    (DATA_DIR / "votes_list.json").write_text(
        json.dumps(votes_list, ensure_ascii=False), encoding="utf-8",
    )
    print(f"  → votes_list.json ({len(votes_list)} votes)")

    (DATA_DIR / "votes_enriched.json").write_text(
        json.dumps(enriched, ensure_ascii=False), encoding="utf-8",
    )
    print(f"  → votes_enriched.json ({len(enriched)} enriched votes)")

    if meetings_processed:
        (DATA_DIR / "meetings_list.json").write_text(
            json.dumps(meetings_processed, ensure_ascii=False), encoding="utf-8",
        )
        print(f"  → meetings_list.json ({len(meetings_processed)} meetings)")

    # ── Write to PostgreSQL (optional — skip if DATABASE_URL not set) ─────────
    if not os.environ.get("DATABASE_URL"):
        print("\nDATABASE_URL not set — skipping Postgres writes.")
        print("Preprocessing complete.")
        return

    from pipeline import db_writer

    print("\nWriting to database…")

    print("  members →")
    db_writer.write_members(processed_members)

    print("  member_profiles →")
    db_writer.write_member_profiles(profiles)

    print("  votes →")
    db_writer.write_votes(votes_list)

    print("  enriched_votes →")
    db_writer.write_enriched_votes(enriched)

    if meetings_processed:
        print("  meetings + agenda_items →")
        db_writer.write_meetings(meetings_processed, agenda_items_processed)

    print("\nPreprocessing complete.")


if __name__ == "__main__":
    main()
