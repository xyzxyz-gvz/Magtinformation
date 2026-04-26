"""
Download MF photos via politikdata.dk's image proxy.

Why: ft.dk's image CDN refuses hotlinks (returns 403 to non-ft.dk callers),
so the URLs in members_processed.json don't render in the browser.
politikdata.dk runs an /imageproxy.php endpoint that fetches from ft.dk and
returns the actual JPEG — but ONLY when the Referer matches a politikdata
person page slug AND the User-Agent looks like a real browser. Otherwise it
silently returns one of two placeholders:

    e063fd28c3eeac2d74dd19c6854f6c64 — 152 KB "Gandalf / you shall not pass"
    b0500ce58252f327797abae52de2f834 — 1190 byte tiny placeholder

We detect those hashes and treat them as failures.

Slug rule: forename(s) + lastname, lowercased, Danish chars folded
(æ→ae, ø→oe, å→aa, accents stripped), non-letters replaced with '-'.
Example: 'Karina Adsbøl' → 'karina-adsboel'.
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data" / "members_processed.json"
PHOTOS_DIR = ROOT / "public" / "photos"
PROXY = "https://politikdata.dk/imageproxy.php?target="
PROFILE = "https://politikdata.dk/personer/"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/132.0.0.0 Safari/537.36"
)
PLACEHOLDER_HASHES = {
    "e063fd28c3eeac2d74dd19c6854f6c64",  # Gandalf "you shall not pass"
    "b0500ce58252f327797abae52de2f834",  # 1190 byte tiny placeholder
    "6372173034fa5fbf3d0afde9ae7da9fa",  # ft.dk's own 500x500 "no photo" PNG
}


def slugify(name: str) -> str:
    """Convert a Danish name to politikdata.dk's slug format."""
    s = name.lower().strip()
    s = s.replace("æ", "ae").replace("ø", "oe").replace("å", "aa")
    # Strip remaining accents (é, ü, etc.)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    # Replace any run of non a-z0-9 with '-'
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def fetch(url: str, slug: str, dest: Path, timeout: int = 20) -> tuple[bool, int, str]:
    target = PROXY + urllib.parse.quote(url, safe="")
    req = urllib.request.Request(
        target,
        headers={
            "User-Agent": UA,
            "Referer": PROFILE + slug,
            "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
            "Accept-Language": "da,en-US;q=0.9,en;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            ctype = resp.headers.get("Content-Type", "")
            if not ctype.startswith("image/"):
                return False, 0, f"non-image content-type: {ctype}"
            data = resp.read()
            if len(data) < 2000:
                return False, len(data), f"too small ({len(data)} bytes — likely placeholder)"
            h = hashlib.md5(data).hexdigest()
            if h in PLACEHOLDER_HASHES:
                return False, len(data), f"placeholder hash {h}"
            dest.write_bytes(data)
            return True, len(data), ""
    except Exception as e:  # noqa: BLE001
        return False, 0, repr(e)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=4,
                    help="lower → less likely to hit politikdata rate limits")
    ap.add_argument("--rewrite-only", action="store_true",
                    help="skip downloads; only rewrite paths in members_processed.json")
    ap.add_argument("--retry-failed", action="store_true",
                    help="re-attempt members where the local file is missing")
    args = ap.parse_args()

    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

    with DATA.open() as f:
        members = json.load(f)

    todo: list[tuple[int, str, str, Path]] = []
    for m in members:
        url = m.get("photo")
        if not url:
            continue
        if isinstance(url, str) and url.startswith("/photos/"):
            continue  # already rewritten
        dest = PHOTOS_DIR / f"{m['id']}.jpg"
        if dest.exists() and not args.retry_failed:
            continue
        slug = slugify(m["navn"])
        if not slug:
            continue
        todo.append((m["id"], slug, url, dest))

    if args.limit:
        todo = todo[: args.limit]

    print(f"{len(todo)} photos to download (workers={args.workers})", flush=True)

    if not args.rewrite_only and todo:
        ok = 0
        fail = 0
        fail_details: dict[str, int] = {}
        start = time.time()
        with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
            futures = {
                ex.submit(fetch, url, slug, dest): (mid, slug, url)
                for mid, slug, url, dest in todo
            }
            for i, fut in enumerate(cf.as_completed(futures), 1):
                mid, slug, url = futures[fut]
                success, size, info = fut.result()
                if success:
                    ok += 1
                else:
                    fail += 1
                    bucket = info.split(":")[0][:40]
                    fail_details[bucket] = fail_details.get(bucket, 0) + 1
                    if fail <= 8:
                        print(f"  ✗ {mid} ({slug}): {info}", file=sys.stderr)
                if i % 100 == 0 or i == len(todo):
                    elapsed = time.time() - start
                    print(
                        f"  {i}/{len(todo)} done · {ok} ok · {fail} fail · {elapsed:.0f}s",
                        flush=True,
                    )
        print(f"\nDownload finished: {ok} ok, {fail} fail")
        if fail_details:
            print("Failure buckets:")
            for k, v in sorted(fail_details.items(), key=lambda x: -x[1]):
                print(f"  {v:>4} × {k}")

    rewritten = 0
    cleared = 0
    for m in members:
        local = PHOTOS_DIR / f"{m['id']}.jpg"
        cur = m.get("photo")
        cur_is_local = isinstance(cur, str) and cur.startswith("/photos/")
        if local.exists():
            if not cur_is_local:
                m["photo"] = f"/photos/{m['id']}.jpg"
                rewritten += 1
        elif cur_is_local:
            # File was removed (e.g. detected as placeholder). Drop the broken
            # path so the site renders the empty-portrait box instead.
            m["photo"] = None
            cleared += 1
        # If no local file and photo points at ft.dk, leave it alone — re-runs
        # can retry. The browser will fall back to the placeholder box on 403.

    DATA.write_text(json.dumps(members, ensure_ascii=False))
    print(f"Rewrote {rewritten} photo paths in members_processed.json")
    if cleared:
        print(f"Cleared {cleared} broken local paths")

    have_local = sum(1 for m in members if str(m.get("photo") or "").startswith("/photos/"))
    print(f"Total members now pointing at local photos: {have_local}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
