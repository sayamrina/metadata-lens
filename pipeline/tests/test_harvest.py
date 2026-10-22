import io
import urllib.error

from metalens import harvest as h
from tests.conftest import SOURCE


def test_parse_page_skips_deleted_and_reads_token(pages):
    records, token = h.parse_page(pages[0], "repo")
    assert [r.oai_id for r in records] == ["oai:repo.example:2"]
    assert token == "TOKEN1"
    assert records[0].dc["creator"] == ["Lindner, Adrian", "Krewer, Ulrike"]
    assert h.parse_page(pages[1], "repo")[1] is None  # empty token ends the list


def test_harvest_follows_resumption_token(pages, monkeypatch):
    monkeypatch.setattr(h.time, "sleep", lambda s: None)
    calls = []

    def fetcher(url):
        calls.append(url)
        return pages[len(calls) - 1]

    out = h.harvest(SOURCE, "2026-10-01", limit=10, fetcher=fetcher)
    assert len(out) == 2 and "resumptionToken=TOKEN1" in calls[1]


def test_fetch_waits_when_the_server_asks(monkeypatch):
    waits = []
    monkeypatch.setattr(h.time, "sleep", lambda s: waits.append(s))
    answers = [b"Retry after 10 seconds", b"<OAI-PMH/>"]

    class Resp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def opener(req, timeout):
        assert "MetadataLens" in req.get_header("User-agent")
        return Resp(answers.pop(0))

    assert h.fetch("https://repo.example/oai", opener=opener) == "<OAI-PMH/>"
    assert waits == [11]


def test_fetch_retries_on_503(monkeypatch):
    monkeypatch.setattr(h.time, "sleep", lambda s: None)
    state = {"n": 0}

    class Resp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def opener(req, timeout):
        state["n"] += 1
        if state["n"] == 1:
            raise urllib.error.HTTPError(req.full_url, 503, "busy", {"Retry-After": "2"}, None)
        return Resp(b"ok")

    assert h.fetch("https://repo.example/oai", opener=opener) == "ok"
