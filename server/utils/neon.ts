import { neon } from "@neondatabase/serverless";

export function useNeon(){
  const config = useRuntimeConfig();
  return neon(config.neonDatabaseUrl);
}