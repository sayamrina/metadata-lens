"""Crosswalk from Dublin Core (with OpenAIRE conventions) to Schema.org JSON-LD and to an RDF knowledge graph.

Each publication becomes a Schema.org resource; each repository becomes a DCAT catalogue whose catalogue records
point to those resources (dcat:CatalogRecord / foaf:primaryTopic), keeping the harvest datestamp as dcterms:modified.
"""
import hashlib
import re

from rdflib import Graph, Literal, Namespace, URIRef
from rdflib.namespace import DCAT, DCTERMS, FOAF, RDF, XSD

from .harvest import Record, Source
from .model import ISO639_2_TO_1, PUB_TYPES, Facts, licence_uri

SDO = Namespace("https://schema.org/")
ML = Namespace("https://sayamrina.github.io/metadata-lens/id/")


def person_id(name: str) -> str:
    return "person/" + hashlib.sha1(name.strip().lower().encode()).hexdigest()[:12]


def to_jsonld(r: Record, f: Facts, source: Source) -> dict:
    doc: dict = {
        "@context": "https://schema.org",
        "@type": PUB_TYPES.get(f.pub_type or "", "CreativeWork"),
        "@id": f.landing_page or r.oai_id,
        "name": f.title,
        "author": [{"@type": "Person", "name": c} for c in f.creators],
    }
    if f.dates:
        doc["datePublished"] = f.dates[0]
    if f.dois:
        doc["identifier"] = [{"@type": "PropertyValue", "propertyID": "DOI", "value": d} for d in f.dois]
        doc["sameAs"] = [f"https://doi.org/{d}" for d in f.dois]
    if f.languages:
        doc["inLanguage"] = [ISO639_2_TO_1.get(x.lower(), x) for x in f.languages]
    if f.publisher:
        doc["publisher"] = {"@type": "Organization", "name": f.publisher}
    lic = licence_uri(f.licence) or f.licence
    if lic:
        doc["license"] = lic
    if f.access:
        doc["isAccessibleForFree"] = f.access == "openAccess"
        doc["conditionsOfAccess"] = f.access
    if f.abstract:
        doc["abstract"] = f.abstract
    if f.keywords:
        doc["keywords"] = f.keywords
    if f.ddc:
        doc["about"] = [{"@type": "DefinedTerm", "termCode": c, "inDefinedTermSet": "https://www.oclc.org/en/dewey.html"} for c in f.ddc]
    doc["includedInDataCatalog"] = {"@type": "DataCatalog", "name": source.name, "url": source.homepage}
    return doc


def add_to_graph(g: Graph, r: Record, f: Facts, source: Source, item_score: int) -> None:
    work = URIRef(f.landing_page or f"{ML}record/{r.source}/{r.oai_id.rsplit(':', 1)[-1]}")
    catalog = ML[f"catalog/{source.key}"]
    rec = ML[f"catalog-record/{r.source}/{re.sub(r'[^A-Za-z0-9._-]', '_', r.oai_id)}"]
    g.add((catalog, RDF.type, DCAT.Catalog))
    g.add((catalog, DCTERMS.title, Literal(source.name)))
    g.add((catalog, FOAF.homepage, URIRef(source.homepage)))
    g.add((catalog, DCAT.record, rec))
    g.add((rec, RDF.type, DCAT.CatalogRecord))
    g.add((rec, FOAF.primaryTopic, work))
    g.add((rec, DCTERMS.identifier, Literal(r.oai_id)))
    if r.datestamp:
        g.add((rec, DCTERMS.modified, Literal(r.datestamp[:10], datatype=XSD.date)))
    g.add((rec, ML.qualityScore, Literal(item_score, datatype=XSD.integer)))

    g.add((work, RDF.type, SDO[PUB_TYPES.get(f.pub_type or "", "CreativeWork")]))
    g.add((work, SDO.name, Literal(f.title)))
    for i, name in enumerate(f.creators):
        p = ML[person_id(name)]
        g.add((p, RDF.type, SDO.Person))
        g.add((p, SDO.name, Literal(name)))
        g.add((work, SDO.author, p))
        if i == 0:
            g.add((work, ML.firstAuthor, p))
    if f.dates:
        g.add((work, SDO.datePublished, Literal(f.dates[0])))
    for d in f.dois:
        g.add((work, SDO.sameAs, URIRef(f"https://doi.org/{d}")))
        g.add((work, SDO.identifier, Literal(d)))
    for lang in f.languages:
        g.add((work, SDO.inLanguage, Literal(ISO639_2_TO_1.get(lang.lower(), lang))))
    if f.publisher:
        g.add((work, SDO.publisher, Literal(f.publisher)))
    lic = licence_uri(f.licence)
    if lic:
        g.add((work, SDO.license, URIRef(lic)))
    if f.access:
        g.add((work, SDO.conditionsOfAccess, Literal(f.access)))
    for c in f.ddc:
        g.add((work, SDO.about, Literal(f"ddc:{c}")))
    for k in f.keywords[:12]:
        g.add((work, SDO.keywords, Literal(k)))
    g.add((work, SDO.includedInDataCatalog, catalog))


def new_graph() -> Graph:
    g = Graph()
    g.bind("schema", SDO)
    g.bind("dcat", DCAT)
    g.bind("dcterms", DCTERMS)
    g.bind("foaf", FOAF)
    g.bind("ml", ML)
    return g
