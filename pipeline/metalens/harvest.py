"""OAI-PMH harvester for Dublin Core (oai_dc) records.

Polite by design: one request at a time, a pause between pages, and it honours "Retry-After" (HTTP 503 or a
plain-text retry notice, which some Invenio installations send).
"""
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

NS = {
    "oai": "http://www.openarchives.org/OAI/2.0/",
    "oai_dc": "http://www.openarchives.org/OAI/2.0/oai_dc/",
    "dc": "http://purl.org/dc/elements/1.1/",
}
DC_FIELDS = ["title", "creator", "contributor", "subject", "description", "publisher", "date", "type",
             "format", "identifier", "source", "language", "relation", "coverage", "rights"]
USER_AGENT = "MetadataLens/1.0 (+https://sayamrina.github.io/metadata-lens/)"


@dataclass
class Record:
    source: str
    oai_id: str
    datestamp: str
    sets: list[str]
    dc: dict[str, list[str]] = field(default_factory=dict)

    def first(self, name: str) -> str:
        values = self.dc.get(name) or []
        return values[0] if values else ""


@dataclass(frozen=True)
class Source:
    key: str
    name: str
    endpoint: str
    homepage: str
    oai_set: str | None = None  # restrict to publications where the repository also exposes authority records


SOURCES = {
    "juser": Source("juser", "JuSER (Forschungszentrum Jülich)", "https://juser.fz-juelich.de/oai2d",
                    "https://juser.fz-juelich.de/", oai_set="VDB"),
    "kit": Source("kit", "KITopen (Karlsruhe Institute of Technology)", "https://publikationen.bibliothek.kit.edu/oai",
                  "https://publikationen.bibliothek.kit.edu/"),
}


def fetch(url: str, retries: int = 6, opener=urllib.request.urlopen) -> str:
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with opener(req, timeout=60) as r:
                body = r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < retries - 1:
                time.sleep(int(e.headers.get("Retry-After", "10") or 10))
                continue
            raise
        m = re.match(r"\s*Retry after (\d+) seconds", body)
        if m and attempt < retries - 1:
            time.sleep(int(m.group(1)) + 1)
            continue
        return body
    raise RuntimeError(f"gave up after {retries} attempts: {url}")


def parse_page(xml: str, source: str) -> tuple[list[Record], str | None]:
    root = ET.fromstring(xml)
    error = root.find("oai:error", NS)
    if error is not None:
        if error.get("code") == "noRecordsMatch":
            return [], None
        raise RuntimeError(f"OAI error {error.get('code')}: {error.text}")
    records = []
    for rec in root.iterfind(".//oai:record", NS):
        header = rec.find("oai:header", NS)
        if header is None or header.get("status") == "deleted":
            continue
        dc_root = rec.find(".//oai_dc:dc", NS)
        if dc_root is None:
            continue
        dc: dict[str, list[str]] = {}
        for name in DC_FIELDS:
            values = [" ".join(e.text.split()) for e in dc_root.iterfind(f"dc:{name}", NS) if e.text and e.text.strip()]
            if values:
                dc[name] = values
        records.append(Record(source, header.findtext("oai:identifier", "", NS), header.findtext("oai:datestamp", "", NS),
                              [s.text for s in header.iterfind("oai:setSpec", NS) if s.text], dc))
    token = root.find(".//oai:resumptionToken", NS)
    return records, (token.text.strip() if token is not None and token.text and token.text.strip() else None)


def harvest(source: Source, since: str, limit: int, pause: float = 2.0, fetcher=fetch) -> list[Record]:
    params = {"verb": "ListRecords", "metadataPrefix": "oai_dc", "from": since}
    if source.oai_set:
        params["set"] = source.oai_set
    url = f"{source.endpoint}?{urllib.parse.urlencode(params)}"
    out: list[Record] = []
    while url and len(out) < limit:
        records, token = parse_page(fetcher(url), source.key)
        out.extend(records)
        if not token:
            break
        url = f"{source.endpoint}?{urllib.parse.urlencode({'verb': 'ListRecords', 'resumptionToken': token})}"
        time.sleep(pause)
    return out[:limit]
