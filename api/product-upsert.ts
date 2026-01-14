import { createUserClient } from "./_supabase.js";
import getAuthToken, { parseBody } from "./_request.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const token = getAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing auth token." });
  }

  const payload = parseBody(req);
  if (!payload) {
    return res.status(400).json({ error: "Missing request body." });
  }

  const name = payload.name?.trim();
  if (!name) {
    return res.status(400).json({ error: "Name is required." });
  }

  if (payload.price == null || Number.isNaN(payload.price)) {
    return res.status(400).json({ error: "Price is required." });
  }

  const supabaseUser = createUserClient(token);
  const { data, error } = await supabaseUser.rpc("product_upsert", {
    p_id: payload.id ?? null,
    p_name: name,
    p_sku: payload.sku ?? null,
    p_barcode: payload.barcode ?? null,
    p_category: payload.category ?? null,
    p_price: payload.price,
    p_cost: payload.cost ?? null,
    p_stock_on_hand: payload.stock_on_hand ?? 0,
    p_low_stock_threshold: payload.low_stock_threshold ?? 0,
    p_is_active: payload.is_active ?? true,
    p_branch_id: payload.branch_id ?? null,
  });

  if (error) {
    const message = error.message || "Request failed.";
    if (message.includes("Not authenticated")) {
      return res.status(401).json({ error: message });
    }
    if (message.includes("Not allowed")) {
      return res.status(403).json({ error: message });
    }
    return res.status(400).json({ error: message });
  }

  return res.status(200).json({ status: "ok", product_id: data });
}

