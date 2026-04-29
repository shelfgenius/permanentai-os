import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, getSessionSafe, ensureProfile } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

const log = logger('auth');

/**
 * Password validation — enforces:
 *   • min 6 characters
 *   • at least one lowercase letter
 *   • at least one uppercase letter
 *   • at least one digit
 *   • at least one symbol
 */
export function validatePassword(pw) {
  const errs = [];
  if (pw.length < 6)            errs.push('At least 6 characters required');
  if (!/[a-z]/.test(pw))        errs.push('Must contain a lowercase letter');
  if (!/[A-Z]/.test(pw))        errs.push('Must contain an uppercase letter');
  if (!/[0-9]/.test(pw))        errs.push('Must contain a digit');
  if (!/[^a-zA-Z0-9]/.test(pw)) errs.push('Must contain a symbol (!@#$…)');
  return errs;
}

const useAuth = create(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      profile: null,

      /* ── Email + password sign-in (Supabase Auth) ────────── */
      login: async (email, password, captchaToken) => {
        if (!supabase) throw new Error('Supabase not configured');
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
          options: { captchaToken },
        });
        if (error) throw error;
        const profile = await ensureProfile(data.user);
        set({
          session: data.session,
          profile,
          user: {
            id: data.user.id,
            email: data.user.email,
            username: profile?.username || data.user.email?.split('@')[0],
            preferred_domain: profile?.preferred_domain || 'general',
          },
        });
        return data.user;
      },

      /* ── Email + password registration (Supabase Auth) ───── */
      register: async (email, password, displayName, preferredDomain, captchaToken) => {
        if (!supabase) throw new Error('Supabase not configured');
        const pwErrors = validatePassword(password);
        if (pwErrors.length) throw new Error(pwErrors[0]);

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            captchaToken,
            data: {
              display_name: displayName || '',
              preferred_domain: preferredDomain || 'general_ai',
            },
          },
        });
        if (error) throw error;

        // Supabase may require email confirmation before issuing a session
        if (!data.session) {
          return { needsEmailConfirmation: true, email: email.trim() };
        }

        const profile = await ensureProfile(data.user);
        set({
          session: data.session,
          profile,
          user: {
            id: data.user.id,
            email: data.user.email,
            username: profile?.username || displayName || data.user.email?.split('@')[0],
            preferred_domain: profile?.preferred_domain || preferredDomain || 'general',
          },
        });
        return data.user;
      },

      /* ── Restore existing Supabase session (page load / refresh) ── */
      initSupabaseSession: async () => {
        if (!supabase) return null;
        try {
          const session = await getSessionSafe();
          if (!session?.user) return null;
          const profile = await ensureProfile(session.user);
          set({
            session,
            profile,
            user: {
              id: session.user.id,
              username: profile?.username || session.user.email,
              email: session.user.email,
              preferred_domain: profile?.preferred_domain || 'general',
            },
          });
          return session.user;
        } catch (error) {
          log.error('supabase init failed', error);
          return null;
        }
      },

      /* ── OAuth (Google / GitHub) — Supabase-native ────── */
      signInWithOAuth: async (provider) => {
        if (!supabase) throw new Error('Supabase not configured');
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
      },

      /* ── Password change (Supabase enforces secure password change) ── */
      updatePassword: async (newPassword) => {
        if (!supabase) throw new Error('Supabase not configured');
        const pwErrors = validatePassword(newPassword);
        if (pwErrors.length) throw new Error(pwErrors[0]);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      },

      /* ── Email change (secure: both old + new must confirm) ── */
      updateEmail: async (newEmail) => {
        if (!supabase) throw new Error('Supabase not configured');
        const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
        if (error) throw error;
        return { needsConfirmation: true };
      },

      syncProfile: async () => {
        const session = await getSessionSafe();
        if (!session?.user) return null;
        const profile = await ensureProfile(session.user);
        set((state) => ({
          profile,
          user: state.user
            ? { ...state.user, preferred_domain: profile?.preferred_domain || state.user.preferred_domain }
            : state.user,
        }));
        return profile;
      },

      updateSettings: async ({ username, preferred_domain }) => {
        const session = await getSessionSafe();
        if (!session?.user || !supabase) throw new Error('No active session');
        const patch = {};
        if (username?.trim()) patch.username = username.trim();
        if (preferred_domain?.trim()) patch.preferred_domain = preferred_domain.trim();
        const { data, error } = await supabase
          .from('profiles')
          .upsert({ id: session.user.id, ...patch })
          .select('*')
          .single();
        if (error) throw error;
        set((state) => ({
          profile: data,
          user: state.user
            ? { ...state.user, username: data?.username || state.user.username, preferred_domain: data?.preferred_domain || state.user.preferred_domain }
            : state.user,
        }));
        return data;
      },

      logout: async () => {
        try {
          if (supabase) await supabase.auth.signOut();
        } catch (error) {
          log.warn('supabase signOut failed', error);
        }
        set({ user: null, session: null, profile: null });
      },

      isAuthenticated: () => !!get().user,
    }),
    {
      name: 'personal-ai-auth',
      partialize: (s) => ({ user: s.user, session: s.session, profile: s.profile }),
    }
  )
);

export default useAuth;
