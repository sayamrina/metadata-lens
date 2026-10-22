"""The pipeline: harvest -> facts -> quality checks -> Schema.org / RDF -> collection checks -> JSON for the web app.

Run:  python -m metalens.pipeline --out ../web/public/data --since 2026-09-01 --limit 400
Each step is a function, so the Airflow DAG in airflow/dags can call them as separate tasks.
"""
import argparse
import json
from collections import Counter
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from .curate import duplicates, publisher_variants
from .harvest import SOURCES, Record, harvest
from .mapping import add_to_graph, new_graph, to_jsonld
from .model import facts
from .quality import RULES, check, score

FIELDS = ["title", "creator", "date", "identifier", "rights", "type", "language", "description", "subject", "publisher"]


def harvest_all(since: str, limit: int, sources=SOURCES, fetcher=None) -> dict[str, list[Record]]:
    kw = {"fetcher": fetcher} if fetcher else {}
    return {key: harvest(src, since, limit, **kw) for key, src in sources.items()}


def field_status(item: dict) -> dict[str, str]:
    """Per Dublin Core field: ok, missing or problem (used for the completeness strip in the web app)."""
    rules_by_field: dict[str, str] = {}
    for x in item["findings"]:
        rules_by_field.setdefault(RULES[x["rule"]].field, "problem")
    return {fld: ("missing" if not item["dc"].get(fld) and fld not in ("identifier",) and fld in rules_by_field
                  else rules_by_field.get(fld, "ok")) for fld in FIELDS}


def build(harvested: dict[str, list[Record]], sources=SOURCES) -> tuple[dict, object]:
    g = new_graph()
    items = []
    for key, records in harvested.items():
        src = sources[key]
        for r in records:
            f = facts(r)
            findings = check(r, f)
            s = score(findings)
            add_to_graph(g, r, f, src, s)
            year = next((d[:4] for d in f.dates if d[:4].isdigit()), None)
            item = {
                "id": f"{key}:{r.oai_id.rsplit(':', 1)[-1]}", "source": key, "oai_id": r.oai_id, "datestamp": r.datestamp,
                "title": f.title, "creators": f.creators, "year": year, "dois": f.dois, "type": f.pub_type,
                "access": f.access, "licence": f.licence, "publisher": f.publisher, "landing_page": f.landing_page,
                "score": s, "findings": [asdict(x) for x in findings], "dc": r.dc, "jsonld": to_jsonld(r, f, src),
            }
            item["fields"] = field_status(item)
            items.append(item)

    dupes = duplicates(items)
    dupe_ids = {i for grp in dupes for i in grp["records"]}
    for it in items:
        it["duplicate"] = it["id"] in dupe_ids

    summary = {"generated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "sources": {}}
    for key, src in sources.items():
        mine = [i for i in items if i["source"] == key]
        if not mine:
            continue
        rule_counts = Counter(x["rule"] for i in mine for x in i["findings"])
        completeness = {fld: round(sum(i["fields"][fld] == "ok" for i in mine) / len(mine), 3) for fld in FIELDS}
        summary["sources"][key] = {
            "name": src.name, "homepage": src.homepage, "endpoint": src.endpoint, "set": src.oai_set,
            "records": len(mine), "mean_score": round(sum(i["score"] for i in mine) / len(mine), 1),
            "rule_counts": dict(rule_counts.most_common()), "completeness": completeness,
            "with_doi": sum(bool(i["dois"]) for i in mine), "open_access": sum(i["access"] == "openAccess" for i in mine),
        }
    summary["records"] = len(items)
    summary["triples"] = len(g)
    summary["duplicates"] = len(dupes)
    rules = [asdict(r) for r in RULES.values()]
    return {"items": items, "summary": summary, "duplicates": dupes, "publishers": publisher_variants(items),
            "rules": rules}, g


def write(result: dict, graph, out: Path, meta: dict) -> None:
    out.mkdir(parents=True, exist_ok=True)
    result["summary"]["harvest"] = meta
    (out / "records.json").write_text(json.dumps(result["items"], ensure_ascii=False, separators=(",", ":")))
    for name in ("summary", "duplicates", "publishers", "rules"):
        (out / f"{name}.json").write_text(json.dumps(result[name], ensure_ascii=False, indent=1))
    graph.serialize(destination=str(out / "graph.ttl"), format="turtle")


def main() -> None:
    ap = argparse.ArgumentParser(description="Harvest, check and map repository metadata.")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--since", default="2026-09-01", help="OAI-PMH 'from' date (YYYY-MM-DD)")
    ap.add_argument("--limit", type=int, default=400, help="records per source")
    a = ap.parse_args()
    harvested = harvest_all(a.since, a.limit)
    result, graph = build(harvested)
    write(result, graph, a.out, {"since": a.since, "limit_per_source": a.limit, "metadata_prefix": "oai_dc"})
    s = result["summary"]
    print(f"{s['records']} records, {s['triples']} triples, {s['duplicates']} duplicate groups -> {a.out}")


if __name__ == "__main__":
    main()
