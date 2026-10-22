import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { fmtDate, load, type Rule, type Summary } from "../lib/data";

export default function About() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    load<Rule[]>("rules.json").then(setRules).catch(() => undefined);
    load<Summary>("summary.json").then(setS).catch(() => undefined);
  }, []);
  return (
    <Layout title="About">
      <header className="page-head">
        <h1>About this app</h1>
        <p>Metadata Lens is my own project. It works on real, public metadata and is rebuilt from the repositories every week.</p>
      </header>
      <div className="prose">
        <h2>What this app is for</h2>
        <p>Research repositories describe each publication with metadata: title, authors, date, DOI, access right,
          licence, language and more. They share these records over OAI-PMH with search portals, aggregators such as
          OpenAIRE and research knowledge graphs. If the metadata is incomplete or inconsistent, publications are harder
          to find, cite, reuse and link.</p>
        <p>Metadata Lens shows what a harvester actually receives, how complete and correct those records are, what could
          be fixed, and what a knowledge graph built from them can answer. It is meant for repository and library teams
          who want to improve their records, and for research data infrastructure teams who combine metadata from many
          sources.</p>

        <h2>How it works</h2>
        <ol>
          <li><b>Harvest.</b> A Python harvester asks each repository for records changed since a start date in the
            <code> oai_dc</code> format, follows resumption tokens, pauses between pages and respects the repository's request to wait.</li>
          <li><b>Read.</b> OpenAIRE vocabularies are turned into plain facts: DOI, access right, embargo end, publication type, version, licence, language.</li>
          <li><b>Check.</b> Seventeen rules based on the OpenAIRE guidelines and FAIR practice; each finding has a severity and lowers a score from 100.</li>
          <li><b>Map.</b> Every record becomes Schema.org JSON-LD and part of an RDF graph; each repository becomes a DCAT catalogue with catalogue records.</li>
          <li><b>Curate.</b> Fixes that can be proposed with confidence, duplicates and publisher spellings are listed for a person to accept or reject.</li>
          <li><b>Publish.</b> A scheduled GitHub Actions workflow runs the pipeline every week and deploys this static app; the same steps also exist as an Airflow DAG.</li>
        </ol>

        <h2>Sources</h2>
        {s && (
          <ul>
            {Object.values(s.sources).map((v) => (
              <li key={v.endpoint}><a href={v.homepage}>{v.name}</a>: <code>{v.endpoint}</code>{v.set && <>, set <code>{v.set}</code></>}, {v.records} records</li>
            ))}
            <li>Latest harvest: {fmtDate(s.generated)}, records changed since {s.harvest.since}.</li>
          </ul>
        )}

        <h2>The rules</h2>
        <table>
          <thead><tr><th>Rule</th><th>Severity</th><th>Check</th></tr></thead>
          <tbody>{rules.map((r) => (
            <tr key={r.id}><td className="mono">{r.id}</td><td><span className={`sev ${r.severity}`}>{r.severity}</span></td><td><b>{r.title}.</b> <span className="muted">{r.why}</span></td></tr>
          ))}</tbody>
        </table>

        <h2>Limits</h2>
        <ul>
          <li>Only the <code>oai_dc</code> export is checked. Repositories often hold richer metadata (for example licences or ORCID iDs) in MARCXML or DataCite, so a finding here means “not visible to a Dublin Core harvester”, not necessarily “missing in the repository”.</li>
          <li>The harvest is a sample of recent records, not the whole repository.</li>
          <li>Duplicate detection uses DOIs and normalised titles; it can miss reworded titles and flag different works with identical titles.</li>
          <li>Scores are a simple weighted count meant for comparison, not an official quality metric.</li>
        </ul>

        <h2>Who made it</h2>
        <p>Amrina (M.Sc. Educational Technology, Saarland University; B.Sc. Informatics). Design, rules and analysis are my own;
          AI was used as a supporting tool for coding. This is an independent project, not affiliated with Forschungszentrum
          Jülich, the Karlsruhe Institute of Technology or the Helmholtz Association.</p>
        <p><a href="https://github.com/sayamrina/metadata-lens">Code on GitHub</a> · <a href="https://sayamrina.github.io/">Portfolio</a></p>
      </div>
    </Layout>
  );
}
