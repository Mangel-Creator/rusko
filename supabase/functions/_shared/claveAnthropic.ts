// Clave de Anthropic de los secretos de Supabase. Vale con cualquiera de los dos nombres
// (el usuario la guardó como CLAVE_ANTRHOPIC, con la errata, el 28/10/2026).
export const CLAVE_ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAVE_ANTRHOPIC') || '';
