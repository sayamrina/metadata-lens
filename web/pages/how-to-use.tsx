import Link from "next/link";
import Layout from "../components/Layout";

export default function HowToUse() {
  return (
    <Layout title="How to use">
      <header className="page-head">
        <h1>How to use this app</h1>
        <p>Five minutes, no account and nothing to install. Everything runs in your browser on the latest harvest.</p>
      </header>
      <div className="prose">
        <ol className="steps">
          <li><b>Start with the <Link href="/">Overview</Link>.</b> The table shows, field by field, how many records are complete and valid in each repository. The panels list the most frequent findings; click one to see the records it affects.</li>
          <li><b>Read the strip.</b> Every record carries ten cells, one per Dublin Core field: filled means present and valid, amber means present with a finding, an empty outline means missing. Hover over a strip to read it field by field.</li>
          <li><b>Open <Link href="/records/">Records</Link>.</b> Search by title, author or DOI, or filter by repository, finding or score. Select a record to see each finding, why it matters, a proposed fix, the Schema.org JSON-LD and the original Dublin Core.</li>
          <li><b>Go to <Link href="/curation/">Curation</Link>.</b> Accept or reject the proposed fixes, for example canonical licence URIs or ISO dates. Export the accepted ones as JSON. The page also lists publisher spellings and possible duplicates.</li>
          <li><b>Query the <Link href="/graph/">Knowledge graph</Link>.</b> Click an example such as “Most frequent authors”, then change the SPARQL and run your own query. The engine runs locally in your browser.</li>
          <li><b>Check <Link href="/about/">About</Link></b> for the sources, the rules and the limits of this analysis.</li>
        </ol>
        <h2>Words used here</h2>
        <ul>
          <li><b>OAI-PMH</b>: the protocol repositories use to share their metadata with harvesters.</li>
          <li><b>Dublin Core (oai_dc)</b>: the simple, fifteen-field metadata format every OAI-PMH repository must offer.</li>
          <li><b>OpenAIRE guidelines</b>: European conventions for writing access rights, publication types and identifiers in Dublin Core.</li>
          <li><b>Schema.org and DCAT</b>: vocabularies for describing works on the web and catalogues of them.</li>
          <li><b>SPARQL</b>: the query language for knowledge graphs.</li>
        </ul>
        <h2>Run it yourself</h2>
        <pre className="code">{`git clone https://github.com/sayamrina/metadata-lens.git && cd metadata-lens
python -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
cd pipeline && ../.venv/bin/pytest -q
../.venv/bin/python -m metalens.pipeline --out ../web/public/data --since 2026-09-01 --limit 400
cd ../web && npm ci && npm run dev`}</pre>
      </div>
    </Layout>
  );
}
