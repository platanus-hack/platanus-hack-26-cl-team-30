import { createBrowserClient } from "@supabase/ssr";

// Cliente para componentes del navegador. Usa la clave publicable, así que
// toda tabla necesita RLS activado antes de guardar datos reales.
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local");
  }
  return createBrowserClient(url, key);
}
