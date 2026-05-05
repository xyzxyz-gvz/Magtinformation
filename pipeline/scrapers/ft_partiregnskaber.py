"""Extract party finance data from Folketinget's annual partiregnskaber PDFs.

The PDFs at https://www.ft.dk/da/dokumenter/dokumentlister/partiregnskaber
are image-only (no text layer, custom font encoding), so we render each page
to a high-DPI PNG with PyMuPDF and run tesseract OCR (Danish). Per-page OCR
text is cached on disk so re-runs are cheap.

The OCR text is then parsed with regex against well-known schedule labels
(Resultatopgørelse, Balance, Noter til årsregnskabet) to extract structured
fields and the named-donor list.

Each PDF concatenates one independently-paginated annual report per party.
We split the PDF into per-party sections by detecting cover pages (short
pages bearing "Årsregnskab" / "Årsrapport" + a distinctive party phrase),
then run a fielded extractor over each section.

Inputs:
    pipeline/data/raw/partiregnskaber/Partiregnskaber{YEAR}.pdf

Outputs:
    pipeline/data/raw/partiregnskaber/{YEAR}_ocr/page_NNNN.txt   (cached)
    public/data/party_finances.json                              (final)
"""
from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "pipeline" / "data" / "raw" / "partiregnskaber"
OUT_FILE = ROOT / "public" / "data" / "party_finances.json"

OCR_DPI = 300
OCR_LANG = "dan"

# Distinctive phrases that uniquely identify each party. Phrases are matched
# in priority order — longest/most specific first — so "Radikale Venstre"
# wins over "Venstre" when both could match.
PARTY_PHRASES: list[tuple[str, str]] = [
    ("Radikale Venstres Landsforbund", "RV"),
    ("Radikale Venstre", "RV"),
    ("Det Konservative Folkeparti", "KF"),
    ("Konservative Folkeparti", "KF"),
    ("Konservative Folkepartis", "KF"),
    ("Venstres Landsorganisation", "V"),
    ("Venstre, Danmarks Liberale Parti", "V"),
    ("Socialistisk Folkeparti", "SF"),
    ("SF - Socialistisk", "SF"),
    ("Enhedslisten - De Rød-Grønne", "EL"),
    ("Enhedslisten – De Rød-Grønne", "EL"),
    ("Enhedslisten", "EL"),
    ("Socialdemokratiet", "S"),
    ("Socialdemokraterne", "S"),
    ("Liberal Alliance", "LA"),
    ("Dansk Folkeparti", "DF"),
    ("Moderaterne", "M"),
    ("Alternativet", "ALT"),
    ("Danmarksdemokraterne", "DD"),
    ("Nye Borgerlige", "NB"),
    ("Frie Grønne", "FG"),
    ("KristenDemokraterne", "KD"),
    ("Kristendemokraterne", "KD"),
    ("Veganerpartiet", "VG"),
]

# Extra phrases that ALSO indicate "Venstre" (not Radikale). Matched only
# after we've ruled out Radikale Venstre via earlier patterns.
VENSTRE_FALLBACK_PHRASE = "Venstre"  # last-resort, used carefully (see _match_party)


# Field labels are matched against OCR text where layouts differ between
# parties. We list multiple variants per field so the FIRST match wins.
# Order matters: most specific phrasings first to avoid the more-permissive
# fallbacks shadowing them.
INCOME_LABELS: list[tuple[str, list[str]]] = [
    (
        "offentligPartistotte",
        [r"offentlig\s+partistøtte", r"\bstatstilskud\b", r"\bpartistøtte\b(?!loven)"],
    ),
    (
        "medlemskontingenter",
        [r"medlemskontingenter", r"kontingentindtægter", r"\bkontingenter\b"],
    ),
    (
        "privatePersoner",
        [
            r"bidrag\s+fra\s+private\s+personer",
            r"private\s+personer",
            r"privatpersoner",
            r"private\s+bidrag(?!\s*\.)",
        ],
    ),
    (
        "organisationer",
        [
            r"faglige\s+organisationer[^\n]{0,80}fonde",
            r"faglige\s+organisationer,\s+virksomheder",
            r"faglige\s+organisationer",
            r"faglige\s+org\.",
            r"organisationer.{0,40}virksomheder.{0,40}fonde",
            r"øvrige\s+bidrag",
        ],
    ),
    ("anonymeTilskud", [r"anonyme\s+tilskud", r"anonyme\s+bidrag"]),
]

TOTAL_LABELS: list[tuple[str, list[str]]] = [
    (
        "indtaegterTotal",
        [r"primære\s+indtægter", r"indtægter\s+i\s+alt", r"^\s*indtægter\s*$"],
    ),
    (
        "udgifterTotal",
        [
            r"omkostninger\s+i\s+a?lt?",  # "i alt" / OCR "i sl"
            r"udgifter\s+i\s+alt",
            r"driftsomkostninger\s+inkl[.,]\s+valg",
            r"omkostninger,?\s+inkl[.,]?\s+valg",
        ],
    ),
    ("aaretsResultat", [r"årets\s+resultat", r"resultat\s+for\s+året"]),
    (
        "egenkapital",
        [
            r"egenkapital\s+i\s+alt",
            r"egenkapital\s+og\s+henlæggelser",
            r"egenkapital(?!\s+primo)",
        ],
    ),
]


# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------


def ensure_ocr(pdf_path: Path) -> list[str]:
    """Render+OCR every page of `pdf_path`, caching text per page on disk."""
    cache_dir = pdf_path.parent / f"{pdf_path.stem}_ocr"
    cache_dir.mkdir(exist_ok=True)
    doc = fitz.open(pdf_path)
    pages: list[str] = []
    for i in range(len(doc)):
        txt_path = cache_dir / f"page_{i + 1:04d}.txt"
        if txt_path.exists():
            pages.append(txt_path.read_text(encoding="utf-8"))
            continue
        png_path = cache_dir / f"page_{i + 1:04d}.png"
        if not png_path.exists():
            pix = doc[i].get_pixmap(matrix=fitz.Matrix(OCR_DPI / 72, OCR_DPI / 72))
            pix.save(png_path)
        out_base = txt_path.with_suffix("")
        subprocess.run(
            ["tesseract", str(png_path), str(out_base), "-l", OCR_LANG, "--psm", "6"],
            check=True,
            capture_output=True,
        )
        pages.append(txt_path.read_text(encoding="utf-8"))
        png_path.unlink(missing_ok=True)
    return pages


# ---------------------------------------------------------------------------
# Section detection
# ---------------------------------------------------------------------------


@dataclass
class Section:
    party_short: str
    party_phrase: str
    start: int  # page index, inclusive
    end: int  # page index, exclusive


COVER_KEYWORDS = re.compile(r"års(regnskab|rapport)", re.IGNORECASE)
COVER_MAX_LEN = 600  # cover pages are short — typically <300 chars


def find_party_sections(pages: list[str]) -> list[Section]:
    """Detect party section boundaries by scanning for cover pages.

    A cover page is short (<COVER_MAX_LEN chars), bears "Årsregnskab" or
    "Årsrapport", and contains a distinctive party phrase. We prefer the
    earliest cover for each party; subsequent matches in the same window
    are discarded as part of the same section.
    """
    starts: list[tuple[int, str, str]] = []  # (page_idx, party_short, phrase)
    for i, txt in enumerate(pages):
        if len(txt.strip()) > COVER_MAX_LEN:
            continue
        if not COVER_KEYWORDS.search(txt):
            continue
        match = _match_party(txt)
        if not match:
            # Some covers split party name onto previous/next page (e.g.,
            # "Radikale Venstres / Landsforbund" plus "Christiansborg / CVR
            # / Årsrapport 2024" on the next short page). Look at adjacent
            # pages too.
            window = "\n".join(pages[max(0, i - 1) : min(len(pages), i + 2)])
            match = _match_party(window)
        if not match:
            continue
        if starts and i - starts[-1][0] < 5:
            # Same section opened by an adjacent short page (toc, audit
            # cover, etc.) — skip.
            continue
        starts.append((i, match[0], match[1]))

    sections: list[Section] = []
    for idx, (start, short, phrase) in enumerate(starts):
        end = starts[idx + 1][0] if idx + 1 < len(starts) else len(pages)
        sections.append(Section(short, phrase, start, end))
    return sections


def _match_party(text: str) -> tuple[str, str] | None:
    """Return (short, phrase) for the most distinctive party match in `text`.

    Patterns are tried in priority order (longest/most specific first); the
    standalone "Venstre" fallback is only used after we've confirmed no
    Radikale-Venstre / Frie-Grønne / similar compound match.
    """
    for phrase, short in PARTY_PHRASES:
        if phrase.lower() in text.lower():
            return short, phrase
    # Fallback: standalone Venstre (V) — only if the word appears in a
    # context that doesn't look like a compound. We require the page also
    # mentions "Landsorganisation" or a CVR consistent with V's structure
    # to avoid false positives.
    if re.search(r"\bvenstre", text, re.IGNORECASE):
        if "landsorganisation" in text.lower() or "Liberale Parti" in text:
            return "V", VENSTRE_FALLBACK_PHRASE
    return None


# ---------------------------------------------------------------------------
# Number / field parsing
# ---------------------------------------------------------------------------

# A Danish-formatted number: either bare digits (≤9), or 1-3 digits then
# 1-3 groups of exactly 3 digits separated by a single thousands separator.
# Optional decimals follow. We require a word boundary AFTER the number so
# "360.000 200.000" doesn't get merged into "360.000200.000".
NUMBER_BODY = (
    r"(?:\d{1,3}(?:[.,\s]\d{3}){1,3}|\d{1,9})"
    r"(?:[.,]\d{1,2})?"
)
NUMBER_RE = re.compile(r"-?\(?\s*-?" + NUMBER_BODY + r"\s*\)?(?=$|\s|[^\d.,])")


def parse_amount(raw: str) -> int | None:
    s = raw.strip()
    if not s:
        return None
    neg = False
    if s.startswith("(") and s.endswith(")"):
        neg = True
        s = s[1:-1]
    s = s.strip()
    if s.startswith("-"):
        neg = True
        s = s[1:]
    s = re.sub(r"[.,\s]", "", s)
    if not s.isdigit():
        return None
    if len(s) > 10:
        return None  # OCR garbage
    value = int(s)
    return -value if neg else value


def find_value(text: str, label_patterns: Iterable[str]) -> int | None:
    """Return the first plausible numeric value following a label match.

    Labels live on the left of a row; the first value on the same row is
    the current-year amount (the second is typically the prior-year
    comparison column, which we ignore).
    """
    for pattern in label_patterns:
        rx = re.compile(
            r"(?P<lbl>" + pattern + r")[^\d\n-]{0,80}?(?P<num>" + NUMBER_BODY
            + r")(?=$|\s|[^\d.,])",
            re.IGNORECASE | re.MULTILINE,
        )
        m = rx.search(text)
        if m:
            v = parse_amount(m.group("num"))
            if v is not None:
                return v
    return None


def detect_unit_scale(section_text: str) -> int:
    """Return the divisor to convert raw OCR amounts to t.kr.

    Heuristic: collect every match of any income/total label; if the
    median magnitude is ≥ 100.000 (i.e. clearly past t.kr.-typical
    magnitudes), treat as raw kroner and divide by 1000. Otherwise
    values are already in t.kr.
    """
    anchors: list[int] = []
    for _, patterns in INCOME_LABELS + TOTAL_LABELS:
        for p in patterns:
            v = find_value(section_text, [p])
            if v is not None and abs(v) >= 1000:
                anchors.append(abs(v))
                break  # only one per field
    if not anchors:
        return 1
    anchors.sort()
    median = anchors[len(anchors) // 2]
    # T.kr. amounts for parliamentary parties are typically <100.000
    # (= 100 mio. kr.). Raw-kr amounts are typically ≥1.000.000.
    return 1000 if median >= 500_000 else 1


_NORMALIZE_DOUBLE_SEP = re.compile(r"[.,]\s*[.,]")


def normalize_ocr(text: str) -> str:
    """Clean common OCR artifacts in numeric sequences.

    The font in these PDFs sometimes produces sequences like "17.,410.202"
    or "1,200.660" where two thousands-separator characters appear in a
    row; collapse those to a single '.'.
    """
    return _NORMALIZE_DOUBLE_SEP.sub(".", text)


def parse_section_finances(section_text: str) -> dict[str, int | None]:
    section_text = normalize_ocr(section_text)
    scale = detect_unit_scale(section_text)
    out: dict[str, int | None] = {}
    for field_name, patterns in INCOME_LABELS + TOTAL_LABELS:
        v = find_value(section_text, patterns)
        out[field_name] = v // scale if v is not None else None
    if out.get("anonymeTilskud") is None:
        out["anonymeTilskud"] = 0

    out["andreIndtaegter"] = _compute_andre(section_text, scale, out)

    # Sanity guard: t.kr. amounts above ~500 mio. (500.000) are implausibly
    # large for any Danish party — clamp those to None rather than emit
    # garbage values that come from OCR mis-reads or label collisions.
    SANE_MAX = 500_000
    for k, v in list(out.items()):
        if v is not None and abs(v) > SANE_MAX:
            out[k] = None
    return out


def _compute_andre(text: str, scale: int, parsed: dict[str, int | None]) -> int | None:
    """Estimate the 'andre indtægter' bucket by subtracting the named lines
    from the Tilskud-section subtotal, if both can be found.

    The Tilskud-note includes lines like Partiskat, DIPD, EU-oplysning, and
    Andre indtægter. Rather than parse each individually (variable), we sum
    the subtotal − (offentlig partistøtte + private personer + organisationer).
    """
    subtotal_patterns = [
        r"tilskud,\s+partistøtte\s+og\s+andre\s+indtægter[\s\S]{0,3000}?\n[\s]{0,40}([0-9.,]{4,15})\b",
    ]
    # Try to find an explicit "Andre indtægter" line first.
    direct = find_value(text, [r"andre\s+indtægter\s*\(ikke\s+donationer\)", r"andre\s+indtægter"])
    if direct is not None:
        return direct // scale

    # Otherwise, fall back to subtotal minus known buckets.
    subtotal = None
    for p in subtotal_patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            subtotal = parse_amount(m.group(1))
            break
    if subtotal is None:
        return None
    known = sum(
        v for v in [
            parsed.get("offentligPartistotte"),
            parsed.get("privatePersoner"),
            parsed.get("organisationer"),
        ] if v is not None
    )
    residual = subtotal // scale - known
    return residual if residual >= 0 else None


# ---------------------------------------------------------------------------
# Donor parsing
# ---------------------------------------------------------------------------

# Headers seen in the various PDFs that introduce donor lists. Index-linked
# thresholds change between years (20.000 → 23.600 etc.), so we accept any
# variant of the wording.
DONOR_HEADERS = [
    r"navngivne\s+bidragydere",
    r"følgende\s+organisationer",
    r"følgende\s+foreninger",
    r"følgende\s+fonde",
    r"følgende\s+enkeltpersoner",
    r"følgende\s+personer",
    r"følgende\s+virksomheder",
    r"følgende\s+bidragydere",
    r"tilskud\s+over\s+20",
    r"bidragydere\s+over\s+\d",
]
DONOR_HEADER_RE = re.compile("|".join(DONOR_HEADERS), re.IGNORECASE)

# Stop the donor block at the next major heading.
DONOR_STOP_RE = re.compile(
    r"^\s*(noter?\b|note\s+\d|resultatopgørelse|balance|påtegning|"
    r"ledelsesberetning|anvendt\s+regnskabspraksis|års(regnskab|rapport)|"
    r"side\s*\d+|eventualforpligtelser|sikkerhedsstillelser|i\s+alt\b)",
    re.IGNORECASE | re.MULTILINE,
)

# Heuristics for inferring donor type from the entity name.
TYPE_KEYWORDS: list[tuple[str, list[str]]] = [
    ("union", [
        "3F", " HK ", "HK ", " FOA", "FOA ", "Dansk Metal", "Dansk El-Forbund",
        "Blik- og Rør", "Fødevareforbundet", "Serviceforbundet", "PROSA",
        "DJØF", "Forbundet", "Fagforening", " NNF", "Malerforbundet",
        "Socialpædagogerne", "BUPL", "DSR", "FH Hovedstaden", "FH ",
        "Dansk Sygeplejeråd", "3F'", "fagligt fælles forbund",
    ]),
    ("association", [
        "Dansk Erhverv", "Dansk Industri", "DI ", "Landbrug & Fødevarer",
        "Dansk Byggeri", "Bryggeriforeningen", "Dansk Mode", "Realkreditforeningen",
        "Forsikring & Pension", "Finans Danmark", "Erhvervsforum",
        "Danske Rederier", "Foreningen", "Forening ", "Danske Erhverv",
        "Boligselskabernes", "Kooperationen", "Danske Advokater",
    ]),
    ("fund", ["Fond", "Fonden", " Fond ", "-fonden"]),
    ("company", ["A/S", "ApS", " I/S", " P/S", "Group", "Holding"]),
]


def infer_donor_type(name: str) -> str:
    n = name
    nl = n.lower()
    for typ, keywords in TYPE_KEYWORDS:
        for kw in keywords:
            if kw.lower() in nl:
                return typ
    return "person"


# Lines that are clearly noise inside a donor block (headings, addresses,
# legal disclaimers, page numbers).
DONOR_LINE_REJECT = re.compile(
    r"(jf\.|i\s+alt|anonyme|note|cvr|christiansborg|københavn|"
    r"folketinget|telefon|tlf\.|side\s*\d|^\d|\.dk\b|"
    r"medlem\s+af|deloitte)",
    re.IGNORECASE,
)

# Address suffixes we want to strip off donor names like
# "HK Weidekampsgade 8 2390 København S" → "HK".
DONOR_ADDRESS_RE = re.compile(
    r"\s+(?:[A-ZÆØÅ][a-zæøå]+gade|[A-ZÆØÅ][a-zæøå]+vej|"
    r"[A-ZÆØÅ][a-zæøå]+plads|[A-ZÆØÅ]\.\s*[A-ZÆØÅ]|"
    r"\d{4}\s+[A-ZÆØÅ])",
)


DONOR_INTRO_LINE_RE = re.compile(
    r"(beløb|bidrag|stillet|opført|indbetalt|donationer|kr\.|partistøtteloven|"
    r"loven|jf\.|kandidater|hjemmeside|niveau|offentligg|under\s+\d|"
    r"bidragsyder|valgfond|for\s+god\s+ordens|bemærkes|"
    r"andre\s+private|\?\s|repræsentation|saldo|primo|følgende|"
    r"renteindtægt|renteomkostning|finansielle|værdipapir|"
    r"egenkapital|aktiver\b|passiver\b|"
    r"domicilejendom|sålgsum|grant\s+thornton|deloitte|pwc|kpmg|"
    r"ernst\s*&\s*young|ey\b|bdo|godkendt|revisionspartner|"
    r"medlem\s+af|sternational|landsorganisation|"
    r"folketingsgruppe|sekretariat\b|moderaterne|venstres|"
    r"socialdemokratiet|enhedslisten|konservative|alternativet|"
    r"^c/o\b|årsrapport|årsregnskab|side\s+\d)",
    re.IGNORECASE,
)

# Lines that look like pure address strings — start with a number, or the
# entire line is a Danish street/place name (no human-name pattern).
DONOR_ADDRESS_ONLY_RE = re.compile(
    r"^("
    r"\d|"
    r"[a-zæøåA-ZÆØÅ]+(?:gade|vej|plads|kanal|gård|allé|boulevard|park|torv)\b|"
    r"holmens\b|christians(?:borg|havn)|asiatisk|nicolai|"
    r"slots(?:holms|holm)|amalie|prins|stormgade|holbergs|"
    r"frederiksholms|haraldsgade"
    r")",
    re.IGNORECASE,
)


def parse_section_donors(section_text: str) -> list[dict[str, str]]:
    """Best-effort donor extraction.

    The donor block typically appears in Note 1 (Tilskud) preceded by a
    sentence like "Følgende organisationer / virksomheder har indbetalt et
    beløb større end X kr." Donor entries follow as either:
      - "Name Address Postcode City" rows (S-style)
      - "- Name, Address, Postcode City" bullet lines (V-style)
    We strip address noise, drop intro/legal sentences, and dedupe.
    """
    matches = list(DONOR_HEADER_RE.finditer(section_text))
    if not matches:
        return []
    donors: list[dict[str, str]] = []
    seen: set[str] = set()
    for m in matches:
        tail = section_text[m.end():]
        stop_m = DONOR_STOP_RE.search(tail)
        block = tail[: stop_m.start()] if stop_m else tail[:4000]
        for line in block.splitlines():
            s = line.strip(" \t.,-•·*£&")
            # Strip leading bullet artifacts.
            s = re.sub(r"^[\.\-•·\*\s]{1,4}", "", s)
            if len(s) < 3:
                continue
            if DONOR_LINE_REJECT.search(s):
                continue
            # Drop sentences (intro/legal noise around the actual list).
            if DONOR_INTRO_LINE_RE.search(s):
                continue
            # Cut at the first address marker. If there's a comma, prefer
            # the comma-delimited "Name, Address" split.
            if "," in s:
                cleaned = s.split(",", 1)[0]
            else:
                cleaned = DONOR_ADDRESS_RE.split(s, maxsplit=1)[0]
            cleaned = cleaned.strip(" \t.,-•·*&£")
            cleaned = re.sub(r"\s+[a-zA-Z]$", "", cleaned)
            if len(cleaned) < 3 or cleaned.lower() in seen:
                continue
            digit_ratio = sum(c.isdigit() for c in cleaned) / max(len(cleaned), 1)
            if digit_ratio > 0.25:
                continue
            # Likely full sentences:
            if len(cleaned.split()) > 8:
                continue
            # Address-only fragment (no human/org name).
            if DONOR_ADDRESS_ONLY_RE.match(cleaned):
                continue
            seen.add(cleaned.lower())
            donors.append({"name": cleaned, "type": infer_donor_type(cleaned)})
            if len(donors) > 200:
                return donors
    return donors


# ---------------------------------------------------------------------------
# Top-level driver
# ---------------------------------------------------------------------------


def process_pdf(pdf_path: Path) -> dict[str, dict[str, dict]]:
    year_match = re.search(r"(\d{4})", pdf_path.stem)
    if not year_match:
        raise ValueError(f"Cannot determine year from filename: {pdf_path.name}")
    year = year_match.group(1)
    print(f"[{year}] OCR …")
    pages = ensure_ocr(pdf_path)
    sections = find_party_sections(pages)
    print(f"[{year}] Found {len(sections)} party sections")
    out: dict[str, dict[str, dict]] = {}
    for s in sections:
        section_text = normalize_ocr("\n".join(pages[s.start : s.end]))
        finances = parse_section_finances(section_text)
        donors = parse_section_donors(section_text)
        record = dict(finances)
        record["donors"] = donors
        # If the same party section appears twice (rare — only seen for an
        # OCR-misdetected middle-of-section page), keep the longer/richer
        # one.
        existing = out.setdefault(s.party_short, {}).get(year)
        if existing and _record_score(existing) >= _record_score(record):
            continue
        out[s.party_short][year] = record
        print(
            f"[{year}] {s.party_short:>4}  pages {s.start + 1:>3}-{s.end:<3}  "
            f"indt={_fmt(record.get('indtaegterTotal'))}  "
            f"resultat={_fmt(record.get('aaretsResultat'))}  "
            f"egenk={_fmt(record.get('egenkapital'))}  "
            f"donors={len(donors)}"
        )
    return out


def _fmt(v: int | None) -> str:
    return "—".rjust(8) if v is None else f"{v:>8}"


def _record_score(rec: dict) -> int:
    """Rough completeness score so we keep the richer record on duplicates."""
    score = 0
    for k in (
        "offentligPartistotte", "medlemskontingenter", "privatePersoner",
        "organisationer", "andreIndtaegter", "indtaegterTotal",
        "udgifterTotal", "aaretsResultat", "egenkapital",
    ):
        if rec.get(k) is not None:
            score += 1
    score += min(len(rec.get("donors", [])), 20)
    return score


def merge_into(existing: dict, addition: dict[str, dict[str, dict]]) -> dict:
    for short, years in addition.items():
        bucket = existing.setdefault(short, {})
        for year, rec in years.items():
            bucket[year] = rec
    return existing


META = {
    "source": "Folketinget — De politiske partiers regnskaber (2019–2024)",
    "url": "https://www.ft.dk/da/dokumenter/dokumentlister/partiregnskaber",
    "currency": "DKK",
    "unit": "1000",
    "note": (
        "Alle tal er i tusinde kroner (t.kr.) som de står i de offentliggjorte "
        "regnskaber. Regnskaberne dækker partiets landsorganisation."
    ),
}


def main() -> None:
    if not RAW_DIR.exists():
        raise SystemExit(
            f"Missing input directory: {RAW_DIR}\n"
            f"Place Partiregnskaber{{YEAR}}.pdf files there and re-run."
        )
    pdfs = sorted(RAW_DIR.glob("Partiregnskaber*.pdf"))
    if not pdfs:
        raise SystemExit(f"No PDFs found in {RAW_DIR}")
    result: dict = {"_meta": META}
    for pdf in pdfs:
        merge_into(result, process_pdf(pdf))
    for short, years in result.items():
        if short == "_meta":
            continue
        result[short] = dict(sorted(years.items(), key=lambda kv: kv[0], reverse=True))
    OUT_FILE.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT_FILE}")


if __name__ == "__main__":
    main()
