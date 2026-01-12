import type { Handler } from "@netlify/functions";
import { supabaseAnon, supabaseService } from "./_supabase";

type SupplierPayload = {
  id?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
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

    const { data: profile, error: profileError } = await supabaseService
      .from("profiles")
      .select("role")
      .eq("user_id", authData.user.id)
      .single();

    if (profileError || !profile || profile.role === "cashier") {
      return jsonResponse(403, { error: "Not authorized." });
    }

    const payload = JSON.parse(event.body) as SupplierPayload;
    const name = payload.name?.trim();

    if (!name) {
      return jsonResponse(400, { error: "Name is required." });
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
        return jsonResponse(400, { error: error.message });
      }

      return jsonResponse(200, { status: "ok", supplier_id: payload.id });
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
      return jsonResponse(400, { error: error.message });
    }

    return jsonResponse(200, { status: "ok", supplier_id: data.id });
  } catch (error) {
    return jsonResponse(500, { error: "Unexpected server error." });
  }
};
