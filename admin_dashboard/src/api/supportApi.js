const BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000")
  .trim()
  .replace(/\/+$/, "");
export async function supportApi(path, options = {}) {
  const headers = new Headers(options.headers);
  const method = (options.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method))
    headers.set("X-CMM-Request", "1");
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      data?.message || `Request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }
  if (!data) throw new Error("Backend did not return JSON.");
  return data;
}
export const supportJson = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
