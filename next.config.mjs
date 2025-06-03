/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true // ← tell <Image> to render a plain <img>
  },
  output: 'export',
  reactStrictMode: true
};
export default nextConfig;