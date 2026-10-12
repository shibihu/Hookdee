import "server-only";

import { parseServerEnv, type ServerEnv } from "./env-schema";

export function getServerEnv(): ServerEnv {
  return parseServerEnv(process.env);
}
