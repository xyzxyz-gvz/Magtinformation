"""
Configuration for the Folketinget ODA API pipeline.
API: OData v3 — https://oda.ft.dk/api
"""

BASE_URL = "https://oda.ft.dk/api"

# Pages of 100 records per request (OData $top/$skip pagination)
PAGE_SIZE = 100

# Retry settings
MAX_RETRIES = 3
RETRY_BACKOFF = 2.0  # seconds, exponential

REQUEST_TIMEOUT = 30  # seconds

# OData entities to fetch, mapped to output filenames
# Each entry: (endpoint, output_file, description)
ENTITIES = {
    "votes": {
        "endpoint": "Afstemning",
        "output": "votes.json",
        "description": "Afstemninger (votes)",
        "expand": "Afstemningstype",
    },
    "stemmer": {
        "endpoint": "Stemme",
        "output": "stemmer.json",
        "description": "Stemmer (individual member votes)",
        "expand": "Stemmetype",
    },
    "members": {
        "endpoint": "Aktør",
        "output": "members.json",
        "description": "Aktører (politicians & organisations)",
        "expand": "Aktørtype",
    },
    "cases": {
        "endpoint": "Sag",
        "output": "cases.json",
        "description": "Sager (cases/bills)",
        "expand": "Sagstype,Sagsstatus,Sagskategori",
    },
    "case_steps": {
        "endpoint": "Sagstrin",
        "output": "case_steps.json",
        "description": "Sagstrin (bill stages)",
        "expand": "Sagstrintype,Sagstrinsstatus",
    },
    "meetings": {
        "endpoint": "Møde",
        "output": "meetings.json",
        "description": "Møder (plenary meetings)",
        "expand": "Mødetype,Mødestatus",
    },
    "agenda_items": {
        "endpoint": "Dagsordenspunkt",
        "output": "agenda_items.json",
        "description": "Dagsordenspunkter (agenda items)",
        "expand": None,
    },
    "periods": {
        "endpoint": "Periode",
        "output": "periods.json",
        "description": "Perioder (parliamentary periods)",
        "expand": None,
    },
    "topics": {
        "endpoint": "Emneord",
        "output": "topics.json",
        "description": "Emneord (topics/keywords)",
        "expand": "Emneordstype",
    },
    # Relation tables — link votes/cases to members
    "vote_case_actors": {
        "endpoint": "SagAktør",
        "output": "vote_case_actors.json",
        "description": "SagAktør (case↔actor relations)",
        "expand": "SagAktørRolle",
    },
    "vote_actors": {
        "endpoint": "AktørAktør",
        "output": "actor_relations.json",
        "description": "AktørAktør (actor↔actor relations, e.g. party membership)",
        "expand": "AktørAktørRolle",
    },
    "meeting_actors": {
        "endpoint": "MødeAktør",
        "output": "meeting_actors.json",
        "description": "MødeAktør (meeting attendance — who attended each meeting)",
        "expand": "Aktør",
    },
    "emneord_sag": {
        "endpoint": "EmneordSag",
        "output": "emneord_sag.json",
        "description": "EmneordSag (topic↔case links)",
        "expand": None,
    },
}

# Source groups for --source CLI flag
SOURCE_GROUPS = {
    "votes": ["votes", "stemmer"],
    "members": ["members", "vote_actors"],
    "cases": ["cases", "case_steps", "vote_case_actors"],
    "meetings": ["meetings", "agenda_items"],
    "meeting_actors": ["meeting_actors"],
    "periods": ["periods"],
    "topics": ["topics", "emneord_sag"],
    "all": list(ENTITIES.keys()),
}
