import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="Metadata Lens harvests research publication metadata over OAI-PMH, checks its quality, maps it to Schema.org and DCAT and lets you query the knowledge graph with SPARQL." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%2315191f'/%3E%3Crect x='5' y='10' width='5' height='12' fill='%235cc3c8'/%3E%3Crect x='13.5' y='10' width='5' height='12' fill='%23e3a948'/%3E%3Crect x='22' y='10' width='5' height='12' fill='none' stroke='%235cc3c8' stroke-width='1.5'/%3E%3C/svg%3E" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
