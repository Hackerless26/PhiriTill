import { Buffer } from "buffer";

export function getUserIdFromToken(token: string): string | null {
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
