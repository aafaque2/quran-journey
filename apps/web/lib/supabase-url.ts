/**
 * SUPABASE_URL should be the project URL, https://<ref>.supabase.co. Supabase's dashboard also shows
 * the REST endpoint (…/rest/v1/), which is easy to paste instead. The app adds /rest/v1 itself, so
 * that part (and anything after it) is dropped here; with it doubled, Supabase answers PGRST125
 * "Invalid path specified in request URL".
 */
export function supabaseProjectUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/rest\/v1(?:\/.*)?$/, "")
    .replace(/\/+$/, "");
}
