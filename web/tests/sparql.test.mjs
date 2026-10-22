// Runs every example query of the Knowledge graph page against the generated graph with Oxigraph (Node build).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import oxigraph from "oxigraph";

const queries = JSON.parse(readFileSync(new URL("../lib/queries.json", import.meta.url)));
const ttl = readFileSync(new URL("../public/data/graph.ttl", import.meta.url), "utf8");
const store = new oxigraph.Store();
store.load(ttl, { format: "text/turtle", base_iri: "https://sayamrina.github.io/metadata-lens/" });

test("graph has catalogues and works", () => {
  assert.ok(store.size > 1000, `only ${store.size} triples`);
  const rows = store.query(`${queries.prefixes}SELECT (COUNT(?c) AS ?n) WHERE { ?c a dcat:Catalog }`);
  assert.equal(Number(rows[0].get("n").value), 2);
});

for (const ex of queries.examples) {
  test(`example query runs: ${ex.label}`, () => {
    const rows = store.query(queries.prefixes + ex.query);
    assert.ok(Array.isArray(rows), "SELECT returns rows");
  });
}
