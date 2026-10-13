import { loadEnvConfig } from "@next/env";

export function loadLocalEnv(): void {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
}

loadLocalEnv();
