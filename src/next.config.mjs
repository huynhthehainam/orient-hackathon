/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      {
        source: "/admin/dashboard",
        destination: "/admin/dashboard/default",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
