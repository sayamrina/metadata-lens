import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import Strip from "../components/Strip";
import { load, type Item, type Rule, type Summary } from "../lib/data";

const PAGE = 60;

export default function Records() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [rule, setRule] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([load<Item[]>("records.json"), load<Rule[]>("rules.json"), load<Summary>("summary.json")])
      .then(([a, b, c]) => { setItems(a); setRules(b); setSummary(c); })
      .catch((e) => setErr(String(e)));
  }, []);

  // filters can come from links on other pages (?source=kit&rule=ML11&id=...)
  useEffect(() => {
    if (!router.isReady) return;
    const p = router.query;
    if (typeof p.source === "string") setSource(p.source);
    if (typeof p.rule === "string") setRule(p.rule);
    if (typeof p.id === "string") setSelected(p.id);
  }, [router.isReady, router.query]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((i) => !source || i.source === source)
      .filter((i) => !rule || i.findings.some((f) => f.rule === rule))
      .filter((i) => i.score <= maxScore)
      .filter((i) => !needle || i.title.toLowerCase().includes(needle) || i.creators.some((c) => c.toLowerCase().includes(needle))
        || i.dois.some((d) => d.includes(needle)))
      .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title));
  }, [items, q, source, rule, maxScore]);

  useEffect(() => setShown(PAGE), [q, source, rule, maxScore]);
  const current = items.find((i) => i.id === selected) ?? null;
  const ruleById = Object.fromEntries(rules.map((r) => [r.id, r]));

  return (
    <Layout title="Records">
      <header className="page-head">
        <h1>Records</h1>
        <p>Every harvested record with its quality score, its findings and its Schema.org mapping. Lowest scores come first.
          Select a record to see what was checked and how it could be fixed.</p>
      </header>
      {err && <p className="error-box">{err}</p>}
      <div className="filters" role="search">
        <label>Search title, author or DOI
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. battery, Winter, 10.1016" />
        </label>
        <label>Repository
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            {summary && Object.entries(summary.sources).map(([k, v]) => <option key={k} value={k}>{v.name.split(" (")[0]}</option>)}
          </select>
        </label>
        <label>Finding
          <select value={rule} onChange={(e) => setRule(e.target.value)}>
            <option value="">Any</option>
            {rules.map((r) => <option key={r.id} value={r.id}>{r.id} {r.title}</option>)}
          </select>
        </label>
        <label>Score up to {maxScore}
          <input type="range" min={0} max={100} step={5} value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} />
        </label>
      </div>
      <p className="muted" style={{ fontSize: 14, margin: "0 0 10px" }}>{filtered.length} of {items.length} records</p>

      <div className="records">
        <div>
          <div className="rlist">
            {filtered.slice(0, shown).map((i) => (
              <button key={i.id} aria-pressed={i.id === selected} onClick={() => {
                setSelected(i.id);
                void router.replace({ query: { ...router.query, id: i.id } }, undefined, { shallow: true, scroll: false });
              }}>
                <span className="t">{i.title || <em>(no title)</em>}</span>
                <span className="s" aria-label={`score ${i.score}`}>{i.score}</span>
                <span className="m"><Strip fields={i.fields} /> {i.source.toUpperCase()} · {i.year ?? "no year"} · {i.findings.length} finding{i.findings.length === 1 ? "" : "s"}{i.duplicate ? " · possible duplicate" : ""}</span>
              </button>
            ))}
          </div>
          {shown < filtered.length && (
            <p><button className="btn" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, filtered.length - shown)} more</button></p>
          )}
        </div>

        <aside className="panel detail" aria-live="polite">
          {!current && <p className="muted">Select a record on the left.</p>}
          {current && (
            <>
              <h2>{current.title}</h2>
              <Strip fields={current.fields} size="lg" />
              <dl className="kv">
                <dt>Score</dt><dd><b>{current.score}</b> / 100</dd>
                <dt>Repository</dt><dd>{summary?.sources[current.source]?.name}</dd>
                <dt>Authors</dt><dd>{current.creators.slice(0, 8).join("; ")}{current.creators.length > 8 && ` and ${current.creators.length - 8} more`}</dd>
                <dt>Year</dt><dd>{current.year ?? "–"}</dd>
                <dt>DOI</dt><dd className="mono">{current.dois.length ? current.dois.map((d) => <a key={d} href={`https://doi.org/${d}`} target="_blank" rel="noopener">{d} </a>) : "none"}</dd>
                <dt>Type</dt><dd>{current.type ?? "not stated"}</dd>
                <dt>Access</dt><dd>{current.access ?? "not stated"}</dd>
                <dt>Licence</dt><dd>{current.licence ?? "none in oai_dc"}</dd>
                <dt>OAI identifier</dt><dd className="mono">{current.oai_id}</dd>
                <dt>Record page</dt><dd>{current.landing_page ? <a href={current.landing_page} target="_blank" rel="noopener">open in the repository</a> : "–"}</dd>
              </dl>
              <h3>Findings</h3>
              {current.findings.length === 0 && <p>No findings. This record passes every check.</p>}
              {current.findings.map((f, n) => (
                <div key={n} className={`finding ${f.severity}`}>
                  <p><span className={`sev ${f.severity}`}>{f.severity}</span> <b>{ruleById[f.rule]?.title}</b> <span className="muted">({f.rule})</span></p>
                  <p className="muted">{ruleById[f.rule]?.why}</p>
                  {f.detail && <p>Found: <code>{f.detail}</code></p>}
                  {f.suggestion && (
                    <div className="fix">suggest {f.suggestion.field}: {f.suggestion.from ? <>{f.suggestion.from} → </> : "add "}{f.suggestion.to}</div>
                  )}
                </div>
              ))}
              <details>
                <summary>Schema.org JSON-LD</summary>
                <pre className="code">{JSON.stringify(current.jsonld, null, 2)}</pre>
              </details>
              <details>
                <summary>Original Dublin Core (oai_dc)</summary>
                <pre className="code">{Object.entries(current.dc).map(([k, vs]) => vs.map((v) => `dc:${k}  ${v}`).join("\n")).join("\n")}</pre>
              </details>
            </>
          )}
        </aside>
      </div>
    </Layout>
  );
}
