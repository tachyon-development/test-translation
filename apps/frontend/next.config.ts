import type { NextConfig } from "next";
import path from "path";

const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // Standalone mode for Docker, not needed on Vercel
  ...(isVercel ? {} : {
    output: "standalone",
    outputFileTracingRoot: path.join(__dirname, "../../"),
  }),
  turbopack: {
    root: path.join(__dirname, "../../"),
  },
};

export default nextConfig;
