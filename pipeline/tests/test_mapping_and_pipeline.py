import json

from rdflib.namespace import DCAT, RDF

from metalens.curate import duplicates, publisher_variants
from metalens.mapping import SDO
from metalens.pipeline import build, write
from tests.conftest import SOURCE


def test_build_maps_records_to_schema_org_and_dcat(records, tmp_path):
    result, g = build({"repo": records}, sources={"repo": SOURCE})
    item = next(i for i in result["items"] if i["id"] == "repo:2")
    ld = item["jsonld"]
    assert ld["@type"] == "ScholarlyArticle"
    assert ld["sameAs"] == ["https://doi.org/10.1016/j.jpowsour.2026.1"]
    assert ld["license"] == "https://creativecommons.org/licenses/by/4.0/"
    assert ld["inLanguage"] == ["en"] and ld["isAccessibleForFree"] is True
    assert len(list(g.subjects(RDF.type, DCAT.CatalogRecord))) == 2
    assert len(list(g.subjects(RDF.type, SDO.ScholarlyArticle))) == 1
    q = g.query("PREFIX schema: <https://schema.org/> SELECT (COUNT(DISTINCT ?p) AS ?n) WHERE { ?w schema:author ?p }")
    assert int(next(iter(q))[0]) == 3

    write(result, g, tmp_path, {"since": "2026-10-01"})
    summary = json.loads((tmp_path / "summary.json").read_text())
    assert summary["records"] == 2 and summary["sources"]["repo"]["with_doi"] == 1
    assert (tmp_path / "graph.ttl").read_text().startswith("@prefix")


def test_duplicates_by_doi_and_title():
    items = [
        {"id": "a:1", "source": "a", "title": "The Mixing Duration", "year": "2026", "dois": ["10.1/x"]},
        {"id": "b:7", "source": "b", "title": "Mixing duration", "year": "2026", "dois": []},
        {"id": "b:8", "source": "b", "title": "Other", "year": "2025", "dois": ["10.1/x"]},
    ]
    groups = duplicates(items)
    assert {g["match"] for g in groups} == {"doi", "title"}
    assert any(set(g["records"]) == {"a:1", "b:8"} for g in groups)


def test_publisher_variants():
    items = [{"publisher": p} for p in ["Elsevier", "Elsevier", "Elsevier Science", "Elsevier B.V.", "Springer"]]
    groups = publisher_variants(items)
    assert groups[0]["preferred"] == "Elsevier" and len(groups[0]["variants"]) == 3
