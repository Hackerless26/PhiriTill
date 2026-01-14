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

  if (!payload.supplier_id) {
    return res.status(400).json({ error: "Supplier is required." });
  }

  if (!payload.items || !payload.items.length) {
    return res.status(400).json({ error: "At least one item is required." });
  }

  const supabaseUser = createUserClient(token);
  const { data, error } = await supabaseUser.rpc("create_purchase_order", {
    p_supplier_id: payload.supplier_id,
    p_reference: payload.reference ?? null,
    p_items: payload.items,
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

  return res.status(200).json({
    status: "ok",
    purchase_order_id: data,
  });
}

