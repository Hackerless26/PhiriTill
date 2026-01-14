import { supabaseService } from "./_supabase.js";
import { getUserIdFromToken } from "./_auth.js";
import getAuthToken, { parseBody } from "./_request.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const token = getAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing auth token." });
  }

  const userId = getUserIdFromToken(token);
  if (!userId) {
    return res.status(401).json({ error: "Invalid auth token." });
  }

  const { data: profile, error: profileError } = await supabaseService
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (profileError || !profile || profile.role === "cashier") {
    return res.status(403).json({ error: "Not authorized." });
  }

  const payload = parseBody(req);
  if (!payload) {
    return res.status(400).json({ error: "Missing request body." });
  }

  if (!payload.id) {
    return res.status(400).json({ error: "Supplier ID is required." });
  }

  const { error } = await supabaseService
    .from("suppliers")
    .delete()
    .eq("id", payload.id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ status: "ok" });
}

