import type { NextConfig } from "next";

const staticExport = process.env.NEXT_STATIC_EXPORT === "true";
const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "stellation-2d";
const basePath = staticExport ? `/${repository}` : "";

const nextConfig: NextConfig = {
  output: staticExport ? "export" : undefined,
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: staticExport,
  images: {
    unoptimized: true,
  },
  typescript: {
    tsconfigPath: staticExport ? "./tsconfig.pages.json" : "./tsconfig.json",
  },
};

export default nextConfig;
