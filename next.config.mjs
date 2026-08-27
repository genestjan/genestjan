/** @type {import('next').NextConfig} */
const nextConfig = {
  // GitHub Pages serves static files only, so export a fully static site.
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};
export default nextConfig;
