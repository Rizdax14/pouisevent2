// lib/insta/supabase.js
const SUPABASE_URL = "https://daerxouhvmvqhirgyrjr.supabase.co";
function key() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  return k;
}
// Legacy service_role keys are JWTs and go in both headers; new `sb_secret_…` keys must only be sent as `apikey`.
function authHeaders() {
  const k = key();
  return k.startsWith("eyJ") ? { apikey: k, Authorization: `Bearer ${k}` } : { apikey: k };
}
async function sbGet(table, query = "") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, { headers: authHeaders() });
  if (!r.ok) throw new Error(`${table} ${r.status}: ${await r.text()}`);
  return r.json();
}
async function sbWrite(method, table, query, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query || ""}`, {
    method,
    headers: { ...authHeaders(), "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${table} ${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
function publicUrl(bucket, path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
module.exports = { SUPABASE_URL, sbGet, sbWrite, publicUrl, serviceKey: key, authHeaders };
