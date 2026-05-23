import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.tsx");

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@auth/drizzle-adapter"],
};

export default withNextIntl(nextConfig);