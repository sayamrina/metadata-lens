/** Static export: the whole app is plain files served from GitHub Pages; SPARQL runs in the browser (Oxigraph/WASM). */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

module.exports = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};
