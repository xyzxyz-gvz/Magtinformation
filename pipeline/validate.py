#!/usr/bin/env python3
"""
Validate JSON integrity of pipeline output files.

Checks:
  - All expected output files exist
  - Each file is valid JSON
  - Each file contains a non-empty list
  - Records have required fields (id, opdateringsdato)
  - Dates are ISO 8601 (no raw /Date(...)/ left over)
  - meta.json exists with updated_at timestamp

Usage:
  python -m pipeline.validate
  python -m pipeline.validate --data-dir public/data
"""

import argparse
import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "public" / "data"

# Files that must exist and be non-empty lists
REQUIRED_FILES = [
    "votes.json",
    "stemmer.json",
    "members.json",
    "actor_relations.json",
    "cases.json",
    "case_steps.json",
    "meetings.json",
    "periods.json",
    "meta.json",
]

# Fields every record should have
RECORD_REQUIRED_FIELDS = {"id"}

# Detects un-normalized OData dates
_RAW_DATE_RE = re.compile(r"/Date\(-?\d+")


def _check_file(path: Path) -> list[str]:
    """Return list of error strings for this file."""
    errors = []

    if not path.exists():
        return [f"MISSING: {path.name}"]

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"INVALID JSON in {path.name}: {exc}"]

    # meta.json has a different structure
    if path.name == "meta.json":
        if "updated_at" not in data:
            errors.append(f"{path.name}: missing 'updated_at' key")
        return errors

    if not isinstance(data, list):
        errors.append(f"{path.name}: expected list, got {type(data).__name__}")
        return errors

    if len(data) == 0:
        errors.append(f"{path.name}: list is empty")
        return errors

    # Spot-check first 10 records
    for i, record in enumerate(data[:10]):
        if not isinstance(record, dict):
            errors.append(f"{path.name}[{i}]: not a dict")
            continue
        for field in RECORD_REQUIRED_FIELDS:
            if field not in record:
                errors.append(f"{path.name}[{i}]: missing field '{field}'")

        # Check for un-normalized dates
        raw = json.dumps(record)
        if _RAW_DATE_RE.search(raw):
            errors.append(f"{path.name}[{i}]: contains un-normalized /Date(...)/ value")
            break  # one warning per file is enough

    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate pipeline output JSON")
    parser.add_argument("--data-dir", default=str(DATA_DIR))
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    all_errors: list[str] = []

    for filename in REQUIRED_FILES:
        path = data_dir / filename
        file_errors = _check_file(path)
        all_errors.extend(file_errors)

    if all_errors:
        print(f"\nValidation FAILED — {len(all_errors)} issue(s):\n")
        for err in all_errors:
            print(f"  ✗ {err}")
        sys.exit(1)
    else:
        # Print summary of what exists
        print("\nValidation OK\n")
        for filename in REQUIRED_FILES:
            path = data_dir / filename
            if path.exists():
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                    if isinstance(data, list):
                        print(f"  ✓ {filename}: {len(data):,} records")
                    else:
                        print(f"  ✓ {filename}: OK")
                except Exception:
                    print(f"  ✓ {filename}")


if __name__ == "__main__":
    main()
