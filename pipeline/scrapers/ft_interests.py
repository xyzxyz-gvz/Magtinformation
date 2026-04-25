"""
Extract economic interests and positions of trust (Tillidshverv & Interesseforbindelser)
from the ODA biografi XML already stored in members.json.

MFs are required by law to publicly declare:
  - Positions of trust: board memberships, chair positions, civic roles
  - Occupations: employment outside Parliament
  - Auditor roles

This data is available in ODA via the `biografi` XML field on the Aktør entity.
It is NOT necessary to scrape ft.dk separately — ODA is the authoritative source.

This module is called by preprocess.py and does NOT make any network requests.
"""

import html
import re
import xml.etree.ElementTree as ET
from typing import Any


def extract_interests(bio_xml: str | None) -> dict[str, list[str]]:
    """
    Parse Tillidshverv (positions of trust) and Interesseforbindelser from
    member biography XML.

    Returns a dict:
      {
        "positionsOfTrust":    ["Bestyrelsesmedlem, DR, 2020-.", ...],
        "occupations":         ["Advokat, Kromann Reumert, 2015-2019.", ...],
        "auditors":            ["Revisor, A/S Foo, 2018-.", ...],
        "parliamentaryPositions": ["Næstformand for S, 2015-2019.", ...],
      }
    """
    if not bio_xml:
        return {}
    try:
        root = ET.fromstring(bio_xml)
    except ET.ParseError:
        return {}

    def getall(tag: str) -> list[str]:
        texts = []
        for el in root.findall(f".//{tag}"):
            raw = el.text or ""
            # Decode HTML entities (biografi sometimes has &oslash; etc.)
            decoded = html.unescape(raw)
            # Strip inline HTML tags
            plain = re.sub(r"<[^>]+>", " ", decoded)
            plain = re.sub(r"\s+", " ", plain).strip()
            if plain and plain not in ("-", "–", "—"):
                texts.append(plain)
        return texts

    return {
        "positionsOfTrust":        getall("positionOfTrust"),
        "occupations":             getall("occupation"),
        "auditors":                getall("auditor"),
        "parliamentaryPositions":  getall("parliamentaryPositionOfTrust"),
    }
