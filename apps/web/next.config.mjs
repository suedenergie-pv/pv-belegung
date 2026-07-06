/** @type {import('next').NextConfig} */
const nextConfig = {
  // Engine wird als TS-Quelle aus dem Workspace importiert
  transpilePackages: ['@pv-belegung/engine'],
  // GitHub-Pages-Build (CI setzt STATIC_EXPORT=1): statischer Export unter /pv-belegung.
  // Lokal (dev/build ohne Env) bleibt alles wie bisher, inkl. debug-shot-Route.
  ...(process.env.STATIC_EXPORT
    ? {
        output: 'export',
        basePath: process.env.PAGES_BASE_PATH ?? '',
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
