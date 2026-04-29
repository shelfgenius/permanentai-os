import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client singleton.
 *
 * Project: mpzvaicxzbnfocytwpxk
 *
 * The anon key / URL should be provided via build env vars in production.
 * For local development, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in
 * `.env.local`. We fall back to the project ref so the client can still
 * construct — runtime calls will fail gracefully if no key is provided.
 */
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || 'https://mpzvaicxzbnfocytwpxk.supabase.co';
// Publishable (anon) key — safe to ship in the browser bundle. RLS policies
// on `tunnel_registry` limit anon to SELECT only; writes require the
// service_role key which is never exposed to the client.
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_t6nWUP1Fj45JNR7yLM8wIw_bvHakKk-';

export const supabase = SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: { params: { eventsPerSecond: 4 } },
    })
  : null;

export async function getSessionSafe() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data?.session ?? null;
  } catch {
    return null;
  }
}

export async function ensureProfile(user) {
  if (!supabase || !user?.id) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (!error && data) return data;
    const payload = {
      id: user.id,
      username: user.user_metadata?.user_name || user.user_metadata?.name || user.email?.split('@')[0] || 'operator',
      preferred_domain: 'general',
    };
    const { data: created } = await supabase
      .from('profiles')
      .upsert(payload)
      .select('*')
      .single();
    return created ?? payload;
  } catch {
    return null;
  }
}

/** Returns true only for real cloudflare tunnel / local backend URLs */
function isValidTunnelUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('trycloudflare.com') ||
    url.includes('cfargotunnel.com') ||
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    /https?:\/\/192\.168\.\d+\.\d+/.test(url)
  );
}

/**
 * Fetches the latest tunnel URL published to Supabase by auto_tunnel.py.
 * Returns null if Supabase isn't configured, URL is invalid, or row is stale (>6 h).
 */
export async function fetchTunnelUrlFromSupabase() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('tunnel_registry')
      .select('url, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.url) return null;

    // Reject bad / informational URLs (e.g. www.cloudflare.com)
    if (!isValidTunnelUrl(data.url)) return null;

    // Quick-tunnels expire — skip entries older than 6 h
    if (data.updated_at) {
      const ageMs = Date.now() - new Date(data.updated_at).getTime();
      if (ageMs > 6 * 60 * 60 * 1000) return null;
    }

    return data.url;
  } catch {
    return null;
  }
}

/**
 * Subscribe to realtime tunnel URL updates. Returns unsubscribe fn.
 */
export function subscribeTunnelUrl(onUrl) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('tunnel_registry_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tunnel_registry' },
      (payload) => {
        const url = payload?.new?.url;
        if (isValidTunnelUrl(url)) onUrl(url);
      },
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
