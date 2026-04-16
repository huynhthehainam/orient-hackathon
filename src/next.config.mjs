/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/admin/default",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
