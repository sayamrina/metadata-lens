from metalens.model import facts, licence_uri
from metalens.quality import check, normalise_date, score


def rules(r):
    return {x.rule: x for x in check(r, facts(r))}


def test_good_record_only_gets_the_licence_uri_hint(records):
    r = rules(records[0])
    assert set(r) == {"ML11"}
    assert r["ML11"].suggestion["to"] == "https://creativecommons.org/licenses/by/4.0/"


def test_problem_record(records):
    r = rules(records[1])
    assert r["ML04"].suggestion["to"] == "2026-10-16"          # 16.10.2026 -> ISO 8601
    assert r["ML07"].suggestion["to"].endswith("10.1016/j.jpowsour.2026.1")  # DOI only in dc:source
    assert "ML09" in r                                          # embargo without end date
    assert "ML12" in r and "ML14" in r and "ML15" in r          # no type, language 'English', no abstract
    assert score(check(records[1], facts(records[1]))) < 60


def test_facts_reads_openaire_vocabularies(records):
    f = facts(records[0])
    assert f.dois == ["10.1016/j.jpowsour.2026.1"]
    assert (f.access, f.pub_type, f.version) == ("openAccess", "article", "publishedVersion")
    assert f.ddc == ["620"] and f.keywords == ["Lithium-ion battery"]


def test_normalise_date():
    assert normalise_date("2026-10-16T08:00:00Z") == "2026-10-16"
    assert normalise_date("2026/3/7") == "2026-03-07"
    assert normalise_date("1961-") == "1961"
    assert normalise_date("March 2026") == "2026-03"
    assert normalise_date("sometime") is None


def test_licence_uri():
    assert licence_uri("https://creativecommons.org/licenses/by-nc-nd/4.0/deed.de") == "https://creativecommons.org/licenses/by-nc-nd/4.0/"
    assert licence_uri("KITopen License") is None
