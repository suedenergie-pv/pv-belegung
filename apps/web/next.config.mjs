/** @type {import('next').NextConfig} */
const nextConfig = {
  // Engine wird als TS-Quelle aus dem Workspace importiert
  transpilePackages: ['@pv-belegung/engine'],
};

export default nextConfig;
