"""Metadata quality checks.

The rules follow the OpenAIRE Guidelines for Literature Repositories (oai_dc profile) and general FAIR practice:
a record should say what it is, who made it, when, how to cite it persistently, who may read it and under which
licence. Each finding has a severity; the score is 100 minus the weights of the findings, floored at 0.
"""
from dataclasses import dataclass

from .harvest import Record
from .model import DATE_RE, DOI_STRICT, ISO639_2_TO_1, Facts, licence_uri

WEIGHT = {"error": 20, "warning": 8, "info": 3}


@dataclass(frozen=True)
class Rule:
    id: str
    field: str
    severity: str
    title: str
    why: str


RULES = {r.id: r for r in [
    Rule("ML01", "title", "error", "Title missing", "Without a title the record cannot be found or cited."),
    Rule("ML02", "creator", "error", "Creator missing", "Authorship is needed for citation and attribution."),
    Rule("ML03", "date", "error", "Publication date missing", "A date is needed to cite and to sort records."),
    Rule("ML04", "date", "warning", "Date is not ISO 8601", "OpenAIRE expects YYYY, YYYY-MM or YYYY-MM-DD."),
    Rule("ML05", "identifier", "warning", "No DOI", "A persistent identifier keeps citations working when URLs change."),
    Rule("ML06", "identifier", "error", "DOI has invalid syntax", "A malformed DOI cannot be resolved."),
    Rule("ML07", "identifier", "warning", "DOI only mentioned in free text",
         "The DOI appears in dc:source but is not exposed as an identifier, so harvesters miss it."),
    Rule("ML08", "rights", "error", "Access right missing",
         "OpenAIRE requires one info:eu-repo access right (open, closed, embargoed, restricted)."),
    Rule("ML09", "rights", "error", "Embargo without end date", "An embargoed record must state when the embargo ends."),
    Rule("ML10", "rights", "warning", "Open access without a licence",
         "Open access content needs a licence so others know how they may reuse it."),
    Rule("ML11", "rights", "info", "Licence is not a canonical URI",
         "A canonical licence URI is machine-readable; language-specific deed pages are not."),
    Rule("ML12", "type", "warning", "Publication type missing",
         "OpenAIRE requires an info:eu-repo/semantics publication type."),
    Rule("ML13", "language", "info", "Language missing", "The language helps users and search filters."),
    Rule("ML14", "language", "warning", "Language code not recognised", "Use ISO 639-3 codes such as eng or ger."),
    Rule("ML15", "description", "info", "No abstract", "An abstract greatly improves discovery."),
    Rule("ML16", "subject", "info", "No subject or classification", "Subjects connect records across collections."),
    Rule("ML17", "publisher", "info", "Publisher missing", "The publisher is part of a complete citation."),
]}


@dataclass
class Finding:
    rule: str
    severity: str
    detail: str
    suggestion: dict | None = None  # {"field", "from", "to", "why"} for semi-automatic curation


def check(r: Record, f: Facts) -> list[Finding]:
    out: list[Finding] = []

    def add(rule_id: str, detail: str = "", suggestion: dict | None = None):
        out.append(Finding(rule_id, RULES[rule_id].severity, detail, suggestion))

    if not f.title:
        add("ML01")
    if not f.creators:
        add("ML02")
    if not f.dates:
        add("ML03")
    for d in f.dates:
        if not DATE_RE.match(d):
            fixed = normalise_date(d)
            add("ML04", d, {"field": "dc:date", "from": d, "to": fixed, "why": "ISO 8601"} if fixed else None)
    if not f.dois:
        if f.doi_mentions:
            add("ML07", f.doi_mentions[0], {"field": "dc:relation", "from": None,
                                            "to": f"info:eu-repo/semantics/altIdentifier/doi/{f.doi_mentions[0]}",
                                            "why": "expose the DOI found in dc:source as an identifier"})
        elif f.pub_type in (None, "article", "conferenceObject", "bookPart", "book", "preprint", "doctoralThesis"):
            add("ML05")
    for doi in f.dois:
        if not DOI_STRICT.match(doi):
            add("ML06", doi)
    if not f.access:
        add("ML08")
    elif f.access == "embargoedAccess" and not f.embargo_end:
        add("ML09")
    if f.access == "openAccess" and not f.licence:
        add("ML10")
    if f.licence:
        canonical = licence_uri(f.licence)
        if canonical and canonical != f.licence:
            add("ML11", f.licence, {"field": "dc:rights", "from": f.licence, "to": canonical, "why": "canonical CC licence URI"})
    if not f.pub_type:
        add("ML12")
    if not f.languages:
        add("ML13")
    for lang in f.languages:
        if lang.lower() not in ISO639_2_TO_1:
            add("ML14", lang)
    if not f.abstract:
        add("ML15")
    if not f.ddc and not f.keywords:
        add("ML16")
    if not f.publisher and f.pub_type in ("article", "book", "bookPart", "conferenceObject"):
        add("ML17")
    return out


def score(findings: list[Finding]) -> int:
    return max(0, 100 - sum(WEIGHT[x.severity] for x in findings))


MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def normalise_date(value: str) -> str | None:
    """Turn common non-ISO dates into ISO 8601; return None when unsure."""
    import re
    v = value.strip()
    m = re.match(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$", v)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})T", v)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"^(\d{4})/(\d{1,2})(?:/(\d{1,2}))?$", v)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}" + (f"-{int(m.group(3)):02d}" if m.group(3) else "")
    m = re.match(r"^(\d{4})-?$", v)
    if m:
        return m.group(1)
    m = re.match(r"^([A-Za-z]{3})[a-z]* (\d{4})$", v)
    if m and m.group(1).lower() in MONTHS:
        return f"{m.group(2)}-{MONTHS[m.group(1).lower()]:02d}"
    return None
