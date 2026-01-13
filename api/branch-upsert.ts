import { supabaseService } from "./_supabase";
import { getUserIdFromToken } from "./_auth";
import getAuthToken, { parseBody } from "./_request";

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

  if (profileError || !profile || profile.role !== "admin") {
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
      .from("branches")
      .update({
        name,
        is_default: payload.is_default ?? false,
      })
      .eq("id", payload.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ status: "ok", branch_id: payload.id });
  }

  if (payload.is_default) {
    await supabaseService.from("branches").update({ is_default: false });
  }

  const { data, error } = await supabaseService
    .from("branches")
    .insert({
      name,
      is_default: payload.is_default ?? false,
    })
    .select("id")
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ status: "ok", branch_id: data.id });
}
