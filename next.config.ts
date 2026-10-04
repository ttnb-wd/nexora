import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Recovery URLs contain bearer tokens. Never print incoming URLs or server
  // action arguments (which may include passwords) in development either.
  logging: { incomingRequests: false, serverFunctions: false, browserToTerminal: false },
};

export default nextConfig;
