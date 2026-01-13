import { Buffer } from "buffer";
import type { Handler } from "@netlify/functions";
import { supabaseService } from "./_supabase";

type SupplierDeletePayload = {
  id?: string;
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

function getUserIdFromToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = parts[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), "=");
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    return typeof decoded.sub === "string" ? decoded.sub : null;
  } catch {
    return null;
  }
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

    const userId = getUserIdFromToken(token);
    if (!userId) {
      return jsonResponse(401, { error: "Invalid auth token." });
    }

    const { data: profile, error: profileError } = await supabaseService
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile || profile.role === "cashier") {
      return jsonResponse(403, { error: "Not authorized." });
    }

    const payload = JSON.parse(event.body) as SupplierDeletePayload;

    if (!payload.id) {
      return jsonResponse(400, { error: "Supplier ID is required." });
    }

    const { error } = await supabaseService
      .from("suppliers")
      .delete()
      .eq("id", payload.id);

    if (error) {
      return jsonResponse(400, { error: error.message });
    }

    return jsonResponse(200, { status: "ok" });
  } catch (error) {
    return jsonResponse(500, { error: "Unexpected server error." });
  }
};
