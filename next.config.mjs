/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // إخراج مستقل لتشغيل أخف داخل Docker
  output: "standalone",
};

export default nextConfig;
