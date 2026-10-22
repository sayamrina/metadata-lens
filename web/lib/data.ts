export type Finding = {
  rule: string;
  severity: "error" | "warning" | "info";
  detail: string;
  suggestion: { field: string; from: string | null; to: string; why: string } | null;
};
export type FieldState = "ok" | "missing" | "problem";
export type Item = {
  id: string; source: string; oai_id: string; datestamp: string; title: string; creators: string[];
  year: string | null; dois: string[]; type: string | null; access: string | null; licence: string | null;
  publisher: string | null; landing_page: string | null; score: number; findings: Finding[];
  dc: Record<string, string[]>; jsonld: Record<string, unknown>; fields: Record<string, FieldState>; duplicate: boolean;
};
export type SourceSummary = {
  name: string; homepage: string; endpoint: string; set: string | null; records: number; mean_score: number;
  rule_counts: Record<string, number>; completeness: Record<string, number>; with_doi: number; open_access: number;
};
export type Summary = {
  generated: string; records: number; triples: number; duplicates: number;
  sources: Record<string, SourceSummary>; harvest: { since: string; limit_per_source: number };
};
export type Rule = { id: string; field: string; severity: Finding["severity"]; title: string; why: string };
export type DuplicateGroup = { match: "doi" | "title"; key: string; records: string[]; sources: string[] };
export type PublisherGroup = { preferred: string; variants: { name: string; count: number }[] };

export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const FIELDS = ["title", "creator", "date", "identifier", "rights", "type", "language", "description", "subject", "publisher"];
export const FIELD_LABEL: Record<string, string> = {
  title: "Title", creator: "Creator", date: "Date", identifier: "Identifier (DOI)", rights: "Rights and licence",
  type: "Publication type", language: "Language", description: "Abstract", subject: "Subject", publisher: "Publisher",
};

const cache = new Map<string, Promise<unknown>>();
export function load<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    cache.set(name, fetch(`${BASE}/data/${name}`).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${name} (${r.status})`);
      return name.endsWith(".json") ? r.json() : r.text();
    }));
  }
  return cache.get(name) as Promise<T>;
}

export const fmtPct = (x: number) => `${Math.round(x * 100)} %`;
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
