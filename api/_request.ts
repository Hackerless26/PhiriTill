function getAuthToken(req: any): string | null {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header) return null;
  return header.replace("Bearer ", "");
}

function parseBody(req: any) {
  if (!req.body) return null;
  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }
  return req.body;
}

export default getAuthToken;
export { parseBody };
