/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',          // genera un sitio estático en /out (Cloudflare Pages)
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
