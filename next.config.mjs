/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hide the floating Next.js "N" badge so mobile screenshots stay clean.
  devIndicators: false,
  eslint: {
    // `pnpm lint` is the real lint gate over the active surface. The copied
    // Sui/multisig modules are removed by T007 before they rejoin lint.
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
