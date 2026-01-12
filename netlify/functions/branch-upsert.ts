import type { Handler } from "@netlify/functions";
import { supabaseAnon, supabaseService } from "./_supabase";

type BranchPayload = {
  id?: string;
  name?: string;
  is_default?: boolean;
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

    if (profileError || !profile || profile.role !== "admin") {
      return jsonResponse(403, { error: "Not authorized." });
    }

    const payload = JSON.parse(event.body) as BranchPayload;
    const name = payload.name?.trim();

    if (!name) {
      return jsonResponse(400, { error: "Name is required." });
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
        return jsonResponse(400, { error: error.message });
      }

      return jsonResponse(200, { status: "ok", branch_id: payload.id });
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
      return jsonResponse(400, { error: error.message });
    }

    return jsonResponse(200, { status: "ok", branch_id: data.id });
  } catch (error) {
    return jsonResponse(500, { error: "Unexpected server error." });
  }
};
