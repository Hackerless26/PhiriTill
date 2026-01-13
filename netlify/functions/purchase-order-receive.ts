import type { Handler } from "@netlify/functions";
import { createUserClient } from "./_supabase";

type ReceivePayload = {
  purchase_order_id?: string;
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

    const payload = JSON.parse(event.body) as ReceivePayload;
    if (!payload.purchase_order_id) {
      return jsonResponse(400, { error: "Purchase order ID is required." });
    }

    const supabaseUser = createUserClient(token);
    const { error } = await supabaseUser.rpc("receive_purchase_order", {
      p_purchase_order_id: payload.purchase_order_id,
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

    return jsonResponse(200, { status: "ok" });
  } catch (error) {
    return jsonResponse(500, { error: "Unexpected server error." });
  }
};
