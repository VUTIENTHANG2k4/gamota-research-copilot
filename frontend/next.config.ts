import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // All data is fetched in the browser from the FastAPI backend (NEXT_PUBLIC_API_URL).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
