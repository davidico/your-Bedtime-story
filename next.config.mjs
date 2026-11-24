/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',          // genera un sitio estático en /out (lo sirve el Worker como assets)
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
