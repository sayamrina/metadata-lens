import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import { load, type Summary } from "../lib/data";

import QUERIES from "../lib/queries.json";

const EXAMPLES = QUERIES.examples.map((x) => ({ label: x.label, query: QUERIES.prefixes + x.query }));

type Store = import("oxigraph/web.js").Store;
type Term = { termType: string; value: string };

export default function Graph() {
  const store = useRef<Store | null>(null);
  const [status, setStatus] = useState("Loading the knowledge graph …");
  const [query, setQuery] = useState(EXAMPLES[0].query);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [vars, setVars] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [ms, setMs] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ox, ttl, s] = await Promise.all([import("oxigraph/web.js"), load<string>("graph.ttl"), load<Summary>("summary.json")]);
        await ox.default();
        const st = new ox.Store();
        st.load(ttl, { format: "text/turtle", base_iri: "https://sayamrina.github.io/metadata-lens/" });
        if (!alive) return;
        store.current = st;
        setSummary(s);
        setStatus(`${st.size.toLocaleString("en")} triples loaded in your browser.`);
        run(EXAMPLES[0].query);
      } catch (e) {
        setStatus("");
        setErr(`The graph could not be loaded: ${String(e)}`);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function run(q: string) {
    if (!store.current) return;
    setErr("");
    const t0 = performance.now();
    try {
      const res = store.current.query(q);
      if (!Array.isArray(res) || (res.length && !(res[0] instanceof Map))) {
        setVars([]);
        setRows([]);
        setErr("Only SELECT queries are shown as a table here.");
        return;
      }
      const maps = res as Map<string, Term>[];
      const v = [...new Set(maps.flatMap((m) => [...m.keys()]))];
      setVars(v);
      setRows(maps.slice(0, 500).map((m) => Object.fromEntries(v.map((k) => [k, m.get(k)?.value ?? ""]))));
      setMs(Math.round(performance.now() - t0));
    } catch (e) {
      setErr(String(e));
      setRows([]);
    }
  }

  return (
    <Layout title="Knowledge graph">
      <header className="page-head">
        <h1>Knowledge graph</h1>
        <p>All records as an RDF graph: works and people in Schema.org, each repository as a DCAT catalogue whose catalogue
          records point to the works. The graph is loaded into Oxigraph, a SPARQL engine that runs in your browser.</p>
      </header>
      <p className="muted" style={{ fontSize: 14 }}>{status}{summary && <> Download it as <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/graph.ttl`}>Turtle</a>.</>}</p>
      <div className="examples" aria-label="Example queries">
        {EXAMPLES.map((x) => (
          <button key={x.label} onClick={() => { setQuery(x.query); run(x.query); }}>{x.label}</button>
        ))}
      </div>
      <label htmlFor="q" className="muted" style={{ fontSize: 14 }}>SPARQL query</label>
      <textarea id="q" className="sparql" spellCheck={false} value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="actions" style={{ marginTop: 8 }}>
        <button className="btn solid" disabled={!store.current} onClick={() => run(query)}>Run query</button>
        {ms !== null && !err && <span className="muted" style={{ fontSize: 14 }}>{rows.length} rows in {ms} ms</span>}
      </div>
      {err && <p className="error-box" role="alert">{err}</p>}
      {rows.length > 0 && (
        <div className="results">
          <table>
            <thead><tr>{vars.map((v) => <th key={v}>{v}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>{vars.map((v) => <td key={v}>{r[v].startsWith("http") ? <a href={r[v]} target="_blank" rel="noopener">{r[v]}</a> : r[v]}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
