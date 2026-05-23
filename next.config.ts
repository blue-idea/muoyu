import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@auth/drizzle-adapter"],
};

export default nextConfig;
