import type { Handler } from "@netlify/functions";
import { createUserClient, supabaseAnon } from "./_supabase";

type ReturnPayload = {
  return_type?: "customer" | "supplier";
  reason?: string | null;
  items?: { product_id: string; quantity: number; price?: number }[];
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

    const payload = JSON.parse(event.body) as ReturnPayload;

    if (!payload.return_type) {
      return jsonResponse(400, { error: "Return type is required." });
    }

    if (!payload.items || !payload.items.length) {
      return jsonResponse(400, { error: "At least one item is required." });
    }

    const supabaseUser = createUserClient(token);
    const { data, error } = await supabaseUser.rpc("process_return", {
      p_return_type: payload.return_type,
      p_reason: payload.reason ?? null,
      p_items: payload.items,
      p_branch_id: payload.branch_id ?? null,
    });

    if (error) {
      return jsonResponse(400, { error: error.message });
    }

    return jsonResponse(200, { status: "ok", return_id: data });
  } catch (error) {
    return jsonResponse(500, { error: "Unexpected server error." });
  }
};
