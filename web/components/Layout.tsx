import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

const NAV = [
  ["/", "Overview"], ["/records/", "Records"], ["/curation/", "Curation"], ["/graph/", "Knowledge graph"],
  ["/how-to-use/", "How to use"], ["/about/", "About"],
] as const;

export default function Layout({ title, children }: { title: string; children: ReactNode }) {
  const { pathname } = useRouter();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));
  return (
    <>
      <Head><title>{title === "Overview" ? "Metadata Lens" : `${title} · Metadata Lens`}</title></Head>
      <header className="top">
        <div className="wrap top-row">
          <Link href="/" className="brand">Metadata Lens</Link>
          <nav aria-label="Main">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}>{label}</Link>
            ))}
          </nav>
        </div>
      </header>
      <aside className="project-popup" aria-label="Portfolio project">
        <span className="project-popup-badge" aria-hidden="true">★</span>
        <span>This app was developed by Amrina as part of a portfolio.</span>
        <a href="https://sayamrina.github.io/" target="_blank" rel="noopener">View the portfolio →</a>
      </aside>
      <main className="wrap">{children}</main>
      <footer className="wrap foot">
        Metadata Lens, an independent project by Amrina. Data: public OAI-PMH metadata from JuSER and KITopen.
        Not affiliated with Forschungszentrum Jülich, KIT or the Helmholtz Association.
      </footer>
    </>
  );
}
