"""Collection-level checks that need more than one record: duplicates across repositories and publisher name variants.

These produce suggestions for a person to accept or reject; nothing is changed automatically.
"""
import re
import unicodedata
from collections import Counter, defaultdict

STOP = {"the", "a", "an", "of", "and", "in", "on", "for", "to", "with"}
PUBLISHER_NOISE = re.compile(r"\b(inc|ltd|gmbh|bv|b\.v|co|kg|ag|plc|llc|publishing|publishers|verlag|science|press)\b\.?", re.I)


def norm_title(title: str) -> str:
    t = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()
    words = [w for w in re.findall(r"[a-z0-9]+", t) if w not in STOP]
    return " ".join(words)


def duplicates(items: list[dict]) -> list[dict]:
    """Groups of records that describe the same work: same DOI, or same normalised title and year."""
    by_key: dict[str, list[dict]] = defaultdict(list)
    for it in items:
        keys = {f"doi:{d}" for d in it["dois"]}
        if it["title"] and it["year"]:
            keys.add(f"title:{norm_title(it['title'])}|{it['year']}")
        for k in keys:
            by_key[k].append(it)
    groups, seen = [], set()
    for key, members in by_key.items():
        ids = tuple(sorted({m["id"] for m in members}))
        if len(ids) < 2 or ids in seen:
            continue
        seen.add(ids)
        groups.append({"match": key.split(":", 1)[0], "key": key.split(":", 1)[1], "records": list(ids),
                       "sources": sorted({m["source"] for m in members})})
    return groups


def publisher_key(name: str) -> str:
    n = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    n = PUBLISHER_NOISE.sub(" ", n)
    return " ".join(re.findall(r"[a-z0-9]+", n))


def publisher_variants(items: list[dict]) -> list[dict]:
    """Spellings of the same publisher (e.g. 'Elsevier' and 'Elsevier Science'); suggest the most common one."""
    groups: dict[str, Counter] = defaultdict(Counter)
    for it in items:
        if it.get("publisher"):
            groups[publisher_key(it["publisher"])][it["publisher"]] += 1
    out = []
    for key, counter in groups.items():
        if key and len(counter) > 1:
            preferred = counter.most_common(1)[0][0]
            out.append({"preferred": preferred, "variants": [{"name": n, "count": c} for n, c in counter.most_common()]})
    return sorted(out, key=lambda g: -sum(v["count"] for v in g["variants"]))
