import Link from "next/link";
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Strip from "../components/Strip";
import { FIELDS, FIELD_LABEL, fmtDate, fmtPct, load, type Rule, type Summary } from "../lib/data";

export default function Overview() {
  const [s, setS] = useState<Summary | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    Promise.all([load<Summary>("summary.json"), load<Rule[]>("rules.json")]).then(([a, b]) => { setS(a); setRules(b); })
      .catch((e) => setErr(String(e)));
  }, []);
  const sources = s ? Object.entries(s.sources) : [];
  const ruleById = Object.fromEntries(rules.map((r) => [r.id, r]));

  return (
    <Layout title="Overview">
      <header className="page-head">
        <h1>How complete is research metadata?</h1>
        <p>Metadata Lens harvests recent publication records from two research repositories over OAI-PMH, checks them
          against the OpenAIRE guidelines, maps them to Schema.org and DCAT and builds a knowledge graph you can query
          with SPARQL. Every number on this page comes from the live metadata.</p>
      </header>

      <section className="purpose" aria-labelledby="purpose">
        <h2 id="purpose">What this app is for</h2>
        <div className="purpose-grid">
          <div>
            <h3>The problem</h3>
            <p>Universities and research centres list their publications in repositories and share the records with
              search portals, aggregators and knowledge graphs. When a record lacks a DOI, a licence or a clean date,
              the publication becomes harder to find, cite, reuse and link.</p>
          </div>
          <div>
            <h3>What Metadata Lens does</h3>
            <p>It reads the records exactly as a harvester receives them, checks every record against the OpenAIRE
              guidelines, gives it a score, proposes fixes, spots duplicates and turns everything into a knowledge graph
              you can ask questions of.</p>
          </div>
          <div>
            <h3>Who it helps</h3>
            <p>Repository and library teams who want to see where their metadata falls short, and research data
              infrastructure teams who combine metadata from many sources and need to know how far they can trust it.</p>
          </div>
        </div>
      </section>

      {err && <p className="error-box">{err}</p>}
      {s && (
        <>
          <div className="figures">
            <div><b>{s.records}</b><span>records harvested</span></div>
            <div><b>{sources.length}</b><span>repositories</span></div>
            <div><b>{s.triples.toLocaleString("en")}</b><span>triples in the knowledge graph</span></div>
            <div><b>{s.duplicates}</b><span>possible duplicates</span></div>
          </div>
          <p className="muted" style={{ fontSize: 14 }}>
            Harvested on {fmtDate(s.generated)}: records changed since {s.harvest.since}, up to {s.harvest.limit_per_source} per repository.
          </p>

          <h2>Field by field</h2>
          <p className="sub">Share of records in which each Dublin Core field is present and passes every check. Each record in the
            app carries the same ten cells as a strip.</p>
          <div className="legend">
            <span><Strip fields={{ title: "ok", creator: "ok", date: "ok", identifier: "problem", rights: "missing", type: "ok", language: "ok", description: "missing", subject: "ok", publisher: "ok" }} /> example record</span>
            <span><i className="cell ok" /> present and valid</span>
            <span><i className="cell problem" /> present, with a finding</span>
            <span><i className="cell missing" /> missing</span>
          </div>
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="heat">
              <thead>
                <tr><th>Field</th>{sources.map(([k, v]) => <th key={k} className="num">{v.name.split(" (")[0]}</th>)}</tr>
              </thead>
              <tbody>
                {FIELDS.map((f) => (
                  <tr key={f}>
                    <td>{FIELD_LABEL[f]}</td>
                    {sources.map(([k, v]) => {
                      const x = v.completeness[f];
                      return (
                        <td key={k} className="cellpct" style={{ background: `color-mix(in srgb, var(--teal) ${Math.round(x * 55)}%, transparent)` }}>
                          {fmtPct(x)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Per repository</h2>
          <div className="two">
            {sources.map(([k, v]) => (
              <section className="panel" key={k}>
                <h3 style={{ marginTop: 0 }}>{v.name}</h3>
                <p className="muted" style={{ margin: "0 0 10px", fontSize: 14 }}>
                  <code>{v.endpoint}</code>{v.set && <> · set <code>{v.set}</code></>}
                </p>
                <div className="kv">
                  <dt>Records</dt><dd>{v.records}</dd>
                  <dt>Mean quality score</dt><dd><b>{v.mean_score}</b> / 100</dd>
                  <dt>With a DOI</dt><dd>{fmtPct(v.with_doi / v.records)}</dd>
                  <dt>Open access</dt><dd>{fmtPct(v.open_access / v.records)}</dd>
                </div>
                <table>
                  <thead><tr><th>Most frequent findings</th><th className="num">Records</th></tr></thead>
                  <tbody>
                    {Object.entries(v.rule_counts).slice(0, 6).map(([id, n]) => (
                      <tr key={id}>
                        <td><span className={`sev ${ruleById[id]?.severity}`}>{ruleById[id]?.severity}</span>{" "}
                          <Link href={`/records/?source=${k}&rule=${id}`}>{ruleById[id]?.title ?? id}</Link></td>
                        <td className="num">{n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 14, marginTop: 16 }}>
            The checks read the <code>oai_dc</code> export only. A field that is missing here may exist in a richer format
            (for example MARCXML or DataCite) of the same repository.
          </p>
        </>
      )}
      {!s && !err && <p className="muted">Loading the latest harvest …</p>}
    </Layout>
  );
}
