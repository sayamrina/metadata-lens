"""Reads the parts of a Dublin Core record that OAI-PMH repositories encode with OpenAIRE conventions
(info:eu-repo/... vocabularies) into plain values: DOI, access right, publication type, licence, language, date.
"""
import re
from dataclasses import dataclass, field

from .harvest import Record

DOI_RE = re.compile(r"\b(10\.\d{4,9}/[^\s\"<>]+)", re.I)
DOI_STRICT = re.compile(r"^10\.\d{4,9}/[-._;()/:A-Za-z0-9]+$")
ACCESS = {"openAccess", "closedAccess", "embargoedAccess", "restrictedAccess", "metadataOnlyAccess"}
VERSIONS = {"draft", "submittedVersion", "acceptedVersion", "publishedVersion", "updatedVersion"}
# OpenAIRE / info:eu-repo publication types -> Schema.org type
PUB_TYPES = {
    "article": "ScholarlyArticle", "conferenceObject": "ScholarlyArticle", "preprint": "ScholarlyArticle",
    "workingPaper": "Report", "report": "Report", "book": "Book", "bookPart": "Chapter",
    "doctoralThesis": "Thesis", "masterThesis": "Thesis", "bachelorThesis": "Thesis", "lecture": "CreativeWork",
    "patent": "CreativeWork", "review": "Review", "contributionToPeriodical": "ScholarlyArticle",
    "annotation": "CreativeWork", "other": "CreativeWork", "dataset": "Dataset",
}
ISO639_2_TO_1 = {"eng": "en", "ger": "de", "deu": "de", "fre": "fr", "fra": "fr", "spa": "es", "ita": "it",
                 "rus": "ru", "chi": "zh", "zho": "zh", "jpn": "ja", "por": "pt", "dut": "nl", "nld": "nl"}
DATE_RE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")
CC_RE = re.compile(r"creativecommons\.org/(licenses|publicdomain)/([a-z-]+)/(\d\.\d)", re.I)


@dataclass
class Facts:
    title: str
    creators: list[str]
    dois: list[str] = field(default_factory=list)          # from altIdentifier relations or identifiers
    doi_mentions: list[str] = field(default_factory=list)  # DOIs only found in free text (dc:source)
    access: str | None = None
    embargo_end: str | None = None
    pub_type: str | None = None
    version: str | None = None
    licence: str | None = None
    languages: list[str] = field(default_factory=list)
    dates: list[str] = field(default_factory=list)
    landing_page: str | None = None
    publisher: str | None = None
    abstract: str | None = None
    ddc: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)


def clean_doi(value: str) -> str:
    return value.strip().rstrip(".,;").lower()


def facts(r: Record) -> Facts:
    dc = r.dc
    f = Facts(title=r.first("title"), creators=dc.get("creator", []))
    for rel in dc.get("relation", []):
        if rel.startswith("info:eu-repo/semantics/altIdentifier/doi/"):
            f.dois.append(clean_doi(rel.split("/doi/", 1)[1]))
    for ident in dc.get("identifier", []):
        m = re.match(r"https?://(dx\.)?doi\.org/(.+)$", ident, re.I)
        if m:
            f.dois.append(clean_doi(m.group(2)))
        elif ident.startswith("http") and not f.landing_page:
            f.landing_page = ident
    f.dois = list(dict.fromkeys(f.dois))
    for text in dc.get("source", []):
        f.doi_mentions += [clean_doi(m) for m in DOI_RE.findall(text) if clean_doi(m) not in f.dois]
    for value in dc.get("rights", []):
        if value.startswith("info:eu-repo/semantics/") and value.rsplit("/", 1)[1] in ACCESS:
            f.access = value.rsplit("/", 1)[1]
        elif "creativecommons.org" in value or "licen" in value.lower() or "lizenz" in value.lower():
            f.licence = f.licence or value
    for value in dc.get("type", []):
        if value.startswith("info:eu-repo/semantics/"):
            term = value.rsplit("/", 1)[1]
            if term in VERSIONS:
                f.version = term
            elif term in PUB_TYPES and not f.pub_type:
                f.pub_type = term
    for value in dc.get("date", []):
        if value.startswith("info:eu-repo/date/embargoEnd/"):
            f.embargo_end = value.rsplit("/", 1)[1]
        else:
            f.dates.append(value)
    f.languages = dc.get("language", [])
    f.publisher = r.first("publisher") or None
    f.abstract = r.first("description") or None
    for s in dc.get("subject", []):
        if s.startswith("info:eu-repo/classification/ddc/"):
            f.ddc.append(s.rsplit("/", 1)[1])
        elif not re.match(r"^(ddc:\d+|info:)", s):
            f.keywords.append(s)
    return f


def licence_uri(text: str | None) -> str | None:
    """Canonical Creative Commons licence URI (without the language-specific deed page)."""
    if not text:
        return None
    m = CC_RE.search(text)
    if not m:
        return None
    return f"https://creativecommons.org/{m.group(1).lower()}/{m.group(2).lower()}/{m.group(3)}/"
