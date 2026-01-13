import type { Handler } from "@netlify/functions";
import { createUserClient } from "./_supabase";

type PurchaseOrderPayload = {
  supplier_id?: string;
  reference?: string | null;
  items?: { product_id: string; quantity: number; cost?: number }[];
  branch_id?: string;
};

function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  try {
    if (!event.body) {
      return jsonResponse(400, { error: "Missing request body." });
    }

    const authHeader =
      event.headers.authorization || event.headers.Authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return jsonResponse(401, { error: "Missing auth token." });
    }

    const payload = JSON.parse(event.body) as PurchaseOrderPayload;

    if (!payload.supplier_id) {
      return jsonResponse(400, { error: "Supplier is required." });
    }

    if (!payload.items || !payload.items.length) {
      return jsonResponse(400, { error: "At least one item is required." });
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
        return jsonResponse(401, { error: message });
      }
      if (message.includes("Not allowed")) {
        return jsonResponse(403, { error: message });
      }
      return jsonResponse(400, { error: message });
    }

    return jsonResponse(200, {
      status: "ok",
      purchase_order_id: data,
    });
  } catch (error) {
    return jsonResponse(500, { error: "Unexpected server error." });
  }
};
