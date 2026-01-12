import type { Handler } from "@netlify/functions";
import { createUserClient, supabaseAnon } from "./_supabase";

type CheckoutItem = {
  product_id: string;
  quantity: number;
  price?: number;
};

type CheckoutPayload = {
  payment_method: string;
  items: CheckoutItem[];
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

    const { data: authData, error: authError } =
      await supabaseAnon.auth.getUser(token);

    if (authError || !authData.user) {
      return jsonResponse(401, { error: "Invalid auth token." });
    }

    const payload = JSON.parse(event.body) as CheckoutPayload;
    const paymentMethod = payload.payment_method?.trim();
    const items = payload.items ?? [];

    if (!paymentMethod) {
      return jsonResponse(400, { error: "Payment method is required." });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return jsonResponse(400, { error: "At least one item is required." });
    }

    const supabaseUser = createUserClient(token);
    const { data, error } = await supabaseUser.rpc("checkout_sale", {
      p_payment_method: paymentMethod,
      p_items: items,
      p_branch_id: payload.branch_id ?? null,
    });

    if (error) {
      return jsonResponse(400, { error: error.message });
    }

    return jsonResponse(200, { sale: data?.[0] });
  } catch (error) {
    return jsonResponse(500, { error: "Unexpected server error." });
  }
};
