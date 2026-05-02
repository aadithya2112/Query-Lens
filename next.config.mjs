/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.9.138.27"],
  images: {
    unoptimized: true,
    qualities: [75, 100],
  },
}

export default nextConfig
