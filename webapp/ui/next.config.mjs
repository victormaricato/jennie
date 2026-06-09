/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export so the UI ships to Cloudflare Pages / GitHub Pages with DNS.
  output: "export",
  images: { unoptimized: true },
  // Set NEXT_PUBLIC_BASE_PATH=/zeroshot-mechanism-bench for project-page hosting.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
};

export default nextConfig;
