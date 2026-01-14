import { createClient } from "@supabase/supabase-js";

const requireEnv = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing Supabase environment variable: ${name}`);
  }
  return value;
};

const supabaseUrl = requireEnv(process.env.SUPABASE_URL, "SUPABASE_URL");
const supabaseAnonKey = requireEnv(
  process.env.SUPABASE_ANON_KEY,
  "SUPABASE_ANON_KEY"
);
const supabaseServiceRoleKey = requireEnv(
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  "SUPABASE_SERVICE_ROLE_KEY"
);

export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export function createUserClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export const supabaseService = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
