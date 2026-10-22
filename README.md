# Metadata Lens

[![harvest-and-publish](https://github.com/sayamrina/metadata-lens/actions/workflows/publish.yml/badge.svg)](https://github.com/sayamrina/metadata-lens/actions/workflows/publish.yml)

**Live app:** https://sayamrina.github.io/metadata-lens/ · [How to use](https://sayamrina.github.io/metadata-lens/how-to-use/) · [About](https://sayamrina.github.io/metadata-lens/about/) · [Portfolio](https://sayamrina.github.io/)

Metadata Lens harvests real publication metadata from research repositories over **OAI-PMH**, checks its quality against the **OpenAIRE guidelines**, maps it to **Schema.org** and **DCAT**, builds an **RDF knowledge graph** and lets you query it with **SPARQL** in the browser. A scheduled workflow re-harvests and republishes it every week.

Current sources: **JuSER** (Forschungszentrum Jülich, set `VDB`) and **KITopen** (Karlsruhe Institute of Technology), both public OAI-PMH endpoints.

## What it does

| Step | What happens | Code |
|---|---|---|
| Harvest | `ListRecords` in `oai_dc` since a start date, following resumption tokens, pausing between pages and honouring the server's request to wait (HTTP 503 / `Retry after`) | `pipeline/metalens/harvest.py` |
| Read | OpenAIRE `info:eu-repo` vocabularies become plain facts: DOI (`altIdentifier/doi`), access right, embargo end, publication type, version, licence, language | `model.py` |
| Check | 17 rules (title, creator, ISO dates, DOI present and valid, DOI hidden in free text, access right, embargo end, licence for open access, canonical licence URI, publication type, ISO 639 language, abstract, subject, publisher); each finding has a severity and lowers a 0–100 score | `quality.py` |
| Map | Schema.org JSON-LD per record; RDF graph with works and people in Schema.org, each repository as a `dcat:Catalog` with `dcat:CatalogRecord`s pointing to the works | `mapping.py` |
| Curate | Proposed fixes (ISO dates, canonical CC licence URIs, DOIs found only in `dc:source`), possible duplicates (DOI or normalised title + year) and publisher spellings, for a person to accept or reject | `curate.py` |
| Publish | JSON + Turtle for a static Next.js/TypeScript app; SPARQL runs in the browser with Oxigraph (WebAssembly) | `web/` |
| Schedule | GitHub Actions every Monday; the same steps as an Airflow DAG | `.github/workflows/publish.yml`, `airflow/dags/metadata_lens.py` |

## Run it

```bash
python -m venv .venv && .venv/bin/pip install -r pipeline/requirements-dev.txt
cd pipeline
../.venv/bin/pytest -q                                   # 12 tests with OAI-PMH fixtures
../.venv/bin/python -m metalens.pipeline --out ../web/public/data --since 2026-09-01 --limit 400

cd ../web
npm ci
npm test            # runs every example SPARQL query against the generated graph
npm run dev         # http://127.0.0.1:3007
```

## Limits

- Only the `oai_dc` export is checked. Repositories often expose richer metadata (licences, ORCID iDs, funding) in MARCXML or DataCite, so a finding means "not visible to a Dublin Core harvester", not necessarily "missing in the repository".
- Each run is a sample of recently changed records, not a full repository audit.
- Duplicate detection uses DOIs and normalised titles; it can miss reworded titles.
- The score is a simple weighted count for comparison, not an official metric.

## About

An independent project by Amrina, built on public metadata. Not affiliated with Forschungszentrum Jülich, the Karlsruhe Institute of Technology or the Helmholtz Association. Metadata remains subject to the terms of the source repositories.

This app was built by Amrina, with AI as a supporting tool for coding.
