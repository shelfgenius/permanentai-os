-- ══════════════════════════════════════════════════════════
-- Personal AI OS — Supabase schema migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ══════════════════════════════════════════════════════════

-- 1. Add role column to profiles (admin / member)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';

-- Set Maher as admin (match by email or username)
UPDATE public.profiles
  SET role = 'admin'
  WHERE username ILIKE '%maher%'
     OR id IN (
       SELECT id FROM auth.users WHERE email ILIKE '%maher%'
     );

-- 2. Global settings table (backend_url shared across all users)
CREATE TABLE IF NOT EXISTS public.global_settings (
  key   text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Seed the backend_url row
INSERT INTO public.global_settings (key, value)
VALUES ('backend_url', '')
ON CONFLICT (key) DO NOTHING;

-- RLS: anyone can read, only admins can write
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read global_settings"
  ON public.global_settings FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update global_settings"
  ON public.global_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can insert global_settings"
  ON public.global_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 3. Playlists table (per-user YouTube playlists)
CREATE TABLE IF NOT EXISTS public.playlists (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  tracks     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playlists_user ON public.playlists(user_id);

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see only their own playlists"
  ON public.playlists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own playlists"
  ON public.playlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own playlists"
  ON public.playlists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own playlists"
  ON public.playlists FOR DELETE
  USING (auth.uid() = user_id);

-- 4. History table (per-user, per-product activity log)
CREATE TABLE IF NOT EXISTS public.history (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product    text NOT NULL,  -- 'aura', 'nexus', 'mappy', 'sky', 'echo', 'youtube', 'sculpt', 'lexi', 'canvas'
  action     text NOT NULL,  -- 'chat', 'search', 'play', 'generate', 'navigate', etc.
  title      text,
  metadata   jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_history_user ON public.history(user_id, product, created_at DESC);

ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see only their own history"
  ON public.history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own history"
  ON public.history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own history"
  ON public.history FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Invite codes table
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code       text UNIQUE NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  used_by    uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  used_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_invite_code ON public.invite_codes(code);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Users can see codes they created
CREATE POLICY "Users see their own invite codes"
  ON public.invite_codes FOR SELECT
  USING (auth.uid() = created_by);

-- Any authenticated user can create invite codes
CREATE POLICY "Authenticated users create invite codes"
  ON public.invite_codes FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Allow code validation (anyone can read unused codes to validate them during signup)
CREATE POLICY "Anyone can validate invite codes"
  ON public.invite_codes FOR SELECT
  USING (used_by IS NULL);

-- Service role / triggers handle marking codes as used
CREATE POLICY "System can update invite codes"
  ON public.invite_codes FOR UPDATE
  USING (true);

-- ══════════════════════════════════════════════════════════
-- DONE — After running this, verify tables exist in the
-- Supabase Table Editor.
-- ══════════════════════════════════════════════════════════
