/**
 * Supabase data helpers — playlists, history, invite codes, global settings.
 * All operations are scoped to the current authenticated user via RLS.
 */
import { supabase, getSessionSafe } from './supabase.js';

// ── Helpers ──────────────────────────────────────────────
async function uid() {
  const s = await getSessionSafe();
  return s?.user?.id || null;
}

function rng(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(b => chars[b % chars.length]).join('');
}

// ══════════════════════════════════════════════════════════
//  PLAYLISTS
// ══════════════════════════════════════════════════════════

export async function fetchPlaylists() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) { console.error('fetchPlaylists', error); return []; }
  return data || [];
}

export async function createPlaylist(name, tracks = []) {
  if (!supabase) return null;
  const id = await uid();
  if (!id) return null;
  const { data, error } = await supabase
    .from('playlists')
    .insert({ user_id: id, name, tracks })
    .select('*')
    .single();
  if (error) { console.error('createPlaylist', error); return null; }
  return data;
}

export async function updatePlaylist(playlistId, patch) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('playlists')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', playlistId)
    .select('*')
    .single();
  if (error) { console.error('updatePlaylist', error); return null; }
  return data;
}

export async function deletePlaylist(playlistId) {
  if (!supabase) return false;
  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId);
  if (error) { console.error('deletePlaylist', error); return false; }
  return true;
}

// ══════════════════════════════════════════════════════════
//  HISTORY
// ══════════════════════════════════════════════════════════

export async function addHistory(product, action, title, metadata = {}) {
  if (!supabase) return null;
  const id = await uid();
  if (!id) return null;
  const { data, error } = await supabase
    .from('history')
    .insert({ user_id: id, product, action, title, metadata })
    .select('*')
    .single();
  if (error) console.error('addHistory', error);
  return data;
}

export async function fetchHistory(product = null, limit = 50) {
  if (!supabase) return [];
  let q = supabase
    .from('history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (product) q = q.eq('product', product);
  const { data, error } = await q;
  if (error) { console.error('fetchHistory', error); return []; }
  return data || [];
}

export async function clearHistory(product = null) {
  if (!supabase) return false;
  const id = await uid();
  if (!id) return false;
  let q = supabase.from('history').delete().eq('user_id', id);
  if (product) q = q.eq('product', product);
  const { error } = await q;
  if (error) { console.error('clearHistory', error); return false; }
  return true;
}

// ══════════════════════════════════════════════════════════
//  INVITE CODES
// ══════════════════════════════════════════════════════════

export async function generateInviteCode() {
  if (!supabase) return null;
  const id = await uid();
  if (!id) return null;
  const code = `PAI-${rng(4)}-${rng(4)}`;
  const { data, error } = await supabase
    .from('invite_codes')
    .insert({ code, created_by: id })
    .select('*')
    .single();
  if (error) { console.error('generateInviteCode', error); return null; }
  return data;
}

export async function fetchMyInviteCodes() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchMyInviteCodes', error); return []; }
  return data || [];
}

export async function validateInviteCode(code) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .is('used_by', null)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function redeemInviteCode(code) {
  if (!supabase) return false;
  const id = await uid();
  if (!id) return false;
  const { error } = await supabase
    .from('invite_codes')
    .update({ used_by: id, used_at: new Date().toISOString() })
    .eq('code', code.trim().toUpperCase())
    .is('used_by', null);
  if (error) { console.error('redeemInviteCode', error); return false; }
  return true;
}

// ══════════════════════════════════════════════════════════
//  GLOBAL SETTINGS (backend_url)
// ══════════════════════════════════════════════════════════

export async function fetchGlobalSetting(key) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('global_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) { console.error('fetchGlobalSetting', error); return null; }
  return data?.value || null;
}

export async function setGlobalSetting(key, value) {
  if (!supabase) return false;
  const id = await uid();
  const { error } = await supabase
    .from('global_settings')
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: id });
  if (error) { console.error('setGlobalSetting', error); return false; }
  return true;
}

export async function subscribeGlobalSettings(onUpdate) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('global_settings_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'global_settings' },
      (payload) => onUpdate(payload?.new?.key, payload?.new?.value),
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ══════════════════════════════════════════════════════════
//  PROFILE / ROLE HELPERS
// ══════════════════════════════════════════════════════════

export async function fetchUserRole() {
  if (!supabase) return 'member';
  const id = await uid();
  if (!id) return 'member';
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return 'member';
  return data.role || 'member';
}
