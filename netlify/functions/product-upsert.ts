import type { Handler } from "@netlify/functions";
import { createUserClient } from "./_supabase";

type ProductPayload = {
  id?: string;
  name?: string;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
  price?: number;
  cost?: number | null;
  stock_on_hand?: number;
  low_stock_threshold?: number;
  is_active?: boolean;
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

    const payload = JSON.parse(event.body) as ProductPayload;
    const name = payload.name?.trim();

    if (!name) {
      return jsonResponse(400, { error: "Name is required." });
    }

    if (payload.price == null || Number.isNaN(payload.price)) {
      return jsonResponse(400, { error: "Price is required." });
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
        return jsonResponse(401, { error: message });
      }
      if (message.includes("Not allowed")) {
        return jsonResponse(403, { error: message });
      }
      return jsonResponse(400, { error: message });
    }

    return jsonResponse(200, { status: "ok", product_id: data });
  } catch (error) {
    return jsonResponse(500, { error: "Unexpected server error." });
  }
};
