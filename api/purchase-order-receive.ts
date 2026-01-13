import { createUserClient } from "./_supabase";
import getAuthToken, { parseBody } from "./_request";

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

  if (!payload.purchase_order_id) {
    return res.status(400).json({ error: "Purchase order ID is required." });
  }

  const supabaseUser = createUserClient(token);
  const { error } = await supabaseUser.rpc("receive_purchase_order", {
    p_purchase_order_id: payload.purchase_order_id,
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

  return res.status(200).json({ status: "ok" });
}
