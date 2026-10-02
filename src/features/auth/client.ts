"use client";
import { createAuthClient } from "better-auth/react";
// Same-origin requests; server-only environment variables never enter the client bundle.
export const authClient = createAuthClient();
