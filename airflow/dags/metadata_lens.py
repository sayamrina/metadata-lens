"""Airflow DAG for the Metadata Lens pipeline: harvest each repository, then check, map and publish.

The same functions run in GitHub Actions for the public demo; this DAG shows how the pipeline would be scheduled
in an Airflow deployment. Harvested records are passed between tasks as JSON files, not through XCom.
"""
import json
from dataclasses import asdict
from datetime import datetime, timedelta
from pathlib import Path

from airflow.decorators import dag, task

WORKDIR = Path("/opt/airflow/data/metadata-lens")
SINCE_DAYS = 45
LIMIT = 400


@dag(schedule="0 4 * * 1", start_date=datetime(2026, 10, 1), catchup=False,
     default_args={"retries": 2, "retry_delay": timedelta(minutes=10)}, tags=["metadata", "oai-pmh"])
def metadata_lens():
    @task
    def harvest_source(key: str) -> str:
        from metalens.harvest import SOURCES, harvest
        since = (datetime.utcnow() - timedelta(days=SINCE_DAYS)).strftime("%Y-%m-%d")
        records = harvest(SOURCES[key], since, LIMIT)
        out = WORKDIR / "raw" / f"{key}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({"since": since, "records": [asdict(r) for r in records]}))
        return str(out)

    @task
    def check_map_publish(paths: list[str]) -> dict:
        from metalens.harvest import Record
        from metalens.pipeline import build, write
        harvested, since = {}, None
        for p in paths:
            data = json.loads(Path(p).read_text())
            since = data["since"]
            harvested[Path(p).stem] = [Record(**r) for r in data["records"]]
        result, graph = build(harvested)
        write(result, graph, WORKDIR / "public", {"since": since, "limit_per_source": LIMIT, "metadata_prefix": "oai_dc"})
        return {"records": result["summary"]["records"], "triples": result["summary"]["triples"]}

    check_map_publish([harvest_source.override(task_id=f"harvest_{k}")(k) for k in ("juser", "kit")])


metadata_lens()
