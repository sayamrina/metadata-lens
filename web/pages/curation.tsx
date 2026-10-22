import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { load, type DuplicateGroup, type Item, type PublisherGroup, type Rule } from "../lib/data";

type Decision = "accepted" | "rejected";
const KEY = "metadata-lens-decisions";

function readDecisions(): Record<string, Decision> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export default function Curation() {
  const [items, setItems] = useState<Item[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [dupes, setDupes] = useState<DuplicateGroup[]>([]);
  const [pubs, setPubs] = useState<PublisherGroup[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [ruleFilter, setRuleFilter] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([load<Item[]>("records.json"), load<Rule[]>("rules.json"), load<DuplicateGroup[]>("duplicates.json"),
      load<PublisherGroup[]>("publishers.json")])
      .then(([a, b, c, d]) => { setItems(a); setRules(b); setDupes(c); setPubs(d); })
      .catch((e) => setErr(String(e)));
    setDecisions(readDecisions());
  }, []);

  const suggestions = useMemo(() => items.flatMap((i) => i.findings
    .filter((f) => f.suggestion)
    .map((f, n) => ({ key: `${i.id}#${f.rule}#${n}`, item: i, finding: f }))), [items]);
  const visible = suggestions.filter((s) => !ruleFilter || s.finding.rule === ruleFilter);
  const ruleIds = [...new Set(suggestions.map((s) => s.finding.rule))];
  const ruleById = Object.fromEntries(rules.map((r) => [r.id, r]));
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  function decide(key: string, d: Decision | null) {
    const next = { ...decisions };
    if (d) next[key] = d; else delete next[key];
    setDecisions(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: decisions stay in memory */ }
  }

  function exportAccepted() {
    const rows = suggestions.filter((s) => decisions[s.key] === "accepted").map((s) => ({
      oai_identifier: s.item.oai_id, rule: s.finding.rule, field: s.finding.suggestion!.field,
      from: s.finding.suggestion!.from, to: s.finding.suggestion!.to, reason: s.finding.suggestion!.why,
    }));
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "metadata-lens-accepted-fixes.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const accepted = suggestions.filter((s) => decisions[s.key] === "accepted").length;
  const rejected = suggestions.filter((s) => decisions[s.key] === "rejected").length;

  return (
    <Layout title="Curation">
      <header className="page-head">
        <h1>Curation</h1>
        <p>Fixes the checks can propose with confidence, possible duplicates and publisher spellings. Nothing changes
          automatically: you accept or reject each proposal and export the accepted ones as a list for the repository team.</p>
      </header>
      {err && <p className="error-box">{err}</p>}

      <h2>Proposed fixes</h2>
      <div className="actions" style={{ margin: "6px 0 12px" }}>
        <label className="muted filters" style={{ fontSize: 14, margin: 0 }}>Show{" "}
          <select value={ruleFilter} onChange={(e) => setRuleFilter(e.target.value)}>
            <option value="">all {suggestions.length} proposals</option>
            {ruleIds.map((r) => <option key={r} value={r}>{ruleById[r]?.title} ({suggestions.filter((s) => s.finding.rule === r).length})</option>)}
          </select>
        </label>
        <span className="muted" style={{ fontSize: 14 }}>{accepted} accepted · {rejected} rejected</span>
        <button className="btn solid small" disabled={!accepted} onClick={exportAccepted}>Export accepted fixes (JSON)</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Record</th><th>Proposal</th><th className="hide-sm">Reason</th><th>Decision</th></tr></thead>
          <tbody>
            {visible.slice(0, 80).map((s) => (
              <tr key={s.key}>
                <td style={{ maxWidth: 280 }}><Link href={`/records/?id=${encodeURIComponent(s.item.id)}`}>{s.item.title.slice(0, 80)}</Link>
                  <div className="muted" style={{ fontSize: 13 }}>{s.item.source.toUpperCase()} · {ruleById[s.finding.rule]?.title}</div></td>
                <td><div className="fix">{s.finding.suggestion!.field}: {s.finding.suggestion!.from ? <>{s.finding.suggestion!.from} → </> : "add "}{s.finding.suggestion!.to}</div></td>
                <td className="hide-sm muted" style={{ fontSize: 14 }}>{s.finding.suggestion!.why}</td>
                <td>
                  {decisions[s.key] ? (
                    <span className="actions"><span className={`sev ${decisions[s.key] === "accepted" ? "info" : "warning"}`}>{decisions[s.key]}</span>
                      <button className="btn small" onClick={() => decide(s.key, null)}>Undo</button></span>
                  ) : (
                    <span className="actions">
                      <button className="btn small solid" onClick={() => decide(s.key, "accepted")}>Accept</button>
                      <button className="btn small" onClick={() => decide(s.key, "rejected")}>Reject</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length > 80 && <p className="muted" style={{ fontSize: 14 }}>Showing the first 80 of {visible.length}. Filter by finding to see others.</p>}
      <p className="muted" style={{ fontSize: 14 }}>Decisions are saved in this browser only.</p>

      <h2>Publisher spellings</h2>
      <p className="sub">Names that differ only by legal form or wording. Using one spelling makes counting and linking by publisher reliable.</p>
      <table>
        <thead><tr><th>Suggested name</th><th>Spellings found (records)</th></tr></thead>
        <tbody>
          {pubs.map((g) => (
            <tr key={g.preferred}><td><b>{g.preferred}</b></td><td>{g.variants.map((v) => `${v.name} (${v.count})`).join(" · ")}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Possible duplicates</h2>
      <p className="sub">Records with the same DOI, or the same title and year after normalisation, within or across repositories.</p>
      {dupes.length === 0 && <p>No duplicates in this harvest.</p>}
      {dupes.map((g) => (
        <div className="panel" key={g.records.join()} style={{ marginBottom: 12 }}>
          <p style={{ margin: "0 0 6px" }}><span className="sev info">same {g.match === "doi" ? "DOI" : "title and year"}</span> <code>{g.key}</code></p>
          <ul style={{ margin: 0 }}>
            {g.records.map((id) => <li key={id}><Link href={`/records/?id=${encodeURIComponent(id)}`}>{byId[id]?.title ?? id}</Link> <span className="muted">({byId[id]?.oai_id})</span></li>)}
          </ul>
        </div>
      ))}
    </Layout>
  );
}
