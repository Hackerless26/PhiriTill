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

  const name = payload.name?.trim();
  if (!name) {
    return res.status(400).json({ error: "Name is required." });
  }

  if (payload.id) {
    const { error } = await supabaseService
      .from("suppliers")
      .update({
        name,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
      })
      .eq("id", payload.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ status: "ok", supplier_id: payload.id });
  }

  const { data, error } = await supabaseService
    .from("suppliers")
    .insert({
      name,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ status: "ok", supplier_id: data.id });
}

