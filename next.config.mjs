/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/annotation',
  reactStrictMode: false,
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/lib/webviewer/:all*", // path to your WASM and related files
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          // Allow CORs for your WASM files if needed:
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;

